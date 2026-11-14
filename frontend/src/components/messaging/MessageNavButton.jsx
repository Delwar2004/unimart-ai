import React from 'react';
import { MessageCircle } from 'lucide-react';

export const MessageNavButton = ({ count = 0, active = false, onClick }) => {
  const label = count > 0 ? `Messages, ${count} unread` : 'Messages';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`relative p-2 rounded-xl transition-all cursor-pointer ${
        active 
          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800' 
          : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/90 dark:hover:bg-slate-800'
      }`}
    >
      <MessageCircle className="w-5 h-5 shrink-0" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-4.5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-black leading-4.5 text-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
};
