import React, { useState } from 'react';
import { Send } from 'lucide-react';

const MAX_LENGTH = 2000;

export const MessageComposer = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    try {
      const sent = await onSend(trimmed);
      if (sent !== false) setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      className="border-t border-slate-200 p-3 flex items-end gap-2 bg-white"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        value={text}
        maxLength={MAX_LENGTH}
        rows={2}
        disabled={disabled || sending}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Write a message"
        className="flex-1 resize-none px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || sending || !text.trim()}
        className="h-10 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold"
      >
        <Send className="w-3.5 h-3.5" />
        {sending ? 'Sending' : 'Send'}
      </button>
    </form>
  );
};
