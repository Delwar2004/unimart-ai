import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { conversationService } from '../../services/api';
import { ConversationList } from '../../components/messaging/ConversationList';
import { MessageList } from '../../components/messaging/MessageList';
import { MessageComposer } from '../../components/messaging/MessageComposer';

const currentUserIdOf = (user) => user?.id || user?._id || '';

export const MessagesPage = ({ onNavigate, initialConversationId, onUnreadChange }) => {
  const { user } = useAuth();
  const currentUserId = String(currentUserIdOf(user));
  const [conversations, setConversations] = useState([]);
  const [query, setQuery] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [hasEarlier, setHasEarlier] = useState(false);
  const [earlierPage, setEarlierPage] = useState(1);

  const loadConversations = async () => {
    setListLoading(true);
    setListError('');
    try {
      const res = await conversationService.getConversations({ page: 1, limit: 50 });
      setConversations(res?.data?.conversations || []);
    } catch (err) {
      setListError(err.message || 'Failed to load conversations.');
    } finally {
      setListLoading(false);
    }
  };

  const openConversation = async (conversationOrId) => {
    const id = typeof conversationOrId === 'string' ? conversationOrId : conversationOrId?._id;
    if (!id) return;

    setMessageLoading(true);
    setMessageError('');
    try {
      const [conversationRes, messageRes] = await Promise.all([
        conversationService.getConversation(id),
        conversationService.getMessages(id, { page: 1, limit: 50 }),
      ]);
      const conversation = conversationRes?.data;
      setSelected(conversation);
      setMessages(messageRes?.data?.messages || []);
      setHasEarlier(Boolean(messageRes?.data?.pagination?.hasNextPage));
      setEarlierPage(1);
      await conversationService.markConversationRead(id);
      setConversations((current) =>
        current.map((item) => (item._id === id ? { ...item, unreadCount: 0 } : item))
      );
      if (conversation) {
        setSelected({ ...conversation, unreadCount: 0 });
      }
      onUnreadChange?.();
    } catch (err) {
      setMessageError(err.message || 'Could not open this conversation.');
    } finally {
      setMessageLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
    onUnreadChange?.();
  }, []);

  useEffect(() => {
    if (initialConversationId) {
      openConversation(initialConversationId);
    }
  }, [initialConversationId]);

  const handleSend = async (text) => {
    if (!selected?._id) return false;
    try {
      const res = await conversationService.sendMessage(selected._id, { text });
      if (res?.data) {
        setMessages((current) => [...current, res.data]);
        setConversations((current) => {
          const updated = current.map((item) =>
            item._id === selected._id
              ? {
                  ...item,
                  lastMessage: res.data,
                  lastMessageAt: res.data.createdAt,
                }
              : item
          );
          updated.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
          return updated;
        });
      }
      onUnreadChange?.();
      return true;
    } catch (err) {
      setMessageError(err.message || 'Could not send message.');
      return false;
    }
  };

  const loadEarlier = async () => {
    if (!selected?._id || !hasEarlier) return;
    const nextPage = earlierPage + 1;
    try {
      const res = await conversationService.getMessages(selected._id, { page: nextPage, limit: 50 });
      const older = res?.data?.messages || [];
      setMessages((current) => {
        const seen = new Set(current.map((message) => message._id));
        return [...older.filter((message) => !seen.has(message._id)), ...current];
      });
      setEarlierPage(nextPage);
      setHasEarlier(Boolean(res?.data?.pagination?.hasNextPage));
    } catch (err) {
      setMessageError(err.message || 'Could not load earlier messages.');
    }
  };

  const other = (selected?.participants || []).find((person) => String(person?._id) !== currentUserId);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-slate-900">Messages</h1>
        <p className="text-sm text-slate-500 mt-1">Chat with other verified students about a listing.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        <aside className={`lg:col-span-4 border-r border-slate-200 ${selected ? 'hidden lg:block' : 'block'}`}>
          <ConversationList
            conversations={conversations}
            activeId={selected?._id}
            currentUserId={currentUserId}
            onSelect={openConversation}
            loading={listLoading}
            error={listError}
            query={query}
            onQueryChange={setQuery}
          />
        </aside>

        <section className={`lg:col-span-8 flex flex-col min-h-[640px] ${selected ? 'flex' : 'hidden lg:flex'}`}>
          {!selected && (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <p className="text-sm text-slate-500">Select a conversation or message a seller from a listing.</p>
            </div>
          )}

          {selected && (
            <>
              <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="lg:hidden inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Conversations
                  </button>
                  <h2 className="text-sm font-bold text-slate-900 truncate">{other?.name || 'Student'}</h2>
                  <p className="text-[11px] text-slate-500 truncate">
                    {[other?.department, other?.batch, other?.campusLocation].filter(Boolean).join(' · ') || 'Verified student'}
                  </p>
                </div>
                {selected.product?.title && (
                  <button
                    type="button"
                    onClick={() => onNavigate('product-detail', selected.product._id)}
                    className="text-right text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer max-w-[180px]"
                  >
                    {selected.product.title}
                    <span className="block text-slate-400 font-medium capitalize">{selected.product.status}</span>
                  </button>
                )}
              </div>

              <MessageList
                messages={messages}
                currentUserId={currentUserId}
                loading={messageLoading}
                error={messageError}
                hasEarlier={hasEarlier}
                onLoadEarlier={loadEarlier}
              />
              <MessageComposer onSend={handleSend} disabled={messageLoading && messages.length === 0} />
            </>
          )}
        </section>
      </div>
    </div>
  );
};
