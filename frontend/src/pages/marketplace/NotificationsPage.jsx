import React, { useEffect, useState } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import { notificationService } from '../../services/api';

const productLinkPattern = /^\/products\/([a-fA-F0-9]{24})$/;
const conversationLinkPattern = /^\/conversations\/([a-fA-F0-9]{24})$/;
const buyRequestLinkPattern = /^\/buy-requests\/([a-fA-F0-9]{24})$/;
const offerLinkPattern = /^\/offers\/([a-fA-F0-9]{24})$/;
const transactionLinkPattern = /^\/transactions\/([a-fA-F0-9]{24})$/;
const exchangeLinkPattern = /^\/exchange-requests\/([a-fA-F0-9]{24})$/;
const giveawayLinkPattern = /^\/giveaway-requests\/([a-fA-F0-9]{24})$/;
const wantedLinkPattern = /^\/wanted-posts\/([a-fA-F0-9]{24})$/;
const userLinkPattern = /^\/users\/([a-fA-F0-9]{24})$/;

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
};

export const NotificationsPage = ({ onNavigate, onUnreadChange }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await notificationService.getNotifications({ page: 1, limit: 20 });
      setNotifications(res?.data?.notifications || []);
    } catch (err) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    onUnreadChange?.();
  }, []);

  const handleOpen = async (notification) => {
    if (actionId) return;
    setActionId(notification._id);
    try {
      if (!notification.isRead) {
        await notificationService.markAsRead(notification._id);
        setNotifications((current) =>
          current.map((item) => (item._id === notification._id ? { ...item, isRead: true } : item))
        );
        onUnreadChange?.();
      }
      const productMatch = notification.link?.match(productLinkPattern);
      const conversationMatch = notification.link?.match(conversationLinkPattern);
      const buyRequestMatch = notification.link?.match(buyRequestLinkPattern);
      const offerMatch = notification.link?.match(offerLinkPattern);
      const transactionMatch = notification.link?.match(transactionLinkPattern);
      const exchangeMatch = notification.link?.match(exchangeLinkPattern);
      const giveawayMatch = notification.link?.match(giveawayLinkPattern);
      const wantedMatch = notification.link?.match(wantedLinkPattern);
      const userMatch = notification.link?.match(userLinkPattern);
      if (productMatch) {
        onNavigate('product-detail', productMatch[1]);
      } else if (conversationMatch) {
        onNavigate('messages', conversationMatch[1]);
      } else if (buyRequestMatch) {
        onNavigate('buy-requests', buyRequestMatch[1]);
      } else if (offerMatch) {
        onNavigate('offers', offerMatch[1]);
      } else if (transactionMatch) {
        onNavigate('transaction-detail', transactionMatch[1]);
      } else if (exchangeMatch) {
        onNavigate('exchange-requests', exchangeMatch[1]);
      } else if (giveawayMatch) {
        onNavigate('giveaway-requests', giveawayMatch[1]);
      } else if (wantedMatch) {
        onNavigate('wanted-post-detail', wantedMatch[1]);
      } else if (userMatch) {
        onNavigate('public-profile', userMatch[1]);
      }
    } catch (err) {
      setError(err.message || 'Could not update this notification.');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (event, notificationId) => {
    event.stopPropagation();
    if (actionId) return;
    setActionId(notificationId);
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications((current) => current.filter((item) => item._id !== notificationId));
      onUnreadChange?.();
    } catch (err) {
      setError(err.message || 'Could not delete this notification.');
    } finally {
      setActionId(null);
    }
  };

  const handleMarkAll = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await notificationService.markAllAsRead();
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      onUnreadChange?.();
    } catch (err) {
      setError(err.message || 'Could not mark notifications as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? 'Loading updates...' : `${unreadCount} unread on this page`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleMarkAll}
          disabled={markingAll || unreadCount === 0}
          className="py-2 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
        >
          {markingAll ? 'Marking...' : 'Mark all as read'}
        </button>
      </div>

      {loading && (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-sm text-slate-500">Loading notifications...</p>
        </div>
      )}

      {!loading && error && (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-3">
          <h2 className="text-base font-bold text-slate-900">Could not load notifications</h2>
          <p className="text-sm text-rose-600">{error}</p>
          <button
            onClick={loadNotifications}
            className="py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && notifications.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-3 shadow-sm">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
            <Bell className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">No notifications yet.</h2>
          <p className="text-sm text-slate-500">Updates about your wishlist items will show up here.</p>
        </div>
      )}

      {!loading && !error && notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <article
              key={notification._id}
              onClick={() => handleOpen(notification)}
              className={`rounded-2xl border p-4 flex items-start justify-between gap-4 cursor-pointer transition ${
                notification.isRead
                  ? 'bg-white border-slate-200'
                  : 'bg-indigo-50 border-indigo-200'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {!notification.isRead && <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>}
                  <h2 className="text-sm font-bold text-slate-900">{notification.title}</h2>
                </div>
                <p className="text-sm text-slate-600 mt-1">{notification.message}</p>
                <p className="text-[11px] text-slate-400 mt-2">{formatTime(notification.createdAt)}</p>
                {notification.link && (
                  <p className="text-[11px] font-semibold text-indigo-600 mt-2">View related item</p>
                )}
              </div>
              <button
                type="button"
                aria-label="Delete notification"
                disabled={actionId === notification._id}
                onClick={(event) => handleDelete(event, notification._id)}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
