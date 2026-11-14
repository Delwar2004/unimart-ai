import React, { useEffect, useState } from 'react';
import { transactionService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const STATUS_QUERY = {
  pending: 'PENDING',
  confirmed: 'confirmed',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

const statusLabel = (status) => {
  if (status === 'CONFIRMED_BY_BUYER') return 'Confirmed by buyer';
  if (status === 'CONFIRMED_BY_SELLER') return 'Confirmed by seller';
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Pending';
};

const formatWhen = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

export const TransactionsPage = ({ onNavigate, onActiveChange }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState('all');
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentUserId = user?.id || user?._id;

  const load = async (nextTab = tab, nextFilter = filter) => {
    setLoading(true);
    setError('');
    try {
      const params = { page: 1, limit: 20 };
      if (nextTab === 'purchases') params.participation = 'purchase';
      if (nextTab === 'sales') params.participation = 'sale';
      if (STATUS_QUERY[nextFilter]) params.status = STATUS_QUERY[nextFilter];
      const res = await transactionService.getTransactions(params);
      setItems(res?.data?.transactions || []);
    } catch (err) {
      setError(err.message || 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(tab, filter);
    onActiveChange?.();
  }, [tab, filter]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
        <p className="text-sm text-slate-500 mt-1">
          Marketplace records opened from an accepted buy request, offer, or giveaway. This does not move money.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['all', 'All'],
          ['purchases', 'Purchases'],
          ['sales', 'Sales'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              tab === value ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
              filter === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading transactions...</p>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
          No transactions in this view.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isBuyer = String(item.buyer?._id) === String(currentUserId);
            const other = isBuyer ? item.seller : item.buyer;
            return (
              <article key={item._id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('transaction-detail', item._id)}
                    className="text-sm font-bold text-slate-900 hover:text-indigo-600 cursor-pointer text-left"
                  >
                    {item.product?.title || 'Listing'}
                  </button>
                  <span className="inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide bg-slate-50 text-slate-700 border-slate-200">
                    {statusLabel(item.status)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {isBuyer ? 'Purchase' : 'Sale'} · {statusLabel(item.status)} · {item.agreedPrice} {item.product?.currency || 'BDT'}
                </p>
                <p className="text-xs text-slate-500">
                  {isBuyer ? 'Seller' : 'Buyer'}: {other?.name || 'Student'} · Source: {item.sourceType === 'OFFER' ? 'Offer' : item.sourceType === 'GIVEAWAY_REQUEST' ? 'Giveaway' : 'Buy request'}
                </p>
                <p className="text-[11px] text-slate-400">{formatWhen(item.createdAt)}</p>
                <p className="text-[11px] text-slate-500">
                  Buyer confirmed: {item.buyerConfirmed ? 'Yes' : 'No'} · Seller confirmed: {item.sellerConfirmed ? 'Yes' : 'No'}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
