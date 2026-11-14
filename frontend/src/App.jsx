import React, { useState, useEffect } from 'react';
import { checkHealth } from './services/api';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeToggle } from './components/common/ThemeToggle';
import { LanguageToggle } from './components/common/LanguageToggle';
import { GlobalSearchBar } from './components/common/GlobalSearchBar';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardPlaceholder } from './pages/DashboardPlaceholder';
import { ProfilePage } from './pages/user/ProfilePage';
import { PublicProfilePage } from './pages/user/PublicProfilePage';
import { BrowseProducts } from './pages/marketplace/BrowseProducts';
import { ProductDetail } from './pages/marketplace/ProductDetail';
import { CreateListing } from './pages/marketplace/CreateListing';
import { EditListing } from './pages/marketplace/EditListing';
import { MyListings } from './pages/marketplace/MyListings';
import { WishlistPage } from './pages/marketplace/WishlistPage';
import { NotificationsPage } from './pages/marketplace/NotificationsPage';
import { NotificationBell } from './components/notifications/NotificationBell';
import { MessageNavButton } from './components/messaging/MessageNavButton';
import { MessagesPage } from './pages/messaging/MessagesPage';
import { BuyRequestsPage } from './pages/marketplace/BuyRequestsPage';
import { OffersPage } from './pages/marketplace/OffersPage';
import { TransactionsPage } from './pages/marketplace/TransactionsPage';
import { TransactionDetail } from './pages/marketplace/TransactionDetail';
import ExchangeRequestsPage from './pages/marketplace/ExchangeRequestsPage';
import GiveawayRequestsPage from './pages/marketplace/GiveawayRequestsPage';
import WantedPostsPage from './pages/marketplace/WantedPostsPage';
import WantedPostForm from './pages/marketplace/WantedPostForm';
import WantedPostDetail from './pages/marketplace/WantedPostDetail';
import { MyReportsPage } from './pages/marketplace/MyReportsPage';
import AdminModerationPage from './pages/admin/AdminModerationPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import { MarketplaceAssistant } from './components/ai/MarketplaceAssistant';
import { PendingNavButton } from './components/marketplace/PendingNavButton';
import {
  ShoppingBag,
  BadgeDollarSign,
  Receipt,
  ArrowLeftRight,
  Gift,
  Flag,
  ShieldAlert,
  BarChart3,
  Sparkles,
  Menu,
  X,
  LogOut,
  User,
  PlusCircle,
} from 'lucide-react';
import {
  notificationService,
  conversationService,
  buyRequestService,
  offerService,
  transactionService,
  exchangeRequestService,
  giveawayRequestService,
} from './services/api';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Logo } from './components/Logo';

function MainApp() {
  const [currentView, setCurrentView] = useState('browse-products');
  const [targetId, setTargetId] = useState(null);
  const [tokenParam, setTokenParam] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [pendingOffers, setPendingOffers] = useState(0);
  const [activeTransactions, setActiveTransactions] = useState(0);
  const [pendingExchanges, setPendingExchanges] = useState(0);
  const [pendingGiveaways, setPendingGiveaways] = useState(0);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchTrigger, setGlobalSearchTrigger] = useState(0);

  const handleGlobalSearch = (query) => {
    setGlobalSearchQuery(query);
    setGlobalSearchTrigger((prev) => prev + 1);
    if (currentView !== 'browse-products') {
      handleNavigate('browse-products');
    }
  };

  const { user, isAuthenticated, logout } = useAuth();
  const { isDark } = useTheme();
  const { t, isBangla } = useLanguage();

  const refreshUnreadCount = async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadCount(Number(res?.data?.count) || 0);
    } catch {
      setUnreadCount(0);
    }
  };

  const refreshUnreadMessages = async () => {
    if (!isAuthenticated) {
      setUnreadMessages(0);
      return;
    }
    try {
      const res = await conversationService.getUnreadMessageCount();
      setUnreadMessages(Number(res?.data?.count) || 0);
    } catch {
      setUnreadMessages(0);
    }
  };

  const refreshPendingInterest = async () => {
    if (!isAuthenticated) {
      setPendingRequests(0);
      setPendingOffers(0);
      return;
    }
    try {
      const [requests, offers] = await Promise.all([
        buyRequestService.getReceived({ status: 'pending', page: 1, limit: 1 }),
        offerService.getReceived({ status: 'pending', page: 1, limit: 1 }),
      ]);
      setPendingRequests(Number(requests?.data?.pagination?.totalItems) || 0);
      setPendingOffers(Number(offers?.data?.pagination?.totalItems) || 0);
    } catch {
      setPendingRequests(0);
      setPendingOffers(0);
    }
  };

  const refreshPhase10 = async () => {
    if (!isAuthenticated) {
      setPendingExchanges(0);
      setPendingGiveaways(0);
      return;
    }
    try {
      const [exchanges, giveaways] = await Promise.all([
        exchangeRequestService.getReceived({ status: 'pending', page: 1, limit: 1 }),
        giveawayRequestService.getReceived({ status: 'pending', page: 1, limit: 1 }),
      ]);
      setPendingExchanges(Number(exchanges?.data?.pagination?.totalItems) || 0);
      setPendingGiveaways(Number(giveaways?.data?.pagination?.totalItems) || 0);
    } catch {
      setPendingExchanges(0);
      setPendingGiveaways(0);
    }
  };

  const refreshActiveTransactions = async () => {
    if (!isAuthenticated) {
      setActiveTransactions(0);
      return;
    }
    try {
      const res = await transactionService.getTransactions({ active: 'true', page: 1, limit: 1 });
      setActiveTransactions(Number(res?.data?.pagination?.totalItems) || 0);
    } catch {
      setActiveTransactions(0);
    }
  };

  const parseHash = () => {
    const raw = window.location.hash.replace(/^#\/?/, '');
    if (!raw) return { view: 'browse-products', param: null };
    const [view, ...rest] = raw.split('/');
    const param = rest.length ? rest.join('/') : null;
    return { view, param };
  };

  const handleNavigate = (view, param = null, push = true) => {
    setMobileMenuOpen(false);
    if (
      view === 'public-profile' ||
      view === 'product-detail' ||
      view === 'edit-listing' ||
      view === 'messages' ||
      view === 'buy-requests' ||
      view === 'offers' ||
      view === 'wanted-post-detail' ||
      view === 'wanted-post-form' ||
      view === 'transaction-detail'
    ) {
      setTargetId(param);
    } else {
      setTargetId(null);
    }

    if (view === 'verify-email' || view === 'reset-password') {
      setTokenParam(param || '');
    } else {
      setTokenParam('');
    }

    setCurrentView(view);

    if (push) {
      const hashStr = param ? `#${view}/${param}` : `#${view}`;
      if (window.location.hash !== hashStr) {
        window.history.pushState({ view, param }, '', hashStr);
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Synchronize browser URL hash, query parameters, and forward/backward history navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const path = window.location.pathname;

    if (path.includes('verify-email') && token) {
      handleNavigate('verify-email', token, false);
    } else if (path.includes('reset-password') && token) {
      handleNavigate('reset-password', token, false);
    } else if (window.location.hash) {
      const { view, param } = parseHash();
      if (view) {
        handleNavigate(view, param, false);
      }
    }

    const handlePopState = () => {
      const { view, param } = parseHash();
      if (view) {
        handleNavigate(view, param, false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    refreshUnreadMessages();
    refreshPendingInterest();
    refreshActiveTransactions();
    refreshPhase10();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && currentView === 'notifications') {
      refreshUnreadCount();
    }
    if (isAuthenticated && currentView === 'messages') {
      refreshUnreadMessages();
    }
    if (isAuthenticated && (currentView === 'buy-requests' || currentView === 'offers')) {
      refreshPendingInterest();
    }
    if (isAuthenticated && (currentView === 'transactions' || currentView === 'transaction-detail')) {
      refreshActiveTransactions();
    }
    if (isAuthenticated && (currentView === 'exchange-requests' || currentView === 'giveaway-requests')) {
      refreshPhase10();
    }
  }, [currentView, isAuthenticated]);

  const resolveAvatar = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
    const prefix = import.meta.env.DEV ? 'http://localhost:5000' : '';
    return `${prefix}${url.startsWith('/') ? '' : '/'}${url}`;
  };
  const navAvatarSrc = resolveAvatar(user?.avatarUrl);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans relative selection:bg-indigo-500/20 selection:text-indigo-900 dark:selection:text-indigo-200 transition-colors duration-200">
      {/* 
        ========================================================================
        1. BUP CAMPUS WATERMARK LAYER (HIGHEST PRIORITY)
        Covers the FULL WEBSITE BACKGROUND (100vw, 100vh), fixed, behind all content.
        ========================================================================
      */}
      <div className="bup-watermark-layer" aria-hidden="true" />

      {/* 
        ========================================================================
        2. TOP NAVIGATION BAR (STICKY, BLURRED, RESPONSIVE)
        ========================================================================
      */}
      <header className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-50 transition-all shadow-xs w-full">
        <div className="w-full px-3 sm:px-5 lg:px-6 h-16 xl:h-18 flex items-center justify-between gap-2 xl:gap-4">
          {/* Brand Logo and Primary Nav (Left) */}
          <div className="flex items-center space-x-2 xl:space-x-4 shrink-0">
            <Logo onClick={() => handleNavigate('browse-products')} />

            {/* Desktop Primary Nav Items */}
            <div className="hidden lg:flex items-center space-x-1 xl:space-x-1.5">
              <button
                onClick={() => handleNavigate('browse-products')}
                className={`px-3 xl:px-3.5 py-1.5 xl:py-2 rounded-xl text-xs xl:text-sm font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  currentView === 'browse-products'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/90 dark:hover:bg-slate-800'
                }`}
              >
                {t('browse_items')}
              </button>
              <button
                onClick={() => handleNavigate('wanted-posts')}
                className={`px-3 xl:px-3.5 py-1.5 xl:py-2 rounded-xl text-xs xl:text-sm font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  currentView === 'wanted-posts' || currentView === 'wanted-post-detail' || currentView === 'wanted-post-form'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/90 dark:hover:bg-slate-800'
                }`}
              >
                {t('wanted_items')}
              </button>

              {isAuthenticated && (
                <>
                  <button
                    onClick={() => handleNavigate('create-listing')}
                    className="px-3 xl:px-3.5 py-1.5 xl:py-2 rounded-xl text-xs xl:text-sm font-extrabold bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-sm hover:shadow-md hover:shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4 shrink-0" />
                    <span>{t('sell_give')}</span>
                  </button>
                  <button
                    onClick={() => handleNavigate('my-listings')}
                    className={`px-2.5 xl:px-3 py-1.5 xl:py-2 rounded-xl text-xs xl:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
                      currentView === 'my-listings'
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t('my_listings')}
                  </button>
                  <button
                    onClick={() => handleNavigate('wishlist')}
                    className={`px-2.5 xl:px-3 py-1.5 xl:py-2 rounded-xl text-xs xl:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
                      currentView === 'wishlist'
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t('wishlist')}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Quick Global Search Bar (Middle - responsive, disappears gracefully on smaller screens) */}
          <div className="hidden xl:flex items-center justify-center flex-1 max-w-xs xl:max-w-[280px] 2xl:max-w-md mx-2">
            <GlobalSearchBar
              value={globalSearchQuery}
              onChange={setGlobalSearchQuery}
              onSearch={handleGlobalSearch}
            />
          </div>

          {/* Right Controls: Activities, Profile, Language, Theme (Right) */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
            {isAuthenticated ? (
              <>
                <div className="hidden md:flex items-center space-x-0.5 xl:space-x-1 border-r border-slate-200/80 dark:border-slate-800 pr-1.5 xl:pr-2 mr-0.5 xl:mr-1 shrink-0">
                  <PendingNavButton
                    label={t('requests')}
                    icon={ShoppingBag}
                    count={pendingRequests}
                    active={currentView === 'buy-requests'}
                    onClick={() => handleNavigate('buy-requests', null)}
                  />
                  <PendingNavButton
                    label={t('offers')}
                    icon={BadgeDollarSign}
                    count={pendingOffers}
                    active={currentView === 'offers'}
                    onClick={() => handleNavigate('offers', null)}
                  />
                  <PendingNavButton
                    label={isBangla ? 'বিনিময়' : 'Exchange'}
                    icon={ArrowLeftRight}
                    count={pendingExchanges}
                    active={currentView === 'exchange-requests'}
                    onClick={() => handleNavigate('exchange-requests', null)}
                  />
                  <PendingNavButton
                    label={isBangla ? 'উপহার' : 'Giveaway'}
                    icon={Gift}
                    count={pendingGiveaways}
                    active={currentView === 'giveaway-requests'}
                    onClick={() => handleNavigate('giveaway-requests', null)}
                  />
                  <PendingNavButton
                    label={t('transactions')}
                    icon={Receipt}
                    count={activeTransactions}
                    active={currentView === 'transactions' || currentView === 'transaction-detail'}
                    onClick={() => handleNavigate('transactions', null)}
                  />
                  <MessageNavButton
                    count={unreadMessages}
                    active={currentView === 'messages'}
                    onClick={() => handleNavigate('messages', null)}
                  />
                  <NotificationBell
                    count={unreadCount}
                    active={currentView === 'notifications'}
                    onClick={() => handleNavigate('notifications')}
                  />
                </div>

                {user?.role === 'admin' && (
                  <button
                    onClick={() => handleNavigate('admin-moderation')}
                    className={`px-2 xl:px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
                      currentView === 'admin-moderation'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                    title="Admin Moderation Portal"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden 2xl:inline">{t('admin_moderation')}</span>
                  </button>
                )}

                {/* Profile */}
                <button
                  onClick={() => handleNavigate('profile')}
                  className="flex items-center space-x-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl text-xs xl:text-sm font-bold bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-700 transition cursor-pointer border border-indigo-200/60 dark:border-slate-700 shrink-0"
                  title={`Profile: ${user?.name || 'User'}`}
                >
                  {navAvatarSrc ? (
                    <img src={navAvatarSrc} alt="Avatar" className="w-6 h-6 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                      {user?.name?.charAt(0) || 'U'}
                    </span>
                  )}
                  <span className="hidden sm:inline max-w-[70px] xl:max-w-[100px] truncate">{user?.name?.split(' ')[0]}</span>
                </button>

                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-1.5 xl:p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer shrink-0"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-2 shrink-0">
                <button
                  onClick={() => handleNavigate('login')}
                  className="px-3 xl:px-4 py-1.5 xl:py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  {t('sign_in')}
                </button>
                <button
                  onClick={() => handleNavigate('register')}
                  className="px-3 xl:px-4 py-1.5 xl:py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 hover:from-violet-700 hover:to-indigo-800 text-white shadow-sm hover:shadow-md hover:shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  {t('register')}
                </button>
              </div>
            )}

            {/* Language Switcher */}
            <LanguageToggle className="shrink-0" />

            {/* Dark / Light Mode Switcher */}
            <ThemeToggle className="shrink-0" />

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden px-4 pt-3 pb-6 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl space-y-3 animate-in fade-in slide-in-from-top-4">
            <div className="pb-1">
              <GlobalSearchBar
                value={globalSearchQuery}
                onChange={setGlobalSearchQuery}
                onSearch={(q) => {
                  setMobileMenuOpen(false);
                  handleGlobalSearch(q);
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleNavigate('browse-products')}
                className={`p-3 rounded-xl text-xs font-bold text-center transition ${
                  currentView === 'browse-products'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {t('browse_items')}
              </button>
              <button
                onClick={() => handleNavigate('wanted-posts')}
                className={`p-3 rounded-xl text-xs font-bold text-center transition ${
                  currentView === 'wanted-posts'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {t('wanted_items')}
              </button>
            </div>

            {isAuthenticated ? (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => handleNavigate('create-listing')}
                  className="w-full py-3 rounded-xl text-xs font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{t('sell_give')}</span>
                </button>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <button
                    onClick={() => handleNavigate('my-listings')}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    {t('my_listings')}
                  </button>
                  <button
                    onClick={() => handleNavigate('wishlist')}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    {t('wishlist')}
                  </button>
                  <button
                    onClick={() => handleNavigate('messages')}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    {t('messages')} ({unreadMessages})
                  </button>
                  <button
                    onClick={() => handleNavigate('notifications')}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    {t('notifications')} ({unreadCount})
                  </button>
                  <button
                    onClick={() => handleNavigate('profile')}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    {t('profile')}
                  </button>
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => handleNavigate('admin-moderation')}
                      className="col-span-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold flex items-center justify-center gap-1.5 border border-rose-200 dark:border-rose-900"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>{t('admin_moderation')}</span>
                    </button>
                  )}
                  <button
                    onClick={logout}
                    className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold"
                  >
                    {t('logout')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => handleNavigate('login')}
                  className="py-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                >
                  {t('sign_in')}
                </button>
                <button
                  onClick={() => handleNavigate('register')}
                  className="py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm"
                >
                  {t('register')}
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative z-10">
        {currentView === 'browse-products' && (
          <BrowseProducts
            onNavigate={handleNavigate}
            initialSearch={globalSearchQuery}
            searchTrigger={globalSearchTrigger}
          />
        )}
        {currentView === 'wanted-posts' && (
          <WantedPostsPage
            onOpenWanted={(id) => handleNavigate('wanted-post-detail', id)}
            onCreateWanted={() => (isAuthenticated ? handleNavigate('wanted-post-form', null) : handleNavigate('login'))}
          />
        )}
        {currentView === 'wanted-post-detail' && (
          <WantedPostDetail
            postId={targetId}
            onEdit={(id) => handleNavigate('wanted-post-form', id)}
            onDeleted={() => handleNavigate('wanted-posts')}
            onOpenConversation={(id) => handleNavigate('messages', id)}
          />
        )}
        {currentView === 'wanted-post-form' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <WantedPostForm
              postId={targetId}
              onSaved={(id) => handleNavigate('wanted-post-detail', id)}
              onCancel={() => handleNavigate(targetId ? 'wanted-post-detail' : 'wanted-posts', targetId)}
            />
          </ProtectedRoute>
        )}
        {currentView === 'product-detail' && (
          <ProductDetail onNavigate={handleNavigate} productId={targetId} />
        )}
        {currentView === 'create-listing' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <CreateListing onNavigate={handleNavigate} />
          </ProtectedRoute>
        )}
        {currentView === 'edit-listing' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <EditListing onNavigate={handleNavigate} productId={targetId} />
          </ProtectedRoute>
        )}
        {currentView === 'my-listings' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <MyListings onNavigate={handleNavigate} />
          </ProtectedRoute>
        )}
        {currentView === 'wishlist' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <WishlistPage onNavigate={handleNavigate} />
          </ProtectedRoute>
        )}
        {currentView === 'notifications' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <NotificationsPage onNavigate={handleNavigate} onUnreadChange={refreshUnreadCount} />
          </ProtectedRoute>
        )}
        {currentView === 'messages' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <MessagesPage
              onNavigate={handleNavigate}
              initialConversationId={targetId}
              onUnreadChange={refreshUnreadMessages}
            />
          </ProtectedRoute>
        )}
        {currentView === 'buy-requests' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <BuyRequestsPage
              onNavigate={handleNavigate}
              focusId={targetId}
              onPendingChange={refreshPendingInterest}
            />
          </ProtectedRoute>
        )}
        {currentView === 'offers' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <OffersPage
              onNavigate={handleNavigate}
              focusId={targetId}
              onPendingChange={refreshPendingInterest}
            />
          </ProtectedRoute>
        )}
        {currentView === 'exchange-requests' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <ExchangeRequestsPage
              onOpenProduct={(id) => handleNavigate('product-detail', id)}
              onOpenConversation={(id) => handleNavigate('messages', id)}
            />
          </ProtectedRoute>
        )}
        {currentView === 'giveaway-requests' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <GiveawayRequestsPage
              onOpenProduct={(id) => handleNavigate('product-detail', id)}
              onOpenConversation={(id) => handleNavigate('messages', id)}
              onOpenTransactions={() => handleNavigate('transactions', null)}
            />
          </ProtectedRoute>
        )}
        {currentView === 'transactions' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <TransactionsPage onNavigate={handleNavigate} onActiveChange={refreshActiveTransactions} />
          </ProtectedRoute>
        )}
        {currentView === 'transaction-detail' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <TransactionDetail
              transactionId={targetId}
              onNavigate={handleNavigate}
              onActiveChange={refreshActiveTransactions}
            />
          </ProtectedRoute>
        )}

        {/* Auth & Profile views */}
        {currentView === 'login' && <LoginPage onNavigate={handleNavigate} />}
        {currentView === 'register' && <RegisterPage onNavigate={handleNavigate} />}
        {currentView === 'verify-email' && (
          <VerifyEmailPage onNavigate={handleNavigate} token={tokenParam} />
        )}
        {currentView === 'forgot-password' && (
          <ForgotPasswordPage onNavigate={handleNavigate} />
        )}
        {currentView === 'reset-password' && (
          <ResetPasswordPage onNavigate={handleNavigate} token={tokenParam} />
        )}
        {currentView === 'dashboard' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <DashboardPlaceholder onNavigate={handleNavigate} />
          </ProtectedRoute>
        )}
        {currentView === 'profile' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <ProfilePage onNavigate={handleNavigate} />
          </ProtectedRoute>
        )}
        {currentView === 'public-profile' && (
          <PublicProfilePage onNavigate={handleNavigate} userId={targetId} />
        )}
        {currentView === 'my-reports' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <MyReportsPage />
          </ProtectedRoute>
        )}
        {currentView === 'admin-moderation' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <AdminModerationPage onNavigate={handleNavigate} />
          </ProtectedRoute>
        )}
        {currentView === 'admin-analytics' && (
          <ProtectedRoute onNavigate={handleNavigate}>
            <AdminAnalyticsPage onNavigate={handleNavigate} />
          </ProtectedRoute>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 py-10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-3 relative z-10 transition-colors">
        <div className="flex items-center justify-center">
          <Logo size="sm" onClick={() => handleNavigate('browse-products')} />
        </div>
        <div className="font-semibold text-slate-600 dark:text-slate-300">
          {t('footer_text')}
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 max-w-md mx-auto">
          {t('footer_tagline')}
        </div>

        {/* Dedicated Admin Portal & Login Navigation */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 max-w-sm mx-auto flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => handleNavigate(user?.role === 'admin' ? 'admin-moderation' : 'login')}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
            title="University Administrator Access"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>{user?.role === 'admin' ? 'Admin Moderation Portal' : 'Admin Login'}</span>
          </button>
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => handleNavigate('admin-analytics')}
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
              title="Platform Analytics Dashboard"
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
              <span>Admin Analytics</span>
            </button>
          )}
        </div>
      </footer>

      {/* Floating & Responsive AI Marketplace Assistant */}
      <MarketplaceAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onToggle={() => setIsAssistantOpen(!isAssistantOpen)}
        onNavigate={(view, id) => {
          handleNavigate(view, id || null);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
