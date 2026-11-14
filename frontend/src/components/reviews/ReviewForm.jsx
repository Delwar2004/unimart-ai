import { useState } from 'react';
import { RatingStars } from './RatingStars';

const MAX_COMMENT = 1000;

export const ReviewForm = ({
  initialRating = 0,
  initialComment = '',
  submitLabel = 'Submit review',
  onSubmit,
  onCancel,
  disabled = false,
}) => {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setError('Choose a rating from 1 to 5.');
      return;
    }
    if (comment.trim().length > MAX_COMMENT) {
      setError(`Comment cannot exceed ${MAX_COMMENT} characters.`);
      return;
    }
    setError('');
    await onSubmit?.({ rating, comment: comment.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-1">Rating</p>
        <RatingStars value={rating} onChange={setRating} />
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-600">Comment (optional)</span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={MAX_COMMENT}
          rows={3}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="How did the handoff go?"
        />
      </label>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer"
        >
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 cursor-pointer">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
};
