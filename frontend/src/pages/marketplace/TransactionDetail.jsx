import React, { useEffect, useState } from 'react';
import { transactionService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TransactionReviewPanel } from '../../components/reviews/TransactionReviewPanel';

const MAX_REASON = 500;

const statusLabel = (status) => {
  if (status === 'CONFIRMED_BY_BUYER') return 'Confirmed by buyer';
  if (status === 'CONFIRMED_BY_SELLER') return 'Confirmed by seller';
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Pending';
};

const formatWhen = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const isActive = (status) => ['PENDING', 'CONFIRMED_BY_BUYER', 'CONFIRMED_BY_SELLER'].includes(status);

export const TransactionDetail = ({ transactionId, onNavigate, onActiveChange }) => {
  const { user } = useAuth();
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);
  const currentUserId = user?.id || user?._id;

  const load = async () => {
    if (!transactionId) {
      setError('No transaction selected.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await transactionService.getTransaction(transactionId);
      setTransaction(res?.data || null);
    } catch (err) {
      setError(err.message || 'Failed to load this transaction.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    onActiveChange?.();
  }, [transactionId]);

  const isBuyer = String(transaction?.buyer?._id) === String(currentUserId);
  const alreadyConfirmed = isBuyer ? transaction?.buyerConfirmed : transaction?.sellerConfirmed;
  const canAct = transaction && isActive(transaction.status);
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:5000';
  const image = transaction?.product?.images?.[0];
  const imageSrc = image?.url
    ? (image.url.startsWith('http') ? image.url : `${baseUrl}${image.url}`)
    : null;

  const handleConfirm = async () => {
    if (!canAct || alreadyConfirmed || acting) return;
    setActing(true);
    setError('');
    try {
      const res = await transactionService.confirmTransaction(transaction._id);
      setTransaction(res?.data || transaction);
      onActiveChange?.();
    } catch (err) {
      setError(err.message || 'Could not confirm this transaction.');
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    if (!canAct || acting) return;
    if (reason.trim().length > MAX_REASON) {
      setError(`Cancellation reason cannot exceed ${MAX_REASON} characters.`);
      return;
    }
    setActing(true);
    setError('');
    try {
      const res = await transactionService.cancelTransaction(transaction._id, {
        cancellationReason: reason.trim(),
      });
      setTransaction(res?.data || transaction);
      onActiveChange?.();
    } catch (err) {
      setError(err.message || 'Could not cancel this transaction.');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading transaction...</p>;
  }

  if (error && !transaction) {
    return (
      <div className="max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-3">
        <p className="text-sm text-rose-600">{error}</p>
        <button type="button" onClick={() => onNavigate('transactions')} className="text-xs font-semibold text-indigo-600 cursor-pointer">
          Back to transactions
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <button
        type="button"
        onClick={() => onNavigate('transactions')}
        className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
      >
        &larr; Back to transactions
      </button>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-full sm:w-40 h-40 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
            {imageSrc ? (
              <img src={imageSrc} alt={transaction.product?.title || 'Product'} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-slate-400">No photo</span>
            )}
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => transaction.product?._id && onNavigate('product-detail', transaction.product._id)}
              className="text-xl font-bold text-slate-900 hover:text-indigo-600 cursor-pointer text-left"
            >
              {transaction.product?.title || 'Listing'}
            </button>
            <p className="text-sm text-slate-600">Agreed price: {transaction.agreedPrice} {transaction.product?.currency || 'BDT'}</p>
            <p className="text-sm font-semibold text-indigo-700">{statusLabel(transaction.status)}</p>
            <p className="text-xs text-slate-500">
              Source: {transaction.sourceType === 'OFFER' ? 'Accepted offer' : transaction.sourceType === 'GIVEAWAY_REQUEST' ? 'Accepted giveaway request' : 'Accepted buy request'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Buyer</p>
            <p className="font-semibold text-slate-900">{transaction.buyer?.name || 'Student'}</p>
            <p className="text-xs text-slate-500">{transaction.buyer?.department} {transaction.buyer?.batch}</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Seller</p>
            <p className="font-semibold text-slate-900">{transaction.seller?.name || 'Student'}</p>
            <p className="text-xs text-slate-500">{transaction.seller?.department} {transaction.seller?.batch}</p>
          </div>
        </div>

        <div className="text-xs text-slate-500 space-y-1">
          <p>Created: {formatWhen(transaction.createdAt)}</p>
          <p>Buyer confirmed: {transaction.buyerConfirmed ? 'Yes' : 'No'}</p>
          <p>Seller confirmed: {transaction.sellerConfirmed ? 'Yes' : 'No'}</p>
          <p>Completed: {formatWhen(transaction.completedAt)}</p>
          {transaction.status === 'CANCELLED' && (
            <>
              <p>Cancelled: {formatWhen(transaction.cancelledAt)}</p>
              <p>Reason: {transaction.cancellationReason || 'No reason given'}</p>
            </>
          )}
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        {transaction.status === 'COMPLETED' ? <TransactionReviewPanel transactionId={transaction._id} /> : null}

        {canAct && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              Both students confirm when the exchange is done. Cancelling releases the listing if no other transaction is active.
            </p>
            {!alreadyConfirmed && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={acting}
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
              >
                {acting ? 'Saving...' : 'Confirm'}
              </button>
            )}
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-600">Cancellation reason (optional)</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={MAX_REASON}
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={handleCancel}
              disabled={acting}
              className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-700 text-xs font-semibold disabled:opacity-60 cursor-pointer"
            >
              Cancel transaction
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
