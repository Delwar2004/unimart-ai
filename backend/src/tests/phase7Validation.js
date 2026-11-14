import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Notification } from '../models/Notification.js';
import { generateToken } from '../utils/token.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5000/api/v1';
const results = [];

const record = (id, name, ok) => {
  results.push({ id, name, ok: Boolean(ok) });
  console.log(`Test ${id} (${name}): ${ok ? 'PASS' : 'FAIL'}`);
};

const runCase = async (id, name, fn) => {
  try {
    const ok = await fn();
    record(id, name, ok);
  } catch (error) {
    console.error(`Test ${id} threw:`, error);
    record(id, name, false);
  }
};

const authHeaders = (token, json = false) => ({
  Authorization: `Bearer ${token}`,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

const runRegression = (scriptName) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, scriptName)], {
      cwd: path.resolve(__dirname, '../..'),
      env: process.env,
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on('close', (code) => {
      const fails = (output.match(/: false\b/g) || []).length;
      const failedSummary = /Failed: (?!0\b)/.test(output);
      resolve({ code, fails, ok: code === 0 && fails === 0 && !failedSummary });
    });
  });

const runPhase7Validation = async () => {
  console.log('--- STARTING PHASE 7 AUTOMATED TEST SUITE ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const emails = [
    'phase7_a@bup.edu.bd',
    'phase7_b@bup.edu.bd',
    'phase7_c@bup.edu.bd',
    'phase7_unverified@bup.edu.bd',
  ];

  const existingUsers = await User.find({ email: { $in: emails } }).select('_id');
  const existingIds = existingUsers.map((user) => user._id);
  if (existingIds.length) {
    const conversations = await Conversation.find({ participants: { $in: existingIds } }).select('_id');
    const conversationIds = conversations.map((item) => item._id);
    await Message.deleteMany({ conversation: { $in: conversationIds } });
    await Conversation.deleteMany({ _id: { $in: conversationIds } });
    await Notification.deleteMany({ recipient: { $in: existingIds } });
    await Product.deleteMany({ seller: { $in: existingIds } });
    await User.deleteMany({ _id: { $in: existingIds } });
  }

  const category = await Category.findOne();
  if (!category) {
    throw new Error('No categories found. Start the API once so category seed can run.');
  }

  const makeUser = (name, email, studentId, isVerified) =>
    User.create({
      name,
      email,
      passwordHash: 'dummy_hash',
      studentId,
      phone: '+8801700000000',
      department: 'ICT',
      batch: 'BICE-24',
      campusLocation: 'Mirpur Cantonment Campus',
      role: 'student',
      isVerified,
      status: 'active',
    });

  const userA = await makeUser('Phase7 Student A', emails[0], 'phase7-a', true);
  const userB = await makeUser('Phase7 Student B', emails[1], 'phase7-b', true);
  const userC = await makeUser('Phase7 Student C', emails[2], 'phase7-c', true);
  const unverified = await makeUser('Phase7 Unverified', emails[3], 'phase7-unverified', false);

  const tokenA = generateToken(userA._id, 'student');
  const tokenB = generateToken(userB._id, 'student');
  const tokenC = generateToken(userC._id, 'student');
  const tokenUnverified = generateToken(unverified._id, 'student');

  const product = await Product.create({
    title: 'Phase 7 Scientific Calculator',
    description: 'Messaging context listing.',
    category: category._id,
    seller: userB._id,
    listingType: 'sell',
    price: 1500,
    condition: 'good',
    campusLocation: 'FST Lab 402',
    status: 'available',
  });

  let conversationId = null;

  await runCase(1, 'Unauthenticated conversation creation rejected', async () => {
    const res = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId: userB._id.toString() }),
    });
    const data = await res.json();
    return res.status === 401 && data.success === false;
  });

  await runCase(2, 'Unverified user rejected', async () => {
    const res = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: authHeaders(tokenUnverified, true),
      body: JSON.stringify({ recipientId: userB._id.toString(), productId: product._id.toString() }),
    });
    const data = await res.json();
    return res.status === 403 && data.success === false;
  });

  await runCase(3, 'Valid conversation creation', async () => {
    const res = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({
        recipientId: userB._id.toString(),
        productId: product._id.toString(),
        participants: [userC._id.toString(), userC._id.toString()],
        senderId: userC._id.toString(),
      }),
    });
    const data = await res.json();
    conversationId = data.data?._id;
    const ids = (data.data?.participants || []).map((person) => person._id).sort();
    const expected = [userA._id.toString(), userB._id.toString()].sort();
    return res.status === 201 && data.success === true && ids.join() === expected.join() && ids.length === 2;
  });

  await runCase(4, 'Duplicate conversation prevented/reused', async () => {
    const res = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ recipientId: userB._id.toString(), productId: product._id.toString() }),
    });
    const data = await res.json();
    const count = await Conversation.countDocuments({
      participants: { $all: [userA._id, userB._id] },
      product: product._id,
    });
    return res.status === 200 && data.data?._id === conversationId && count === 1;
  });

  await runCase(5, 'Self-conversation rejected', async () => {
    const res = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ recipientId: userA._id.toString() }),
    });
    const data = await res.json();
    return res.status === 400 && data.success === false;
  });

  await runCase(6, 'Invalid recipient ID rejected', async () => {
    const res = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ recipientId: 'not-an-id' }),
    });
    const data = await res.json();
    return res.status === 400 && data.success === false;
  });

  await runCase(7, 'Nonexistent recipient handled safely', async () => {
    const res = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ recipientId: new mongoose.Types.ObjectId().toString() }),
    });
    const data = await res.json();
    return res.status === 404 && data.success === false;
  });

  await runCase(8, 'Optional product association works', async () => {
    const res = await fetch(`${BASE}/conversations/${conversationId}`, {
      headers: authHeaders(tokenA),
    });
    const data = await res.json();
    return res.status === 200 && data.data?.product?._id === product._id.toString() && data.data?.product?.title === product.title;
  });

  await runCase(9, 'Invalid product ID handled safely', async () => {
    const invalid = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ recipientId: userB._id.toString(), productId: 'not-an-id' }),
    });
    const missing = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({
        recipientId: userB._id.toString(),
        productId: new mongoose.Types.ObjectId().toString(),
      }),
    });
    return invalid.status === 400 && missing.status === 404;
  });

  await runCase(10, 'User can retrieve own conversations', async () => {
    const res = await fetch(`${BASE}/conversations?page=1&limit=20`, { headers: authHeaders(tokenA) });
    const data = await res.json();
    const bounded = await fetch(`${BASE}/conversations?limit=500`, { headers: authHeaders(tokenA) });
    const boundedData = await bounded.json();
    const found = (data.data?.conversations || []).some((item) => item._id === conversationId);
    return (
      res.status === 200 &&
      found &&
      data.data?.pagination?.page === 1 &&
      boundedData.data?.pagination?.limit === 50
    );
  });

  await runCase(11, "User cannot retrieve another user's conversation", async () => {
    const res = await fetch(`${BASE}/conversations/${conversationId}`, { headers: authHeaders(tokenC) });
    const data = await res.json();
    const list = await fetch(`${BASE}/conversations`, { headers: authHeaders(tokenC) });
    const listData = await list.json();
    const leaked = (listData.data?.conversations || []).some((item) => item._id === conversationId);
    return res.status === 403 && data.success === false && leaked === false;
  });

  const sendAs = (token, text, extra = {}) =>
    fetch(`${BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify({ text, ...extra }),
    });

  await runCase(12, 'Valid message creation', async () => {
    const res = await sendAs(tokenA, 'Is this calculator still available?');
    const data = await res.json();
    return res.status === 201 && data.data?.text === 'Is this calculator still available?' && data.data?.isRead === false;
  });

  await runCase(13, 'Empty message rejected', async () => {
    const res = await sendAs(tokenA, '');
    const data = await res.json();
    return res.status === 400 && data.success === false;
  });

  await runCase(14, 'Whitespace-only message rejected', async () => {
    const res = await sendAs(tokenA, '   \n\t  ');
    const data = await res.json();
    return res.status === 400 && data.success === false;
  });

  await runCase(15, 'Message over 2000 characters rejected', async () => {
    const res = await sendAs(tokenA, 'a'.repeat(2001));
    const data = await res.json();
    const exact = await sendAs(tokenA, 'b'.repeat(2000));
    return res.status === 400 && data.success === false && exact.status === 201;
  });

  await runCase(16, 'Sender identity comes from JWT', async () => {
    const res = await sendAs(tokenA, 'Sender must be the token user.', {
      senderId: userC._id.toString(),
      recipientId: userC._id.toString(),
    });
    const data = await res.json();
    const stored = await Message.findById(data.data?._id);
    return (
      res.status === 201 &&
      String(stored.sender) === userA._id.toString() &&
      String(stored.recipient) === userB._id.toString()
    );
  });

  await runCase(17, 'User outside conversation cannot send', async () => {
    const res = await sendAs(tokenC, 'I should not be able to send this.');
    const data = await res.json();
    return res.status === 403 && data.success === false;
  });

  await runCase(18, 'User outside conversation cannot read messages', async () => {
    const res = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
      headers: authHeaders(tokenC),
    });
    const data = await res.json();
    return res.status === 403 && data.success === false;
  });

  await runCase(19, 'Messages returned chronologically', async () => {
    await sendAs(tokenA, 'chrono-1');
    await sendAs(tokenA, 'chrono-2');
    await sendAs(tokenA, 'chrono-3');
    const res = await fetch(`${BASE}/conversations/${conversationId}/messages?limit=50`, {
      headers: authHeaders(tokenA),
    });
    const data = await res.json();
    const messages = data.data?.messages || [];
    const times = messages.map((message) => new Date(message.createdAt).getTime());
    const ordered = times.every((time, index) => index === 0 || times[index - 1] <= time);
    const chrono = messages.map((message) => message.text);
    const firstIndex = chrono.indexOf('chrono-1');
    return (
      res.status === 200 &&
      ordered &&
      firstIndex >= 0 &&
      chrono[firstIndex + 1] === 'chrono-2' &&
      chrono[firstIndex + 2] === 'chrono-3'
    );
  });

  await runCase(20, 'Pagination works', async () => {
    const allRes = await fetch(`${BASE}/conversations/${conversationId}/messages?limit=50`, {
      headers: authHeaders(tokenB),
    });
    const all = (await allRes.json()).data?.messages || [];
    const pageRes = await fetch(`${BASE}/conversations/${conversationId}/messages?page=1&limit=2`, {
      headers: authHeaders(tokenB),
    });
    const pageData = await pageRes.json();
    const pageMessages = pageData.data?.messages || [];
    const expected = all.slice(-2).map((message) => message._id);
    const olderRes = await fetch(`${BASE}/conversations/${conversationId}/messages?page=2&limit=2`, {
      headers: authHeaders(tokenB),
    });
    const older = (await olderRes.json()).data?.messages || [];
    return (
      pageRes.status === 200 &&
      pageMessages.length === 2 &&
      pageMessages.map((message) => message._id).join() === expected.join() &&
      pageData.data?.pagination?.limit === 2 &&
      pageData.data?.pagination?.hasNextPage === true &&
      older.length > 0 &&
      !older.some((message) => message._id === pageMessages[1]._id)
    );
  });

  await runCase(21, 'Conversation lastMessage updates', async () => {
    const convo = await Conversation.findById(conversationId);
    const latest = await Message.findOne({ conversation: conversationId }).sort({ createdAt: -1, _id: -1 });
    return String(convo.lastMessage) === String(latest._id);
  });

  await runCase(22, 'Conversation lastMessageAt updates', async () => {
    const before = await Conversation.findById(conversationId);
    const previous = new Date(before.lastMessageAt).getTime();
    const res = await sendAs(tokenA, 'Updating the conversation timestamp.');
    const data = await res.json();
    const after = await Conversation.findById(conversationId);
    return (
      res.status === 201 &&
      String(after.lastMessage) === data.data?._id &&
      new Date(after.lastMessageAt).getTime() >= previous &&
      new Date(after.lastMessageAt).getTime() === new Date(data.data?.createdAt).getTime()
    );
  });

  await runCase(23, 'Unread message count works', async () => {
    const expected = await Message.countDocuments({ recipient: userB._id, isRead: false });
    const res = await fetch(`${BASE}/messages/unread-count`, { headers: authHeaders(tokenB) });
    const data = await res.json();
    const unauth = await fetch(`${BASE}/messages/unread-count`);
    const senderCount = await Message.countDocuments({ sender: userA._id, recipient: userA._id, isRead: false });
    return res.status === 200 && data.data?.count === expected && expected > 0 && unauth.status === 401 && senderCount === 0;
  });

  await runCase(25, 'Only recipient messages become read', async () => {
    const reply = await sendAs(tokenB, 'Yes, it is still available.');
    const replyData = await reply.json();
    const mark = await fetch(`${BASE}/conversations/${conversationId}/read`, {
      method: 'PATCH',
      headers: authHeaders(tokenB),
    });
    const incoming = await Message.find({ conversation: conversationId, recipient: userB._id });
    const outgoing = await Message.findById(replyData.data?._id);
    return (
      reply.status === 201 &&
      mark.status === 200 &&
      incoming.length > 0 &&
      incoming.every((message) => message.isRead === true && message.readAt) &&
      outgoing.isRead === false &&
      outgoing.readAt == null
    );
  });

  await runCase(24, 'Mark conversation as read works', async () => {
    const res = await fetch(`${BASE}/messages/unread-count`, { headers: authHeaders(tokenB) });
    const data = await res.json();
    return res.status === 200 && data.data?.count === 0;
  });

  await runCase(26, 'New message creates notification', async () => {
    const res = await sendAs(tokenA, 'Can we meet at the cafeteria?');
    const note = await Notification.findOne({
      recipient: userB._id,
      type: 'MESSAGE_RECEIVED',
      link: `/conversations/${conversationId}`,
    }).sort({ createdAt: -1 });
    return (
      res.status === 201 &&
      note?.title === 'New message' &&
      note?.message === 'You have a new message from Phase7 Student A.'
    );
  });

  await runCase(27, 'Notification recipient is correct', async () => {
    const note = await Notification.findOne({
      recipient: userB._id,
      type: 'MESSAGE_RECEIVED',
      message: 'You have a new message from Phase7 Student A.',
    }).sort({ createdAt: -1 });
    const selfNotice = await Notification.findOne({
      recipient: userA._id,
      type: 'MESSAGE_RECEIVED',
      relatedUser: userA._id,
    });
    return Boolean(note) && String(note.relatedUser) === userA._id.toString() && selfNotice === null;
  });

  await runCase(28, 'Notification failure does not break message creation', async () => {
    const beforeMessages = await Message.countDocuments({ conversation: conversationId });
    const beforeNotes = await Notification.countDocuments({
      recipient: userB._id,
      type: 'MESSAGE_RECEIVED',
    });
    await mongoose.connection.db.command({
      collMod: 'notifications',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['__phase7_force_fail'],
        },
      },
      validationLevel: 'strict',
      validationAction: 'error',
    });

    try {
      const res = await sendAs(tokenA, 'This message must survive a notification failure.');
      const data = await res.json();
      const afterMessages = await Message.countDocuments({ conversation: conversationId });
      const stored = await Message.findById(data.data?._id);
      const afterNotes = await Notification.countDocuments({
        recipient: userB._id,
        type: 'MESSAGE_RECEIVED',
      });
      return res.status === 201 && stored?.text?.includes('survive') && afterMessages === beforeMessages + 1 && afterNotes === beforeNotes;
    } finally {
      await mongoose.connection.db.command({
        collMod: 'notifications',
        validator: { $jsonSchema: { bsonType: 'object' } },
        validationLevel: 'off',
      });
    }
  });

  await runCase(29, 'Another user cannot access conversation', async () => {
    const res = await fetch(`${BASE}/conversations/${conversationId}`, { headers: authHeaders(tokenC) });
    return res.status === 403;
  });

  await runCase(30, 'Another user cannot send message', async () => {
    const res = await sendAs(tokenC, 'Blocked outsider message');
    const stored = await Message.findOne({ text: 'Blocked outsider message' });
    return res.status === 403 && stored === null;
  });

  await runCase(31, 'Another user cannot mark conversation read', async () => {
    const pending = await Message.findOne({ conversation: conversationId, recipient: userB._id, isRead: false });
    const res = await fetch(`${BASE}/conversations/${conversationId}/read`, {
      method: 'PATCH',
      headers: authHeaders(tokenC),
    });
    const after = pending ? await Message.findById(pending._id) : null;
    return res.status === 403 && pending && after.isRead === false;
  });

  await runCase(32, 'Invalid ObjectIds handled safely', async () => {
    const read = await fetch(`${BASE}/conversations/not-an-id`, { headers: authHeaders(tokenA) });
    const messages = await fetch(`${BASE}/conversations/not-an-id/messages`, { headers: authHeaders(tokenA) });
    const send = await fetch(`${BASE}/conversations/not-an-id/messages`, {
      method: 'POST',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ text: 'nope' }),
    });
    const mark = await fetch(`${BASE}/conversations/not-an-id/read`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
    });
    const objectText = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(tokenA, true),
      body: JSON.stringify({ text: { $gt: '' } }),
    });
    return read.status === 400 && messages.status === 400 && send.status === 400 && mark.status === 400 && objectText.status === 400;
  });

  await runCase(33, 'No private participant fields exposed', async () => {
    const res = await fetch(`${BASE}/conversations/${conversationId}`, { headers: authHeaders(tokenA) });
    const data = await res.json();
    const serialized = JSON.stringify(data.data?.participants || []);
    const forbidden = ['email', 'phone', 'passwordHash', 'verificationToken', 'isVerified', 'studentId'];
    const keys = (data.data?.participants || []).flatMap((person) => Object.keys(person));
    return res.status === 200 && forbidden.every((field) => !keys.includes(field)) && !serialized.includes(emails[0]) && !serialized.includes('+8801700000000');
  });

  await runCase(34, 'Health endpoint', async () => {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    return res.status === 200 && data.success === true && data.data?.database?.connected === true;
  });

  await mongoose.disconnect();

  const phase2 = await runRegression('phase2Validation.js');
  record(35, 'Phase 2', phase2.ok);
  const phase3 = await runRegression('phase3Validation.js');
  record(36, 'Phase 3', phase3.ok);
  const phase4 = await runRegression('phase4Validation.js');
  record(37, 'Phase 4', phase4.ok);
  const phase5 = await runRegression('phase5Validation.js');
  record(38, 'Phase 5', phase5.ok);
  const phase6 = await runRegression('phase6Validation.js');
  record(39, 'Phase 6', phase6.ok);

  const passed = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok);
  console.log('--- PHASE 7 SUMMARY ---');
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length) {
    console.log(`Failed tests: ${failed.map((item) => `${item.id} ${item.name}`).join('; ')}`);
  }
  console.log(failed.length ? '--- PHASE 7 TESTS COMPLETED WITH FAILURES ---' : '--- ALL PHASE 7 TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(failed.length ? 1 : 0);
};

runPhase7Validation().catch(async (error) => {
  console.error('Phase 7 test suite failed:', error);
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.command({
        collMod: 'notifications',
        validator: { $jsonSchema: { bsonType: 'object' } },
        validationLevel: 'off',
      });
    }
  } catch {
    // Best-effort validator cleanup.
  }
  process.exit(1);
});
