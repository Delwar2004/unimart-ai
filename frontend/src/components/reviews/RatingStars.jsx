const STAR = '★';

export const RatingStars = ({ value = 0, onChange, readOnly = false, size = 'md' }) => {
  const stars = [1, 2, 3, 4, 5];
  const className = size === 'sm' ? 'text-sm' : 'text-lg';

  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`} role={readOnly ? 'img' : 'group'} aria-label={`${value} out of 5 stars`}>
      {stars.map((star) => {
        const active = star <= value;
        if (readOnly) {
          return (
            <span key={star} className={active ? 'text-amber-500' : 'text-slate-300'}>
              {STAR}
            </span>
          );
        }
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            className={`cursor-pointer leading-none ${active ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
          >
            {STAR}
          </button>
        );
      })}
    </div>
  );
};
