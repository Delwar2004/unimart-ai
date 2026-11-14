import React from 'react';

export const PendingNavButton = ({ label, icon: Icon, count = 0, active = false, onClick }) => {
  const accessible = count > 0 ? `${label}, ${count} pending` : label;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={accessible}
      title={label}
      className={`relative inline-flex items-center gap-1.5 px-2.5 2xl:px-3 py-1.5 rounded-xl text-xs xl:text-sm font-semibold transition-all cursor-pointer shrink-0 ${
        active 
          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800 shadow-xs' 
          : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/90 dark:hover:bg-slate-800'
      }`}
    >
      <Icon className="w-4.5 h-4.5 shrink-0" />
      <span className="hidden 2xl:inline whitespace-nowrap">{label}</span>
      {count > 0 && (
        <span className="min-w-[18px] h-4.5 px-1 rounded-full bg-amber-500 text-white text-[11px] font-black leading-4.5 text-center shrink-0">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
};
