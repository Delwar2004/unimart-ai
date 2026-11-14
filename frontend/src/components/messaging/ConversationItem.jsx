import React from 'react';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const ConversationItem = ({ conversation, active, currentUserId, onSelect }) => {
  const other = (conversation.participants || []).find((person) => person?._id !== currentUserId) || conversation.participants?.[0];
  const preview = conversation.lastMessage?.text || 'No messages yet';

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation)}
      className={`w-full text-left px-3 py-3 rounded-xl border transition cursor-pointer ${
        active ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-transparent hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{other?.name || 'Student'}</p>
          <p className="text-xs text-slate-500 truncate mt-0.5">{preview}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-slate-400">{formatTime(conversation.lastMessageAt)}</p>
          {conversation.unreadCount > 0 && (
            <span className="inline-flex mt-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold items-center justify-center">
              {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
      {conversation.product?.title && (
        <p className="text-[10px] text-indigo-600 mt-1 truncate">About {conversation.product.title}</p>
      )}
    </button>
  );
};
