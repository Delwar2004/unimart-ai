import { useState } from 'react';
import { giveawayRequestService } from '../../services/api';

const GiveawayRequestForm = ({ product, onClose, onCreated }) => {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await giveawayRequestService.create({ productId: product._id, message: message.trim() });
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">Request this giveaway</p>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Tell the owner why this would help you."
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {submitting ? 'Sending...' : 'Send giveaway request'}
        </button>
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default GiveawayRequestForm;
