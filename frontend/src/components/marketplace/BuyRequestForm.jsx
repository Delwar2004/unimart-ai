import React, { useState } from 'react';
import { X } from 'lucide-react';
import { buyRequestService } from '../../services/api';

const MAX_MESSAGE = 1000;

const priceLabel = (product) => {
  if (product.listingType === 'giveaway') return 'Free giveaway';
  if (product.listingType === 'exchange') return 'Exchange listing';
  return `${product.price} ${product.currency || 'BDT'}`;
};

export const BuyRequestForm = ({ product, onClose, onSuccess }) => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length > MAX_MESSAGE) {
      setError(`Message cannot exceed ${MAX_MESSAGE} characters.`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await buyRequestService.create({
        productId: product._id,
        message: trimmed,
      });
      onSuccess?.(res);
    } catch (err) {
      setError(err.message || 'Could not send the buy request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/40 flex items-end sm:items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Request to Buy</h2>
            <p className="text-xs text-slate-500 mt-1">The seller can accept or decline. This does not complete a purchase.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm space-y-1">
          <p className="font-semibold text-slate-900">{product.title}</p>
          <p className="text-xs text-slate-500">Seller: {product.seller?.name || 'Student'}</p>
          <p className="text-xs text-slate-500">Price: {priceLabel(product)}</p>
          <p className="text-xs text-slate-500 capitalize">Condition: {product.condition}</p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Message (optional)</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={MAX_MESSAGE}
            rows={4}
            placeholder="I am interested in buying this item."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-[11px] text-slate-400">{message.trim().length}/{MAX_MESSAGE}</span>
        </label>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </form>
    </div>
  );
};
