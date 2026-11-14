import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Bot,
  Send,
  X,
  RotateCcw,
  ExternalLink,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { aiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const STARTER_QUESTIONS = [
  'How do I list an item for sale?',
  'How does product exchange work?',
  'How are transactions safely confirmed?',
  'How do I use AI natural language search?',
  'How do I report a suspicious listing?',
];

const STARTER_QUESTIONS_BN = [
  'কীভাবে বিক্রয়ের জন্য একটি পণ্য যুক্ত করব?',
  'পণ্য বিনিময় (Exchange) কীভাবে কাজ করে?',
  'নিরাপদে ক্যাম্পাস লেনদেন কীভাবে নিশ্চিত করব?',
  'এআই সার্চ কীভাবে ব্যবহার করতে পারি?',
  'সন্দেহজনক লিস্টিং কীভাবে রিপোর্ট করব?',
];

const ALLOWED_DESTINATIONS = [
  'browse-products',
  'create-listing',
  'my-listings',
  'wishlist',
  'transactions',
  'messages',
  'buy-requests',
  'offers',
  'exchange-requests',
  'giveaway-requests',
  'wanted-posts',
  'my-reports',
  'profile',
];

export const MarketplaceAssistant = ({ onNavigate, isOpen, onClose, onToggle }) => {
  const { user, isAuthenticated } = useAuth();
  const { t, isBangla } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFailedMessage, setLastFailedMessage] = useState('');
  const [expanded, setExpanded] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages]);

  const handleSendMessage = async (customText = null) => {
    const textToSend = typeof customText === 'string' ? customText : inputText;
    if (!textToSend || !textToSend.trim()) return;

    if (!isAuthenticated) {
      setError(isBangla ? 'সহকারীর সাথে চ্যাট করতে সাইন ইন করুন।' : 'Please sign in with your student account to chat with the assistant.');
      return;
    }

    if (!user?.isVerified) {
      setError(isBangla ? 'সহকারী ব্যবহারের পূর্বে ইমেইল ভেরিফাই করুন।' : 'You must verify your university email before using the assistant.');
      return;
    }

    const trimmed = textToSend.trim();
    if (trimmed.length > 2000) {
      setError(isBangla ? 'বার্তা ২০০০ অক্ষরের বেশি হতে পারবে না।' : 'Message cannot exceed 2000 characters.');
      return;
    }

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);
    setError('');
    setLastFailedMessage('');

    try {
      const res = await aiService.askAssistant({ message: trimmed });
      if (res?.success && res.data) {
        const assistantMsg = {
          id: Date.now() + 1,
          sender: 'assistant',
          text: res.data.answer || res.data.reply || (isBangla ? 'দুঃখিত, কোনো উত্তর পাওয়া যায়নি।' : 'No response text available.'),
          suggestedActions: Array.isArray(res.data.suggestedActions) ? res.data.suggestedActions : [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setError(res?.message || (isBangla ? 'সহকারী প্রতিক্রিয়া দিতে ব্যর্থ হয়েছে।' : 'Failed to get a response from the assistant.'));
        setLastFailedMessage(trimmed);
      }
    } catch (err) {
      setError(err.message || (isBangla ? 'নেটওয়ার্ক ত্রুটি ঘটেছে।' : 'A network error occurred. Please try again.'));
      setLastFailedMessage(trimmed);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    setError('');
    setLastFailedMessage('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleActionClick = (action) => {
    const dest = action.destination || action.payload;
    if (action.actionType === 'navigate' && dest && ALLOWED_DESTINATIONS.includes(dest)) {
      onNavigate(dest);
      onClose();
    }
  };

  const activeStarters = isBangla ? STARTER_QUESTIONS_BN : STARTER_QUESTIONS;

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={onToggle}
        aria-label="Open UniMart AI Assistant"
        className="fixed bottom-6 right-6 z-40 group flex items-center gap-2.5 px-4 sm:px-5 py-3 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/35 hover:shadow-2xl hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer ring-2 ring-white/30 dark:ring-white/10"
      >
        <div className="relative">
          <Sparkles className="w-5 h-5 text-amber-300 group-hover:rotate-12 transition-transform duration-300" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
        </div>
        <span className="font-extrabold text-xs sm:text-sm tracking-wide hidden sm:inline">
          {t('ask_ai')}
        </span>
      </button>

      {/* Slide-over / Modal Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-20 right-4 sm:right-6 z-50 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-6 ${
            expanded ? 'w-[94vw] sm:w-[680px] h-[80vh]' : 'w-[92vw] sm:w-[420px] h-[580px]'
          }`}
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                  <span>{t('ai_assistant_title')}</span>
                  <span className="text-[9px] uppercase tracking-wider bg-white/25 px-1.5 py-0.5 rounded font-black">
                    BUP
                  </span>
                </h3>
                <p className="text-[11px] text-indigo-100">
                  {isBangla ? 'স্মার্ট ক্যাম্পাস গাইড ও দরদাম সহকারী' : 'Verified Campus Knowledge & Pricing Guide'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={handleClearHistory}
                title="Clear chat"
                className="p-1.5 rounded-lg hover:bg-white/20 text-indigo-100 hover:text-white transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                title={expanded ? 'Minimize' : 'Expand'}
                className="p-1.5 rounded-lg hover:bg-white/20 text-indigo-100 hover:text-white transition cursor-pointer"
              >
                {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="p-1.5 rounded-lg hover:bg-white/20 text-indigo-100 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Conversation Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/60 dark:bg-slate-950/60 text-xs">
            {messages.length === 0 && (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs border border-indigo-100 dark:border-indigo-900/60">
                  <Bot className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                    {isBangla ? 'ইউনিমর্ট এআই সহকারীতে স্বাগতম!' : 'Welcome to UniMart AI Assistant!'}
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                    {isBangla
                      ? 'পাঠ্যবই লিস্টিং, দরদাম, বিনিময় বা ক্যাম্পাস হ্যান্ডওভার সম্পর্কে যেকোনো প্রশ্ন করুন।'
                      : 'Ask me anything about textbooks, market prices, safe trade, or campus handover.'}
                  </p>
                </div>

                {/* Suggested Questions */}
                <div className="space-y-1.5 text-left pt-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    {isBangla ? 'পরামর্শকৃত প্রশ্নসমূহ' : 'Suggested Questions'}
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {activeStarters.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(q)}
                        className="w-full text-left p-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50/60 dark:hover:bg-slate-750 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer flex items-center justify-between group shadow-2xs"
                      >
                        <span className="line-clamp-1">{q}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Message Stream */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} space-y-1`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* Action Badges */}
                {msg.sender === 'assistant' && msg.suggestedActions?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 max-w-[85%]">
                    {msg.suggestedActions.map((action, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleActionClick(action)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 shadow-2xs transition cursor-pointer"
                      >
                        <span>{action.label}</span>
                        <ExternalLink className="w-3 h-3 text-indigo-500" />
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-[10px] text-slate-400 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-start space-x-2">
                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-bl-none shadow-2xs flex items-center space-x-1.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            {/* Error Feedback with Retry */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 flex items-start justify-between gap-2">
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {lastFailedMessage && (
                  <button
                    type="button"
                    onClick={() => handleSendMessage(lastFailedMessage)}
                    className="text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:underline shrink-0 cursor-pointer"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input & Footer */}
          <div className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 space-y-2">
            {!isAuthenticated ? (
              <div className="text-center py-2 text-xs text-slate-500 dark:text-slate-400">
                {isBangla ? 'সহকারীকে প্রশ্ন করতে অনুগ্রহ করে ' : 'Please '}
                <button
                  type="button"
                  onClick={() => onNavigate('login')}
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {t('sign_in')}
                </button>
                {isBangla ? ' করুন।' : ' to ask the assistant questions.'}
              </div>
            ) : !user?.isVerified ? (
              <div className="text-center py-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 rounded-xl px-2">
                {isBangla ? 'বিশ্ববিদ্যালয় ইমেইল ভেরিফিকেশন সম্পন্ন করুন।' : 'University email verification required to chat with the assistant.'}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    placeholder={t('ai_placeholder')}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60"
                  />
                  {inputText && (
                    <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">
                      {inputText.length}/2000
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading || !inputText.trim()}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white transition shadow-sm disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}

            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
              <span>UniMart AI Grounded Assistance</span>
              <span className="flex items-center gap-1">
                <HelpCircle className="w-3 h-3" /> Factual Campus Help
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
