import mongoose from 'mongoose';
import { REQUEST_STATUS } from '../constants/index.js';

export const MAX_PAGE_LIMIT = 50;
const USER_FIELDS = 'name avatarUrl department batch campusLocation';
const PRODUCT_FIELDS = 'title price currency condition listingType status images';

export const userPopulate = { path: 'buyer', select: USER_FIELDS };
export const sellerPopulate = { path: 'seller', select: USER_FIELDS };
export const productPopulate = { path: 'product', select: PRODUCT_FIELDS };

export const isValidObjectId = (value) => typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

const readQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

export const parsePagination = (query, defaultLimit = 20) => {
  const page = Math.max(1, parseInt(readQueryValue(query.page), 10) || 1);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(readQueryValue(query.limit), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

export const parseStatusFilter = (query) => {
  const raw = readQueryValue(query.status);
  if (raw === undefined || raw === null || raw === '') return { status: null };
  if (typeof raw !== 'string' || !Object.values(REQUEST_STATUS).includes(raw)) {
    return { error: 'Invalid status filter.' };
  }
  return { status: raw };
};

export const parseInterestMessage = (value, maxLength) => {
  if (value === undefined || value === null || value === '') {
    return { message: '' };
  }
  if (typeof value !== 'string') {
    return { error: 'Message must be plain text.' };
  }
  const message = value.trim();
  if (message.length > maxLength) {
    return { error: `Message cannot exceed ${maxLength} characters.` };
  }
  return { message };
};

export const parseOfferAmount = (value, maxAmount) => {
  if (typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value.trim())) {
    value = Number(value.trim());
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { error: 'Offer amount must be a valid number.' };
  }
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(value - rounded) > 1e-8) {
    return { error: 'Offer amount can have at most two decimal places.' };
  }
  if (rounded < 0) {
    return { error: 'Offer amount cannot be negative.' };
  }
  if (rounded > maxAmount) {
    return { error: `Offer amount cannot exceed ${maxAmount}.` };
  }
  return { amount: rounded };
};

export const toPublicUser = (user) => {
  if (!user || typeof user !== 'object' || !user._id) return null;
  return {
    _id: user._id,
    name: user.name,
    avatarUrl: user.avatarUrl || '',
    department: user.department || '',
    batch: user.batch || '',
    campusLocation: user.campusLocation || '',
  };
};

export const toPublicProduct = (product) => {
  if (!product || typeof product !== 'object' || !product._id) return null;
  return {
    _id: product._id,
    title: product.title,
    price: product.price,
    currency: product.currency,
    condition: product.condition,
    listingType: product.listingType,
    status: product.status,
    images: product.images || [],
  };
};

export const sameId = (left, right) => {
  if (!left || !right) return false;
  const leftId = left._id || left;
  const rightId = right._id || right;
  return leftId.toString() === rightId.toString();
};
