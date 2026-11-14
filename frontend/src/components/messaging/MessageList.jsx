import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';

export const MessageList = ({ messages, currentUserId, loading, error, hasEarlier, onLoadEarlier }) => {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
      {hasEarlier && (
        <div className="text-center">
          <button
            type="button"
            onClick={onLoadEarlier}
            className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
          >
            Load earlier messages
          </button>
        </div>
      )}
      {loading && <p className="text-xs text-slate-500 text-center">Loading messages...</p>}
      {!loading && error && <p className="text-xs text-rose-600 text-center">{error}</p>}
      {!loading && !error && messages.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-8">Send a message to start the conversation.</p>
      )}
      {messages.map((message) => (
        <MessageBubble
          key={message._id}
          message={message}
          own={String(message.sender) === String(currentUserId)}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
};
