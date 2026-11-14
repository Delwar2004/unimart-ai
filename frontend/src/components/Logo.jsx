import React from 'react';

/**
 * Standardized UniMart AI Logo Component
 * Uses the official brand artwork (Connected BUP Student Community).
 *
 * Props:
 * - size: 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
 * - variant: 'default' | 'horizontal' | 'full' | 'emblem' (default: 'horizontal' in navbar)
 * - showText: boolean (default: true)
 * - showSubtitle: boolean (default: false)
 * - subtitle: string (default: 'Connected BUP Student Community')
 * - clickable: boolean (default: true)
 * - onClick: function (called when clicked)
 * - className: string (extra wrapper classes)
 */
export const Logo = ({
  size = 'md',
  variant = 'horizontal',
  showText = true,
  showSubtitle = false,
  subtitle = 'Connected BUP Student Community',
  clickable = true,
  onClick,
  className = '',
}) => {
  const horizontalHeights = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-11',
    lg: 'h-12 sm:h-14',
    xl: 'h-16',
  };

  const fullHeights = {
    sm: 'h-16',
    md: 'h-24',
    lg: 'h-28 sm:h-32',
    xl: 'h-40',
  };

  const emblemHeights = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10 sm:h-11 sm:w-11',
    lg: 'h-14 w-14',
    xl: 'h-20 w-20',
  };

  const titleSizes = {
    sm: 'text-lg',
    md: 'text-xl sm:text-2xl',
    lg: 'text-2xl sm:text-3xl',
    xl: 'text-3xl sm:text-4xl',
  };

  const subtitleSizes = {
    sm: 'text-[9px]',
    md: 'text-[11px]',
    lg: 'text-xs',
    xl: 'text-sm',
  };

  const isInteractive = clickable && typeof onClick === 'function';

  const handleKeyDown = (e) => {
    if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  // Variant 1: Full vertical official artwork (used on Login, Register, Auth cards)
  if (variant === 'full') {
    return (
      <div
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onClick={isInteractive ? onClick : undefined}
        onKeyDown={handleKeyDown}
        className={`inline-flex flex-col items-center select-none shrink-0 transition-transform duration-150 ${
          isInteractive ? 'cursor-pointer hover:opacity-95 active:scale-[0.98]' : ''
        } ${className}`}
        title="UniMart AI - Connected BUP Student Community"
      >
        <div className="p-2 rounded-2xl bg-white/70 dark:bg-white/10 dark:backdrop-blur-sm shadow-xs border border-slate-200/50 dark:border-white/10">
          <img
            src="/unimart-logo.png"
            alt="UniMart AI - Connected BUP Student Community"
            className={`${fullHeights[size] || fullHeights.lg} w-auto object-contain drop-shadow-xs dark:brightness-105`}
          />
        </div>
      </div>
    );
  }

  // Variant 2: Horizontal official lockup (Emblem + UniMart AI artwork) - Default for navbar
  if (variant === 'horizontal') {
    return (
      <div
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onClick={isInteractive ? onClick : undefined}
        onKeyDown={handleKeyDown}
        className={`inline-flex items-center select-none shrink-0 transition-transform duration-150 ${
          isInteractive ? 'cursor-pointer hover:opacity-95 active:scale-[0.98]' : ''
        } ${className}`}
        title="UniMart AI"
      >
        <div className="flex items-center px-2 py-1 rounded-xl bg-transparent dark:bg-white/95 dark:shadow-sm dark:shadow-white/5 transition-colors">
          <img
            src="/unimart-horizontal.png"
            alt="UniMart AI"
            className={`${horizontalHeights[size] || horizontalHeights.md} w-auto object-contain`}
          />
        </div>
      </div>
    );
  }

  // Variant 3: Emblem + Text fallback/composition
  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      className={`inline-flex items-center gap-2.5 sm:gap-3 select-none shrink-0 transition-transform duration-150 ${
        isInteractive ? 'cursor-pointer hover:opacity-95 active:scale-[0.98]' : ''
      } ${className}`}
      title="UniMart AI"
    >
      <img
        src="/unimart-emblem.png"
        alt="UniMart AI Emblem"
        className={`${emblemHeights[size] || emblemHeights.md} shrink-0 object-contain drop-shadow-xs`}
      />

      {showText && (
        <div className="flex flex-col leading-none shrink-0">
          <div className={`font-black tracking-tight ${titleSizes[size] || titleSizes.md} flex items-center whitespace-nowrap`}>
            <span className="text-slate-900 dark:text-white">UniMart</span>
            <span className="ml-1.5 bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
              AI
            </span>
          </div>
          {showSubtitle && (
            <span className={`text-slate-500 dark:text-slate-400 font-semibold tracking-wide uppercase mt-1 whitespace-nowrap ${subtitleSizes[size] || subtitleSizes.md}`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;
