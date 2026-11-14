import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation.js';
import { Message, MAX_MESSAGE_LENGTH } from '../models/Message.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { ACCOUNT_STATUS } from '../constants/index.js';
import { NOTIFICATION_TYPES } from '../constants/index.js';
import { createNotification } from '../services/notificationService.js';
import { successResponse, errorResponse } from '../utils/response.js';

const MAX_LIMIT = 50;
const PARTICIPANT_FIELDS = 'name avatarUrl department batch campusLocation';
const PRODUCT_SUMMARY_FIELDS = 'title price currency images status listingType';

const isValidObjectId = (value) => typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

const parsePagination = (query, defaultLimit) => {
  const pageValue = Array.isArray(query.page) ? query.page[0] : query.page;
  const limitValue = Array.isArray(query.limit) ? query.limit[0] : query.limit;
  const page = Math.max(1, parseInt(pageValue, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limitValue, 10) || defaultLimit));
  return { page, limit };
};

const toPublicParticipant = (user) => {
  if (!user || typeof user !== 'object') return null;
  return {
    _id: user._id,
    name: user.name,
    avatarUrl: user.avatarUrl || '',
    department: user.department || '',
    batch: user.batch || '',
    campusLocation: user.campusLocation || '',
  };
};

const toProductSummary = (product) => {
  if (!product || typeof product !== 'object' || !product._id) return null;
  return {
    _id: product._id,
    title: product.title,
    price: product.price,
    currency: product.currency,
    images: product.images || [],
    status: product.status,
    listingType: product.listingType,
  };
};

const toMessageDto = (message) => ({
  _id: message._id,
  conversation: message.conversation,
  sender: message.sender,
  recipient: message.recipient,
  text: message.text,
  isRead: message.isRead,
  readAt: message.readAt || null,
  createdAt: message.createdAt,
});

const isParticipant = (conversation, userId) =>
  conversation.participants.some((participant) => {
    const id = participant?._id || participant;
    return id.toString() === userId.toString();
  });

const otherParticipantId = (conversation, userId) => {
  const other = conversation.participants.find((participant) => {
    const id = participant?._id || participant;
    return id.toString() !== userId.toString();
  });
  return other?._id || other || null;
};

const loadConversationForUser = async (conversationId, userId) => {
  if (!isValidObjectId(conversationId)) {
    return { error: { statusCode: 400, message: 'Invalid conversation ID format.' } };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return { error: { statusCode: 404, message: 'Conversation not found.' } };
  }

  if (!isParticipant(conversation, userId)) {
    return { error: { statusCode: 403, message: 'You are not allowed to access this conversation.' } };
  }

  return { conversation };
};

const presentConversation = (conversation, unreadCount = 0) => ({
  _id: conversation._id,
  participants: (conversation.participants || []).map(toPublicParticipant).filter(Boolean),
  product: toProductSummary(conversation.product),
  lastMessage: conversation.lastMessage
    ? {
        _id: conversation.lastMessage._id || conversation.lastMessage,
        text: conversation.lastMessage.text || '',
        sender: conversation.lastMessage.sender || null,
        isRead: conversation.lastMessage.isRead,
        createdAt: conversation.lastMessage.createdAt || null,
      }
    : null,
  lastMessageAt: conversation.lastMessageAt,
  unreadCount,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

/**
 * @route   POST /api/v1/conversations
 * @desc    Start or reuse a two-person conversation
 * @access  Private (verified)
 */
export const createConversation = async (req, res, next) => {
  try {
    if (!req.user.isVerified) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'You must verify your university email before messaging other students.',
      });
    }

    const recipientId = req.body?.recipientId;
    const productId = req.body?.productId;

    if (!isValidObjectId(recipientId)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid recipient ID format.',
      });
    }

    if (recipientId === req.user._id.toString()) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'You cannot start a conversation with yourself.',
      });
    }

    const recipient = await User.findById(recipientId).select('name isVerified status role');
    if (!recipient) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'Recipient not found.',
      });
    }

    if (!recipient.isVerified || recipient.status !== ACCOUNT_STATUS.ACTIVE) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'This student is not eligible to receive messages.',
      });
    }

    let product = null;
    if (productId !== undefined && productId !== null && productId !== '') {
      if (!isValidObjectId(productId)) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Invalid product ID format.',
        });
      }
      product = await Product.findById(productId).select(PRODUCT_SUMMARY_FIELDS);
      if (!product) {
        return errorResponse(res, {
          statusCode: 404,
          message: 'Product listing not found.',
        });
      }
    }

    const participantIds = [req.user._id, recipient._id].sort((a, b) => String(a).localeCompare(String(b)));
    const productRef = product ? product._id : null;

    const existing = await Conversation.findOne({
      $and: [
        { participants: { $all: participantIds } },
        { participants: { $size: 2 } },
        { product: productRef },
      ],
    })
      .populate('participants', PARTICIPANT_FIELDS)
      .populate('lastMessage', 'text sender createdAt isRead')
      .populate('product', PRODUCT_SUMMARY_FIELDS);

    if (existing) {
      const unreadCount = await Message.countDocuments({
        conversation: existing._id,
        recipient: req.user._id,
        isRead: false,
      });
      return successResponse(res, {
        statusCode: 200,
        message: 'Existing conversation reused.',
        data: presentConversation(existing, unreadCount),
      });
    }

    const created = await Conversation.create({
      participants: participantIds,
      product: productRef,
      lastMessageAt: new Date(),
    });

    const populated = await Conversation.findById(created._id)
      .populate('participants', PARTICIPANT_FIELDS)
      .populate('product', PRODUCT_SUMMARY_FIELDS);

    return successResponse(res, {
      statusCode: 201,
      message: 'Conversation started.',
      data: presentConversation(populated, 0),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/conversations
 * @desc    List conversations for the current user
 * @access  Private
 */
export const getConversations = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query, 20);
    const skip = (page - 1) * limit;
    const filter = { participants: req.user._id };

    const total = await Conversation.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;

    const conversations = await Conversation.find(filter)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('participants', PARTICIPANT_FIELDS)
      .populate('lastMessage', 'text sender createdAt isRead')
      .populate('product', PRODUCT_SUMMARY_FIELDS)
      .lean();

    const ids = conversations.map((conversation) => conversation._id);
    const unreadRows = ids.length
      ? await Message.aggregate([
          {
            $match: {
              conversation: { $in: ids },
              recipient: req.user._id,
              isRead: false,
            },
          },
          { $group: { _id: '$conversation', count: { $sum: 1 } } },
        ])
      : [];
    const unreadMap = new Map(unreadRows.map((row) => [String(row._id), row.count]));

    return successResponse(res, {
      statusCode: 200,
      message: 'Conversations retrieved successfully.',
      data: {
        conversations: conversations.map((conversation) =>
          presentConversation(conversation, unreadMap.get(String(conversation._id)) || 0)
        ),
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/conversations/:conversationId
 * @desc    Get one conversation when the current user is a participant
 * @access  Private
 */
export const getConversation = async (req, res, next) => {
  try {
    const { conversation, error } = await loadConversationForUser(req.params.conversationId, req.user._id);
    if (error) return errorResponse(res, error);

    const populated = await Conversation.findById(conversation._id)
      .populate('participants', PARTICIPANT_FIELDS)
      .populate('lastMessage', 'text sender createdAt isRead')
      .populate('product', PRODUCT_SUMMARY_FIELDS)
      .lean();

    const unreadCount = await Message.countDocuments({
      conversation: conversation._id,
      recipient: req.user._id,
      isRead: false,
    });

    return successResponse(res, {
      statusCode: 200,
      message: 'Conversation retrieved successfully.',
      data: presentConversation(populated, unreadCount),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/conversations/:conversationId/messages
 * @desc    Message history for a conversation, oldest to newest within the page
 * @access  Private (participant)
 */
export const getMessages = async (req, res, next) => {
  try {
    const { conversation, error } = await loadConversationForUser(req.params.conversationId, req.user._id);
    if (error) return errorResponse(res, error);

    const { page, limit } = parsePagination(req.query, 50);
    const filter = { conversation: conversation._id };
    const total = await Message.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;
    const end = Math.max(total - (page - 1) * limit, 0);
    const start = Math.max(0, end - limit);

    const messages = end > start
      ? await Message.find(filter)
          .sort({ createdAt: 1, _id: 1 })
          .skip(start)
          .limit(end - start)
          .lean()
      : [];

    return successResponse(res, {
      statusCode: 200,
      message: 'Messages retrieved successfully.',
      data: {
        messages: messages.map(toMessageDto),
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages,
          hasNextPage: start > 0,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/conversations/:conversationId/messages
 * @desc    Send a message as the authenticated participant
 * @access  Private (verified participant)
 */
export const sendMessage = async (req, res, next) => {
  try {
    if (!req.user.isVerified) {
      return errorResponse(res, {
        statusCode: 403,
        message: 'You must verify your university email before sending messages.',
      });
    }

    const { conversation, error } = await loadConversationForUser(req.params.conversationId, req.user._id);
    if (error) return errorResponse(res, error);

    const text = req.body?.text;
    if (typeof text !== 'string') {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Message text must be a string.',
      });
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Message text cannot be empty.',
      });
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return errorResponse(res, {
        statusCode: 400,
        message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`,
      });
    }

    const recipientId = otherParticipantId(conversation, req.user._id);
    if (!recipientId) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'This conversation does not have a valid recipient.',
      });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      recipient: recipientId,
      text: trimmed,
      isRead: false,
    });

    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();

    try {
      await createNotification({
        recipient: recipientId,
        type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
        title: 'New message',
        message: `You have a new message from ${req.user.name}.`,
        link: `/conversations/${conversation._id}`,
        relatedUser: req.user._id,
        relatedProduct: conversation.product || undefined,
      });
    } catch (notifyError) {
      console.error(`[Notification] Message notify failed: ${notifyError.message}`);
    }

    return successResponse(res, {
      statusCode: 201,
      message: 'Message sent.',
      data: toMessageDto(message),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/conversations/:conversationId/read
 * @desc    Mark messages addressed to the current user as read
 * @access  Private (participant)
 */
export const markConversationRead = async (req, res, next) => {
  try {
    const { conversation, error } = await loadConversationForUser(req.params.conversationId, req.user._id);
    if (error) return errorResponse(res, error);

    const readAt = new Date();
    const result = await Message.updateMany(
      {
        conversation: conversation._id,
        recipient: req.user._id,
        isRead: false,
      },
      {
        $set: { isRead: true, readAt },
      }
    );

    return successResponse(res, {
      statusCode: 200,
      message: 'Conversation marked as read.',
      data: {
        updatedCount: result.modifiedCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/messages/unread-count
 * @desc    Count unread messages addressed to the current user
 * @access  Private
 */
export const getUnreadMessageCount = async (req, res, next) => {
  try {
    const count = await Message.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    return successResponse(res, {
      statusCode: 200,
      message: 'Unread message count retrieved.',
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};
