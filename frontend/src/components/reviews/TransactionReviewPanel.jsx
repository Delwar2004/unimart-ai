import { useEffect, useState } from 'react';
import { reviewService } from '../../services/api';
import { ReviewForm } from './ReviewForm';
import { RatingStars } from './RatingStars';

export const TransactionReviewPanel = ({ transactionId }) => {
  const [eligibility, setEligibility] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!transactionId) return;
    const response = await reviewService.checkEligibility(transactionId);
    setEligibility(response?.data || null);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message || 'Could not check review eligibility.'));
  }, [transactionId]);

  if (!transactionId) return null;

  const submit = async (payload) => {
    setBusy(true);
    setError('');
    try {
      await reviewService.create({ transactionId, ...payload });
      setEditing(false);
      await load();
    } catch (err) {
      setError(err.message || 'Could not publish this review.');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (payload) => {
    if (!eligibility?.review?._id) return;
    setBusy(true);
    setError('');
    try {
      await reviewService.update(eligibility.review._id, payload);
      setEditing(false);
      await load();
    } catch (err) {
      setError(err.message || 'Could not update this review.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!eligibility?.review?._id) return;
    setBusy(true);
    setError('');
    try {
      await reviewService.delete(eligibility.review._id);
      setEditing(false);
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete this review.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <h3 className="text-sm font-bold text-slate-900">Review</h3>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {!eligibility ? <p className="text-xs text-slate-500">Checking whether you can review...</p> : null}
      {eligibility?.eligible ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">Leave a Review</p>
          <ReviewForm onSubmit={submit} disabled={busy} />
        </div>
      ) : null}
      {eligibility && !eligibility.eligible && eligibility.review ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">Your Review</p>
          {editing ? (
            <ReviewForm
              initialRating={eligibility.review.rating}
              initialComment={eligibility.review.comment || ''}
              submitLabel="Save review"
              onSubmit={saveEdit}
              onCancel={() => setEditing(false)}
              disabled={busy}
            />
          ) : (
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <RatingStars value={eligibility.review.rating} readOnly size="sm" />
              {eligibility.review.comment ? <p className="mt-2 text-sm text-slate-700">{eligibility.review.comment}</p> : null}
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-indigo-700 cursor-pointer">Edit</button>
                <button type="button" onClick={remove} disabled={busy} className="text-xs font-semibold text-rose-700 cursor-pointer">Delete</button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
};
