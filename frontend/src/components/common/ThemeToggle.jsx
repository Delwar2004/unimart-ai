import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export const ThemeToggle = ({ className = '' }) => {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`relative p-2 rounded-xl transition-all duration-200 cursor-pointer border select-none ${
        isDark
          ? 'bg-slate-800/90 text-amber-400 border-slate-700 hover:bg-slate-700 hover:border-amber-400/30'
          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/80 hover:text-indigo-600'
      } ${className}`}
      title={isDark ? t('theme_light') : t('theme_dark')}
      aria-label={isDark ? t('theme_light') : t('theme_dark')}
    >
      <div className="relative w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 rotate-0 hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 -rotate-12 hover:rotate-0" />
        )}
      </div>
    </button>
  );
};

export default ThemeToggle;

