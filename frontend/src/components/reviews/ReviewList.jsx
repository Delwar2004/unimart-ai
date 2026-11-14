import { RatingStars } from './RatingStars';

const formatWhen = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

export const ReviewList = ({ reviews = [], currentUserId, onReport, emptyLabel = 'No reviews yet.' }) => {
  if (!reviews.length) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {reviews.map((review) => {
        const mine = currentUserId && String(review.reviewer?._id) === String(currentUserId);
        return (
          <li key={review._id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-sm font-bold text-indigo-700">
                  {review.reviewer?.name?.charAt(0) || 'S'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{review.reviewer?.name || 'Student'}</p>
                  <p className="text-[11px] text-slate-500">{formatWhen(review.createdAt)}</p>
                </div>
              </div>
              <RatingStars value={review.rating} readOnly size="sm" />
            </div>
            {review.comment ? <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{review.comment}</p> : null}
            {onReport && !mine ? (
              <button
                type="button"
                onClick={() => onReport(review)}
                className="mt-2 text-xs font-semibold text-slate-500 hover:text-rose-700 cursor-pointer"
              >
                Report review
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
};
