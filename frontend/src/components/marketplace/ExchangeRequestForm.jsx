import { useEffect, useState } from 'react';
import { exchangeRequestService, productService } from '../../services/api';

const ExchangeRequestForm = ({ product, userId, onClose, onCreated }) => {
  const [offerings, setOfferings] = useState([]);
  const [offeredProductId, setOfferedProductId] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const response = await productService.getProducts({ seller: userId, listingType: 'exchange', limit: 50 });
      const items = (response.data?.products || []).filter(
        (item) => item.status === 'available' && item.listingType === 'exchange' && item._id !== product._id
      );
      setOfferings(items);
      if (items[0]) setOfferedProductId(items[0]._id);
    };
    load().catch((err) => setError(err.message));
  }, [product._id, userId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!offeredProductId) {
      setError('Choose one of your available exchange listings.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await exchangeRequestService.create({
        requestedProductId: product._id,
        offeredProductId,
        message: message.trim(),
      });
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
      <p className="text-sm font-semibold text-slate-900">Request an exchange</p>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Your exchange listing</span>
        <select
          value={offeredProductId}
          onChange={(event) => setOfferedProductId(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
        >
          {offerings.length === 0 ? <option value="">No available exchange listings</option> : null}
          {offerings.map((item) => (
            <option key={item._id} value={item._id}>{item.title}</option>
          ))}
        </select>
      </label>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Would you like to exchange these items?"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {submitting ? 'Sending...' : 'Send exchange request'}
        </button>
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default ExchangeRequestForm;
