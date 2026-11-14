import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const GlobalSearchBar = ({
  value = '',
  onChange,
  onSearch,
  className = '',
  autoFocus = false,
}) => {
  const { isBangla } = useLanguage();
  const [query, setQuery] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  // Synchronize internal query state with parent value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Global Ctrl + K / Cmd + K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleChange = (e) => {
    const newVal = e.target.value;
    setQuery(newVal);
    if (onChange) onChange(newVal);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(query.trim());
    }
  };

  const handleClear = () => {
    setQuery('');
    if (onChange) onChange('');
    if (onSearch) onSearch('');
    inputRef.current?.focus();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative w-full flex items-center transition-all duration-200 ${className}`}
      role="search"
    >
      <div
        className={`w-full flex items-center gap-2 px-3 py-1.5 xl:py-2 rounded-xl border transition-all duration-200 ${
          isFocused
            ? 'bg-white dark:bg-slate-900 border-indigo-500/80 dark:border-indigo-400 ring-3 ring-indigo-500/15 shadow-xs'
            : 'bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/90 dark:border-slate-700/80'
        }`}
      >
        <button
          type="submit"
          className="p-0 border-0 bg-transparent text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer shrink-0"
          title={isBangla ? 'খুঁজুন' : 'Search'}
        >
          <Search className="w-4 h-4 shrink-0" />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={
            isBangla
              ? 'বই, ক্যালকুলেটর, খাতা খুঁজুন...'
              : 'Search books, calculators, notes...'
          }
          className="w-full bg-transparent text-xs xl:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none border-none p-0 font-medium"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer shrink-0"
            title={isBangla ? 'মুছে ফেলুন' : 'Clear search'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </form>
  );
};

export default GlobalSearchBar;
