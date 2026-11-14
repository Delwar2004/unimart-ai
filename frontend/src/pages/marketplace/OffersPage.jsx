import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { offerService, conversationService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { InterestStatusBadge } from '../../components/marketplace/InterestStatusBadge';

const STATUSES = ['all', 'pending', 'accepted', 'rejected', 'cancelled'];

const formatWhen = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

export const OffersPage = ({ onNavigate, focusId = null, onPendingChange }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState('sent');
  const [status, setStatus] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [highlightId, setHighlightId] = useState(focusId);

  const currentUserId = user?.id || user?._id;

  const load = async (nextTab = tab, nextStatus = status) => {
    setLoading(true);
    setError('');
    try {
      const params = { page: 1, limit: 20 };
      if (nextStatus !== 'all') params.status = nextStatus;
      const res = nextTab === 'received'
        ? await offerService.getReceived(params)
        : await offerService.getSent(params);
      setItems(res?.data?.offers || []);
    } catch (err) {
      setError(err.message || 'Failed to load offers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(tab, status);
    onPendingChange?.();
  }, [tab, status]);

  useEffect(() => {
    if (!focusId || !currentUserId) return;
    let cancelled = false;
    offerService
      .getById(focusId)
      .then((res) => {
        if (cancelled || !res?.data) return;
        const isBuyer = String(res.data.buyer?._id) === String(currentUserId);
        setHighlightId(res.data._id);
        setTab(isBuyer ? 'sent' : 'received');
        setStatus('all');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [focusId, currentUserId]);

  const runAction = async (id, action) => {
    if (actionId) return;
    setActionId(id);
    setError('');
    try {
      if (action === 'cancel') await offerService.cancel(id);
      if (action === 'accept') await offerService.accept(id);
      if (action === 'reject') await offerService.reject(id);
      await load();
      onPendingChange?.();
    } catch (err) {
      setError(err.message || 'Could not update this offer.');
    } finally {
      setActionId(null);
    }
  };

  const handleMessage = async (item) => {
    if (actionId) return;
    const isBuyer = String(item.buyer?._id) === String(currentUserId);
    const recipientId = isBuyer ? item.seller?._id : item.buyer?._id;
    if (!recipientId) return;
    setActionId(item._id);
    setError('');
    try {
      const res = await conversationService.createConversation({
        recipientId,
        productId: item.product?._id,
      });
      if (res?.data?._id) onNavigate('messages', res.data._id);
    } catch (err) {
      setError(err.message || 'Could not open the conversation.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Offers</h1>
        <p className="text-sm text-slate-500 mt-1">
          Make a price offer on a sale listing, or respond to offers on your items. Accepting an offer opens a transaction and reserves the listing.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {['sent', 'received'].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              tab === value ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            {value === 'sent' ? 'Sent Offers' : 'Received Offers'}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize cursor-pointer ${
              status === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading offers...</p>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
          No offers in this view.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isBuyer = String(item.buyer?._id) === String(currentUserId);
            const other = isBuyer ? item.seller : item.buyer;
            const busy = actionId === item._id;
            return (
              <article
                key={item._id}
                className={`bg-white border rounded-2xl p-4 space-y-3 ${
                  highlightId === item._id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => item.product?._id && onNavigate('product-detail', item.product._id)}
                      className="text-sm font-bold text-slate-900 hover:text-indigo-600 cursor-pointer text-left"
                    >
                      {item.product?.title || 'Listing'}
                    </button>
                    <p className="text-xs text-slate-500 mt-1">
                      Offer: {item.amount} {item.product?.currency || 'BDT'} · Listed {item.product?.price} {item.product?.currency || 'BDT'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {isBuyer ? 'Seller' : 'Buyer'}: {other?.name || 'Student'}
                    </p>
                  </div>
                  <InterestStatusBadge status={item.status} />
                </div>
                {item.message && <p className="text-sm text-slate-700 whitespace-pre-line">{item.message}</p>}
                <p className="text-[11px] text-slate-400">{formatWhen(item.createdAt)}</p>
                <div className="flex flex-wrap gap-2">
                  {isBuyer && item.status === 'pending' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runAction(item._id, 'cancel')}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 disabled:opacity-60 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  {!isBuyer && item.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(item._id, 'accept')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(item._id, 'reject')}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleMessage(item)}
                    className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-60 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {isBuyer ? 'Message seller' : 'Message buyer'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
