import React from 'react';
import { ConversationItem } from './ConversationItem';

export const ConversationList = ({
  conversations,
  activeId,
  currentUserId,
  onSelect,
  loading,
  error,
  query,
  onQueryChange,
}) => {
  const normalized = query.trim().toLowerCase();
  const visible = normalized
    ? conversations.filter((conversation) =>
        (conversation.participants || []).some((person) => person?.name?.toLowerCase().includes(normalized))
      )
    : conversations;

  return (
    <div className="flex flex-col h-full min-h-[420px]">
      <div className="p-3 border-b border-slate-200">
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by name"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && <p className="text-xs text-slate-500 px-2 py-4">Loading conversations...</p>}
        {!loading && error && <p className="text-xs text-rose-600 px-2 py-4">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <p className="text-xs text-slate-500 px-2 py-6 text-center">No conversations yet.</p>
        )}
        {!loading &&
          !error &&
          visible.map((conversation) => (
            <ConversationItem
              key={conversation._id}
              conversation={conversation}
              active={conversation._id === activeId}
              currentUserId={currentUserId}
              onSelect={onSelect}
            />
          ))}
      </div>
    </div>
  );
};
