import mongoose from 'mongoose';
import { WantedPost, MAX_WANTED_TITLE, MAX_WANTED_DESCRIPTION, MAX_WANTED_BUDGET, MAX_WANTED_LOCATION } from '../models/WantedPost.js';
import { Category } from '../models/Category.js';
import { Conversation } from '../models/Conversation.js';
import { User } from '../models/User.js';
import { ACCOUNT_STATUS, NOTIFICATION_TYPES, WANTED_STATUS } from '../constants/index.js';
import { createNotification } from '../services/notificationService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { isValidObjectId, parsePagination, toPublicUser, sameId } from '../utils/interest.js';

const authorPopulate = { path: 'author', select: 'name avatarUrl department batch campusLocation' };
const categoryPopulate = { path: 'category', select: 'name slug' };

const present = (doc) => ({
  _id: doc._id,
  author: toPublicUser(doc.author),
  title: doc.title,
  description: doc.description,
  category: doc.category && doc.category._id
    ? { _id: doc.category._id, name: doc.category.name, slug: doc.category.slug || '' }
    : null,
  budgetMin: doc.budgetMin ?? null,
  budgetMax: doc.budgetMax ?? null,
  campusLocation: doc.campusLocation || '',
  status: doc.status,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const readQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseBudget = (value, label) => {
  if (value === undefined || value === null || value === '') return { amount: null };
  if (typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value.trim())) value = Number(value.trim());
  if (typeof value !== 'number' || !Number.isFinite(value)) return { error: `${label} must be a valid number.` };
  if (value < 0) return { error: `${label} cannot be negative.` };
  if (value > MAX_WANTED_BUDGET) return { error: `${label} cannot exceed ${MAX_WANTED_BUDGET}.` };
  return { amount: Math.round(value * 100) / 100 };
};

const parseText = (value, label, max, required) => {
  if (value === undefined || value === null || value === '') {
    return required ? { error: `${label} is required.` } : { text: '' };
  }
  if (typeof value !== 'string') return { error: `${label} must be plain text.` };
  const text = value.trim();
  if (required && !text) return { error: `${label} is required.` };
  if (text.length > max) return { error: `${label} cannot exceed ${max} characters.` };
  return { text };
};

const loadEditable = async (id, userId) => {
  if (!isValidObjectId(id)) return { error: { statusCode: 400, message: 'Invalid wanted post ID format.' } };
  const post = await WantedPost.findById(id).populate(authorPopulate).populate(categoryPopulate);
  if (!post) return { error: { statusCode: 404, message: 'Wanted post not found.' } };
  if (!sameId(post.author, userId)) {
    return { error: { statusCode: 403, message: 'You are not allowed to manage this wanted post.' } };
  }
  return { post };
};

export const createWantedPost = async (req, res, next) => {
  try {
    if (!req.user.isVerified) {
      return errorResponse(res, { statusCode: 403, message: 'You must verify your university email before posting a wanted request.' });
    }
    const title = parseText(req.body?.title, 'Title', MAX_WANTED_TITLE, true);
    if (title.error) return errorResponse(res, { statusCode: 400, message: title.error });
    const description = parseText(req.body?.description, 'Description', MAX_WANTED_DESCRIPTION, true);
    if (description.error) return errorResponse(res, { statusCode: 400, message: description.error });
    const location = parseText(req.body?.campusLocation, 'Campus location', MAX_WANTED_LOCATION, false);
    if (location.error) return errorResponse(res, { statusCode: 400, message: location.error });
    const budgetMin = parseBudget(req.body?.budgetMin, 'Minimum budget');
    if (budgetMin.error) return errorResponse(res, { statusCode: 400, message: budgetMin.error });
    const budgetMax = parseBudget(req.body?.budgetMax, 'Maximum budget');
    if (budgetMax.error) return errorResponse(res, { statusCode: 400, message: budgetMax.error });
    if (budgetMin.amount !== null && budgetMax.amount !== null && budgetMin.amount > budgetMax.amount) {
      return errorResponse(res, { statusCode: 400, message: 'Minimum budget cannot be greater than maximum budget.' });
    }

    let categoryId = null;
    if (req.body?.categoryId !== undefined && req.body?.categoryId !== null && req.body?.categoryId !== '') {
      if (!isValidObjectId(req.body.categoryId)) {
        return errorResponse(res, { statusCode: 400, message: 'Invalid category ID format.' });
      }
      const category = await Category.findById(req.body.categoryId).select('_id');
      if (!category) return errorResponse(res, { statusCode: 404, message: 'Category not found.' });
      categoryId = category._id;
    }

    const created = await WantedPost.create({
      author: req.user._id,
      title: title.text,
      description: description.text,
      category: categoryId,
      budgetMin: budgetMin.amount,
      budgetMax: budgetMax.amount,
      campusLocation: location.text,
      status: WANTED_STATUS.ACTIVE,
    });
    const post = await WantedPost.findById(created._id).populate(authorPopulate).populate(categoryPopulate);
    return successResponse(res, {
      statusCode: 201,
      message: 'Wanted post created.',
      data: present(post),
    });
  } catch (error) {
    next(error);
  }
};

export const getWantedPosts = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    const mine = readQueryValue(req.query.mine) === 'true';
    const status = readQueryValue(req.query.status);

    if (mine) {
      if (!req.user) return errorResponse(res, { statusCode: 401, message: 'Not authorized. No authentication token provided.' });
      filter.author = req.user._id;
      if (status !== undefined && status !== null && status !== '') {
        if (typeof status !== 'string' || !Object.values(WANTED_STATUS).includes(status)) {
          return errorResponse(res, { statusCode: 400, message: 'Invalid status filter.' });
        }
        filter.status = status;
      }
    } else if (status === undefined || status === null || status === '' || status === WANTED_STATUS.ACTIVE) {
      filter.status = WANTED_STATUS.ACTIVE;
    } else {
      return errorResponse(res, { statusCode: 400, message: 'Only active wanted posts can be browsed publicly.' });
    }

    const search = readQueryValue(req.query.q) ?? readQueryValue(req.query.search);
    if (search !== undefined && search !== null && search !== '') {
      if (typeof search !== 'string') return errorResponse(res, { statusCode: 400, message: 'Search must be plain text.' });
      const pattern = escapeRegex(search.trim());
      if (pattern) {
        filter.$or = [
          { title: { $regex: pattern, $options: 'i' } },
          { description: { $regex: pattern, $options: 'i' } },
        ];
      }
    }

    const category = readQueryValue(req.query.category);
    if (category !== undefined && category !== null && category !== '') {
      if (typeof category !== 'string' || !mongoose.Types.ObjectId.isValid(category)) {
        return errorResponse(res, { statusCode: 400, message: 'Invalid category ID format.' });
      }
      filter.category = category;
    }

    const minBudget = parseBudget(readQueryValue(req.query.minBudget), 'Minimum budget');
    if (minBudget.error) return errorResponse(res, { statusCode: 400, message: minBudget.error });
    const maxBudget = parseBudget(readQueryValue(req.query.maxBudget), 'Maximum budget');
    if (maxBudget.error) return errorResponse(res, { statusCode: 400, message: maxBudget.error });
    if (minBudget.amount !== null && maxBudget.amount !== null && minBudget.amount > maxBudget.amount) {
      return errorResponse(res, { statusCode: 400, message: 'Minimum budget cannot be greater than maximum budget.' });
    }
    if (minBudget.amount !== null) filter.budgetMax = { $gte: minBudget.amount };
    if (maxBudget.amount !== null) filter.budgetMin = { ...(filter.budgetMin || {}), $lte: maxBudget.amount };

    const campus = readQueryValue(req.query.campusLocation);
    if (campus !== undefined && campus !== null && campus !== '') {
      if (typeof campus !== 'string') return errorResponse(res, { statusCode: 400, message: 'Campus location must be plain text.' });
      filter.campusLocation = { $regex: escapeRegex(campus.trim()), $options: 'i' };
    }

    const total = await WantedPost.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;
    const posts = await WantedPost.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(authorPopulate)
      .populate(categoryPopulate)
      .lean();

    return successResponse(res, {
      statusCode: 200,
      message: 'Wanted posts retrieved successfully.',
      data: {
        posts: posts.map(present),
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

export const getWantedPost = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid wanted post ID format.' });
    }
    const post = await WantedPost.findById(req.params.id).populate(authorPopulate).populate(categoryPopulate);
    if (!post) return errorResponse(res, { statusCode: 404, message: 'Wanted post not found.' });
    const isOwner = req.user && sameId(post.author, req.user._id);
    if (post.status !== WANTED_STATUS.ACTIVE && !isOwner) {
      return errorResponse(res, { statusCode: 404, message: 'Wanted post not found.' });
    }
    return successResponse(res, { statusCode: 200, message: 'Wanted post retrieved successfully.', data: present(post) });
  } catch (error) {
    next(error);
  }
};

export const updateWantedPost = async (req, res, next) => {
  try {
    if (!req.user.isVerified) {
      return errorResponse(res, { statusCode: 403, message: 'You must verify your university email before editing a wanted post.' });
    }
    const loaded = await loadEditable(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);
    if (loaded.post.status !== WANTED_STATUS.ACTIVE) {
      return errorResponse(res, { statusCode: 409, message: 'Closed or fulfilled wanted posts cannot be edited.' });
    }

    if (req.body?.title !== undefined) {
      const title = parseText(req.body.title, 'Title', MAX_WANTED_TITLE, true);
      if (title.error) return errorResponse(res, { statusCode: 400, message: title.error });
      loaded.post.title = title.text;
    }
    if (req.body?.description !== undefined) {
      const description = parseText(req.body.description, 'Description', MAX_WANTED_DESCRIPTION, true);
      if (description.error) return errorResponse(res, { statusCode: 400, message: description.error });
      loaded.post.description = description.text;
    }
    if (req.body?.campusLocation !== undefined) {
      const location = parseText(req.body.campusLocation, 'Campus location', MAX_WANTED_LOCATION, false);
      if (location.error) return errorResponse(res, { statusCode: 400, message: location.error });
      loaded.post.campusLocation = location.text;
    }
    if (req.body?.budgetMin !== undefined) {
      const budgetMin = parseBudget(req.body.budgetMin, 'Minimum budget');
      if (budgetMin.error) return errorResponse(res, { statusCode: 400, message: budgetMin.error });
      loaded.post.budgetMin = budgetMin.amount;
    }
    if (req.body?.budgetMax !== undefined) {
      const budgetMax = parseBudget(req.body.budgetMax, 'Maximum budget');
      if (budgetMax.error) return errorResponse(res, { statusCode: 400, message: budgetMax.error });
      loaded.post.budgetMax = budgetMax.amount;
    }
    if (loaded.post.budgetMin !== null && loaded.post.budgetMax !== null && loaded.post.budgetMin > loaded.post.budgetMax) {
      return errorResponse(res, { statusCode: 400, message: 'Minimum budget cannot be greater than maximum budget.' });
    }
    if (req.body?.categoryId !== undefined) {
      if (req.body.categoryId === null || req.body.categoryId === '') {
        loaded.post.category = null;
      } else if (!isValidObjectId(req.body.categoryId)) {
        return errorResponse(res, { statusCode: 400, message: 'Invalid category ID format.' });
      } else {
        const category = await Category.findById(req.body.categoryId).select('_id');
        if (!category) return errorResponse(res, { statusCode: 404, message: 'Category not found.' });
        loaded.post.category = category._id;
      }
    }

    await loaded.post.save();
    const post = await WantedPost.findById(loaded.post._id).populate(authorPopulate).populate(categoryPopulate);
    return successResponse(res, { statusCode: 200, message: 'Wanted post updated.', data: present(post) });
  } catch (error) {
    next(error);
  }
};

export const updateWantedPostStatus = async (req, res, next) => {
  try {
    const loaded = await loadEditable(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);
    const status = req.body?.status;
    if (typeof status !== 'string' || !Object.values(WANTED_STATUS).includes(status)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid wanted post status.' });
    }
    if (loaded.post.status !== WANTED_STATUS.ACTIVE) {
      return errorResponse(res, { statusCode: 409, message: 'This wanted post can no longer change status.' });
    }
    if (status === WANTED_STATUS.ACTIVE) {
      return errorResponse(res, { statusCode: 409, message: 'This wanted post is already active.' });
    }
    loaded.post.status = status;
    await loaded.post.save();
    return successResponse(res, { statusCode: 200, message: 'Wanted post status updated.', data: present(loaded.post) });
  } catch (error) {
    next(error);
  }
};

export const deleteWantedPost = async (req, res, next) => {
  try {
    const loaded = await loadEditable(req.params.id, req.user._id);
    if (loaded.error) return errorResponse(res, loaded.error);
    await loaded.post.deleteOne();
    return successResponse(res, { statusCode: 200, message: 'Wanted post deleted.', data: { _id: req.params.id } });
  } catch (error) {
    next(error);
  }
};

export const contactWantedAuthor = async (req, res, next) => {
  try {
    if (!req.user.isVerified) {
      return errorResponse(res, { statusCode: 403, message: 'You must verify your university email before contacting a student.' });
    }
    if (!isValidObjectId(req.params.id)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid wanted post ID format.' });
    }
    const post = await WantedPost.findById(req.params.id);
    if (!post || post.status !== WANTED_STATUS.ACTIVE) {
      return errorResponse(res, { statusCode: 404, message: 'Wanted post not found.' });
    }
    if (sameId(post.author, req.user._id)) {
      return errorResponse(res, { statusCode: 400, message: 'You cannot contact yourself about your own wanted post.' });
    }
    const author = await User.findById(post.author).select('isVerified status');
    if (!author || !author.isVerified || author.status !== ACCOUNT_STATUS.ACTIVE) {
      return errorResponse(res, { statusCode: 403, message: 'This student is not eligible to receive messages.' });
    }

    const participantIds = [req.user._id, author._id].sort((a, b) => String(a).localeCompare(String(b)));
    let conversation = await Conversation.findOne({
      $and: [
        { participants: { $all: participantIds } },
        { participants: { $size: 2 } },
        { product: null },
      ],
    });
    let createdNow = false;
    if (!conversation) {
      conversation = await Conversation.create({
        participants: participantIds,
        product: null,
        lastMessageAt: new Date(),
      });
      createdNow = true;
    }

    await createNotification({
      recipient: author._id,
      type: NOTIFICATION_TYPES.WANTED_POST_RESPONSE,
      title: 'Response to your wanted post',
      message: `A student wants to talk about "${post.title}".`,
      link: `/conversations/${conversation._id}`,
      relatedUser: req.user._id,
    });

    return successResponse(res, {
      statusCode: createdNow ? 201 : 200,
      message: createdNow ? 'Conversation started.' : 'Existing conversation reused.',
      data: { _id: conversation._id, wantedPostId: post._id },
    });
  } catch (error) {
    next(error);
  }
};
