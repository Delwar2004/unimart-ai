import React, { useState } from 'react';
import { X } from 'lucide-react';
import { offerService } from '../../services/api';

const MAX_MESSAGE = 1000;
const MAX_AMOUNT = 10000000;

export const OfferForm = ({ product, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = message.trim();
    const numeric = Number(amount);

    if (amount.trim() === '' || !Number.isFinite(numeric)) {
      setError('Enter a numeric offer amount.');
      return;
    }
    if (numeric < 0) {
      setError('Offer amount cannot be negative.');
      return;
    }
    if (numeric === 0) {
      setError('Offer amount must be greater than zero.');
      return;
    }
    if (numeric > MAX_AMOUNT) {
      setError(`Offer amount cannot exceed ${MAX_AMOUNT}.`);
      return;
    }
    if (trimmed.length > MAX_MESSAGE) {
      setError(`Message cannot exceed ${MAX_MESSAGE} characters.`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await offerService.create({
        productId: product._id,
        amount: Math.round(numeric * 100) / 100,
        message: trimmed,
      });
      onSuccess?.(res);
    } catch (err) {
      setError(err.message || 'Could not send the offer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/40 flex items-end sm:items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Make an Offer</h2>
            <p className="text-xs text-slate-500 mt-1">The seller can accept or decline. Accepting an offer does not complete a sale.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm space-y-1">
          <p className="font-semibold text-slate-900">{product.title}</p>
          <p className="text-xs text-slate-500">Seller: {product.seller?.name || 'Student'}</p>
          <p className="text-xs text-slate-500">Listed price: {product.price} {product.currency || 'BDT'}</p>
          <p className="text-xs text-slate-500 capitalize">Condition: {product.condition}</p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Offer amount ({product.currency || 'BDT'})</span>
          <input
            type="number"
            min="0"
            max={MAX_AMOUNT}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="2200"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Message (optional)</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={MAX_MESSAGE}
            rows={3}
            placeholder="Can you accept 2200 BDT?"
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
            {submitting ? 'Sending...' : 'Send Offer'}
          </button>
        </div>
      </form>
    </div>
  );
};
