import React from 'react';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { hour: 'numeric', minute: '2-digit' });
};

export const MessageBubble = ({ message, own }) => (
  <div className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
    <div
      className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
        own ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-800'
      }`}
    >
      <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
      <p className={`text-[10px] mt-1 ${own ? 'text-indigo-100' : 'text-slate-400'}`}>
        {formatTime(message.createdAt)}
        {own && message.isRead ? ' · Read' : ''}
      </p>
    </div>
  </div>
);
