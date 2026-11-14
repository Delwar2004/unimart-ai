import { Notification } from '../models/Notification.js';
import { Wishlist } from '../models/Wishlist.js';
import { NOTIFICATION_TYPES, PRODUCT_STATUS } from '../constants/index.js';

const REQUIRED_FIELDS = ['recipient', 'type', 'title', 'message'];

const isUsablePayload = (payload) => {
  if (!payload || typeof payload !== 'object') return false;
  return REQUIRED_FIELDS.every((field) => payload[field] !== undefined && payload[field] !== null && payload[field] !== '');
};

/**
 * Create a single notification. Returns null instead of throwing.
 */
export const createNotification = async (payload) => {
  try {
    if (!isUsablePayload(payload)) return null;

    return await Notification.create({
      recipient: payload.recipient,
      type: payload.type,
      title: String(payload.title).trim(),
      message: String(payload.message).trim(),
      link: payload.link ? String(payload.link).trim() : '',
      relatedProduct: payload.relatedProduct || undefined,
      relatedUser: payload.relatedUser || undefined,
      isRead: false,
    });
  } catch (error) {
    console.error(`[Notification] Failed to create notification: ${error.message}`);
    return null;
  }
};

/**
 * Create many notifications. Skips invalid payloads and does not throw.
 */
export const createNotifications = async (payloads = []) => {
  try {
    const docs = (Array.isArray(payloads) ? payloads : [])
      .filter(isUsablePayload)
      .map((payload) => ({
        recipient: payload.recipient,
        type: payload.type,
        title: String(payload.title).trim(),
        message: String(payload.message).trim(),
        link: payload.link ? String(payload.link).trim() : '',
        relatedProduct: payload.relatedProduct || undefined,
        relatedUser: payload.relatedUser || undefined,
        isRead: false,
      }));

    if (docs.length === 0) return [];

    return await Notification.insertMany(docs, { ordered: false });
  } catch (error) {
    console.error(`[Notification] Failed to create notifications: ${error.message}`);
    return error.insertedDocs || [];
  }
};

/**
 * Unread count for one recipient. Returns 0 if the lookup fails.
 */
export const getUnreadNotificationCount = async (userId) => {
  try {
    if (!userId) return 0;
    return await Notification.countDocuments({ recipient: userId, isRead: false });
  } catch (error) {
    console.error(`[Notification] Failed to count unread notifications: ${error.message}`);
    return 0;
  }
};

/**
 * Notify users who wishlisted a product when it leaves the available state.
 * Failures are logged and swallowed so product updates can continue.
 */
export const notifyWishlistOnStatusChange = async (product, previousStatus, nextStatus) => {
  try {
    if (!product?._id) return { created: 0 };
    const soldFromOpenListing =
      nextStatus === PRODUCT_STATUS.SOLD &&
      (previousStatus === PRODUCT_STATUS.AVAILABLE || previousStatus === PRODUCT_STATUS.RESERVED);
    const hiddenWhileAvailable =
      previousStatus === PRODUCT_STATUS.AVAILABLE && nextStatus === PRODUCT_STATUS.INACTIVE;
    if (!soldFromOpenListing && !hiddenWhileAvailable) return { created: 0 };

    const entries = await Wishlist.find({ product: product._id }).select('user').lean();
    if (!entries.length) return { created: 0 };

    const type =
      nextStatus === PRODUCT_STATUS.SOLD
        ? NOTIFICATION_TYPES.WISHLIST_PRODUCT_SOLD
        : NOTIFICATION_TYPES.WISHLIST_PRODUCT_UNAVAILABLE;

    const recipientIds = [...new Set(entries.map((entry) => String(entry.user)).filter(Boolean))];
    if (!recipientIds.length) return { created: 0 };

    const existing = await Notification.find({
      recipient: { $in: recipientIds },
      relatedProduct: product._id,
      type,
      isRead: false,
    })
      .select('recipient')
      .lean();

    const alreadyNotified = new Set(existing.map((item) => String(item.recipient)));
    const title = 'Wishlist item unavailable';
    const message = `The product '${product.title}' is no longer available.`;
    const link = `/products/${product._id}`;

    const payloads = recipientIds
      .filter((recipientId) => !alreadyNotified.has(recipientId))
      .map((recipientId) => ({
        recipient: recipientId,
        type,
        title,
        message,
        link,
        relatedProduct: product._id,
      }));

    const created = await createNotifications(payloads);
    return { created: created.length };
  } catch (error) {
    console.error(`[Notification] Wishlist availability notify failed: ${error.message}`);
    return { created: 0, failed: true };
  }
};
