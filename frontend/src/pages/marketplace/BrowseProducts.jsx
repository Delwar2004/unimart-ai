import React, { useState, useEffect, useRef } from 'react';
import { productService, categoryService, aiService } from '../../services/api';
import { ProductCard } from '../../components/products/ProductCard';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Search,
  PlusCircle,
  ShieldCheck,
  Zap,
  Repeat,
  PackageOpen,
  Filter,
} from 'lucide-react';

export const BrowseProducts = ({ onNavigate, initialSearch = '', searchTrigger = 0 }) => {
  const { user, isAuthenticated } = useAuth();
  const { t, isBangla } = useLanguage();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [filters, setFilters] = useState({
    category: '',
    subCategory: '',
    minPrice: '',
    maxPrice: '',
    condition: '',
    campusLocation: '',
    listingType: '',
    sort: 'newest',
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // AI Natural Language Search states
  const [searchTab, setSearchTab] = useState('keyword'); // 'keyword' | 'ai'
  const [nlQuery, setNlQuery] = useState('');
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState('');
  const [aiInterpretation, setAiInterpretation] = useState(null);
  const [isAiFiltered, setIsAiFiltered] = useState(false);

  // Personalized Recommendations states
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);

  // 1. Fetch categories on mount
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await categoryService.getCategories();
        if (res?.success) {
          setCategories(res.data || []);
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    fetchCats();
  }, []);

  // 2. Fetch personalized recommendations for signed-in students
  useEffect(() => {
    if (!isAuthenticated) {
      setRecommendations([]);
      return;
    }
    let isMounted = true;
    const fetchRecs = async () => {
      setRecLoading(true);
      try {
        const res = await aiService.getRecommendations({ limit: 4 });
        if (isMounted && res?.success && Array.isArray(res.data?.recommendations)) {
          setRecommendations(res.data.recommendations);
        }
      } catch (err) {
        console.warn('Failed to load personalized recommendations:', err.message);
      } finally {
        if (isMounted) setRecLoading(false);
      }
    };
    fetchRecs();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  // Update subcategories when category changes
  useEffect(() => {
    if (filters.category) {
      const selectedCat = categories.find((c) => c._id === filters.category);
      setSubcategories(selectedCat?.subcategories || []);
    } else {
      setSubcategories([]);
    }
  }, [filters.category, categories]);

  // Fetch products
  const fetchProducts = async (page = 1, currentFilters = filters, currentSearch = searchTerm) => {
    setLoading(true);
    setError('');

    const queryParams = {
      page,
      limit: 12,
      q: currentSearch.trim() || undefined,
      category: currentFilters.category || undefined,
      subCategory: currentFilters.subCategory || undefined,
      minPrice: currentFilters.minPrice || undefined,
      maxPrice: currentFilters.maxPrice || undefined,
      condition: currentFilters.condition || undefined,
      campusLocation: currentFilters.campusLocation?.trim() || undefined,
      listingType: currentFilters.listingType || undefined,
      sort: currentFilters.sort || 'newest',
    };

    try {
      const res = await productService.getProducts(queryParams);
      if (res?.success && res?.data) {
        setProducts(res.data.products || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (initialSearch) {
        setSearchTerm(initialSearch);
        setIsAiFiltered(false);
        fetchProducts(1, filters, initialSearch);
        setTimeout(() => {
          document.getElementById('marketplace-products-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
      return;
    }
    setSearchTerm(initialSearch);
    setIsAiFiltered(false);
    fetchProducts(1, filters, initialSearch);

    // Smooth scroll down to results section when user executes a search
    if (initialSearch && initialSearch.trim()) {
      setTimeout(() => {
        document.getElementById('marketplace-products-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [searchTrigger, initialSearch]);

  useEffect(() => {
    if (!isAiFiltered) {
      fetchProducts(1, filters, searchTerm);
    }
  }, [filters]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setIsAiFiltered(false);
    fetchProducts(1, filters, searchTerm);
  };

  const handleAiSearchSubmit = async (e) => {
    e.preventDefault();
    if (!nlQuery.trim()) return;

    setNlLoading(true);
    setNlError('');
    try {
      const res = await aiService.searchNaturalLanguage({ query: nlQuery.trim() });
      if (res?.success && res.data) {
        setProducts(res.data.products || []);
        setAiInterpretation(res.data.interpretation || null);
        setIsAiFiltered(true);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      } else {
        setNlError('AI could not parse your request. Try another phrasing.');
      }
    } catch (err) {
      setNlError(err.message || 'AI search service is temporarily unavailable.');
    } finally {
      setNlLoading(false);
    }
  };

  const handleApplyAiFilters = () => {
    if (!aiInterpretation) return;
    const newFilters = {
      category: aiInterpretation.categoryId || '',
      subCategory: '',
      minPrice: aiInterpretation.minPrice !== null && aiInterpretation.minPrice !== undefined ? String(aiInterpretation.minPrice) : '',
      maxPrice: aiInterpretation.maxPrice !== null && aiInterpretation.maxPrice !== undefined ? String(aiInterpretation.maxPrice) : '',
      condition: aiInterpretation.condition || '',
      listingType: aiInterpretation.listingType || '',
      campusLocation: aiInterpretation.campusLocation || '',
      sort: aiInterpretation.sort || 'newest',
    };
    const newSearch = aiInterpretation.q || '';
    setFilters(newFilters);
    setSearchTerm(newSearch);
    setIsAiFiltered(false);
    setSearchTab('keyword');
    fetchProducts(1, newFilters, newSearch);
  };

  const handleClearAiSearch = () => {
    setNlQuery('');
    setAiInterpretation(null);
    setIsAiFiltered(false);
    setNlError('');
    fetchProducts(1, filters, searchTerm);
  };

  const handleFilterChange = (field, value) => {
    setIsAiFiltered(false);
    setFilters((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'category' ? { subCategory: '' } : {}),
    }));
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setNlQuery('');
    setAiInterpretation(null);
    setIsAiFiltered(false);
    setFilters({
      category: '',
      subCategory: '',
      minPrice: '',
      maxPrice: '',
      condition: '',
      campusLocation: '',
      listingType: '',
      sort: 'newest',
    });
  };

  const hasActiveFilters =
    Boolean(searchTerm) ||
    Boolean(filters.category) ||
    Boolean(filters.subCategory) ||
    Boolean(filters.minPrice) ||
    Boolean(filters.maxPrice) ||
    Boolean(filters.condition) ||
    Boolean(filters.campusLocation) ||
    Boolean(filters.listingType) ||
    filters.sort !== 'newest';

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      {/* Personalized Recommendations Shelf (only shown when not actively searching) */}
      {isAuthenticated && recommendations.length > 0 && !searchTerm.trim() && (
        <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-white dark:from-slate-900/90 dark:via-indigo-950/40 dark:to-slate-900/90 rounded-3xl border border-indigo-100/90 dark:border-indigo-900/50 p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {isBangla ? 'আপনার জন্য বিশেষ প্রস্তাবনা' : 'Recommended For You'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {isBangla
                    ? 'আপনার আগ্রহ, পছন্দের তালিকা ও অ্যাক্টিভিটির ভিত্তিতে কিউরেট করা'
                    : 'Personalized based on your campus interests, wishlist, and past activity'}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/80 dark:bg-indigo-900/50 px-3 py-1.5 rounded-full self-start sm:self-auto">
              <Sparkles className="w-3.5 h-3.5" />
              AI Tailored
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-2">
            {recommendations.map((prod) => (
              <div key={prod._id} className="relative group flex flex-col">
                {prod.recommendationReason && (
                  <div className="mb-2 flex items-center">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-800/80 px-2.5 py-1 rounded-lg shadow-2xs truncate">
                      <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                      <span className="truncate">{prod.recommendationReason}</span>
                    </span>
                  </div>
                )}
                <ProductCard product={prod} onNavigate={onNavigate} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Hero & Search Box */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200/90 dark:border-slate-800 p-6 sm:p-10 space-y-8 relative overflow-hidden">
        {/* Ambient Gradient Glows */}
        <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-transparent rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 w-80 h-80 bg-gradient-to-tr from-purple-500/10 via-blue-500/5 to-transparent rounded-full blur-3xl" />

        {/* Hero Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/80 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 tracking-wide shadow-2xs">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{t('hero_badge')}</span>
            </div>

            <h1 className="hero-title text-slate-900 dark:text-white">
              {t('hero_title_1')}{' '}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                {t('hero_title_2')}
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
              {t('hero_sub')}
            </p>

            {/* Quick Campus Feature Highlights */}
            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{t('stat_verified')}</span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 hidden sm:block" />
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{t('stat_fast')}</span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 hidden sm:block" />
              <div className="flex items-center gap-1.5">
                <Repeat className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>{t('stat_fee')}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 self-start lg:self-center">
            <button
              onClick={() => onNavigate('create-listing')}
              className="py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/35 active:scale-95 transition-all duration-200 cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-5 h-5" />
              <span>{t('list_item_btn')}</span>
            </button>
            <button
              onClick={() => onNavigate('wanted-posts')}
              className="py-3 px-5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-2 border border-slate-200/80 dark:border-slate-700"
            >
              <span>{isBangla ? 'প্রয়োজনীয় পোস্ট দেখুন' : 'View Wanted Requests'}</span>
            </button>
          </div>
        </div>

        {/* Search Mode Tabs: Standard vs Natural Language AI Search */}
        <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-3 relative z-10">
          <button
            type="button"
            onClick={() => setSearchTab('keyword')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer flex items-center gap-2 ${
              searchTab === 'keyword'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>{t('standard_search')}</span>
          </button>
          <button
            type="button"
            onClick={() => setSearchTab('ai')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer flex items-center gap-2 ${
              searchTab === 'ai'
                ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-white/20'
                : 'text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/60 border border-indigo-200/60 dark:border-indigo-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{t('ai_search')}</span>
            <span className="text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded-md bg-white/20">
              {t('ai_badge')}
            </span>
          </button>
        </div>

        {/* Tab 1: Standard Search Input Bar */}
        {searchTab === 'keyword' && (
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 relative z-10">
            <div className="relative flex-1 group">
              <input
                type="text"
                placeholder={t('search_placeholder_standard')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/90 focus:bg-white dark:focus:bg-slate-800 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 shadow-2xs"
              />
              <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 absolute left-4 top-4 transition-colors" />
            </div>
            <button
              type="submit"
              className="py-3.5 px-7 rounded-2xl bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white font-extrabold text-sm shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>{t('search_btn')}</span>
            </button>
          </form>
        )}

        {/* Tab 2: AI Natural-Language Search */}
        {searchTab === 'ai' && (
          <div className="space-y-3 relative z-10">
            <form onSubmit={handleAiSearchSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 group">
                <input
                  type="text"
                  placeholder={t('search_placeholder_ai')}
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-indigo-200/90 dark:border-indigo-800/90 bg-indigo-50/30 dark:bg-indigo-950/30 focus:bg-white dark:focus:bg-slate-800 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 shadow-2xs"
                />
                <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400 group-focus-within:text-violet-500 absolute left-4 top-4 transition-colors" />
              </div>
              <button
                type="submit"
                disabled={nlLoading}
                className="py-3.5 px-7 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-sm shadow-lg shadow-indigo-500/25 active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {nlLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t('searching')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{isBangla ? 'এআই দিয়ে খুঁজুন' : 'Interpret & Search'}</span>
                  </>
                )}
              </button>
            </form>

            {nlError && (
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-4 py-3 rounded-2xl">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{nlError}</span>
              </div>
            )}
          </div>
        )}

        {/* AI Interpretation Summary Banner */}
        {isAiFiltered && aiInterpretation && (
          <div className="bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/80 rounded-2xl p-4 sm:p-5 space-y-3 relative z-10 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-indigo-950 dark:text-indigo-200">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>{isBangla ? 'এআই অনুসন্ধান ফলাফল' : 'AI Search Interpretation'}</span>
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2.5 py-0.5 rounded-full">
                  Confidence: {Math.round((aiInterpretation.confidence || 0.8) * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyAiFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{isBangla ? 'ফিল্টার পরিবর্তন করুন' : 'Edit Filters'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAiSearch}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('clear')}</span>
                </button>
              </div>
            </div>

            {/* Extracted Interpretation Tags */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              {aiInterpretation.q && (
                <span className="bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-800 px-3 py-1 rounded-xl">
                  <span className="text-slate-400 font-medium">Keywords:</span>{' '}
                  <strong className="text-slate-800 dark:text-white">{aiInterpretation.q}</strong>
                </span>
              )}
              {aiInterpretation.categoryName && (
                <span className="bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-800 px-3 py-1 rounded-xl">
                  <span className="text-slate-400 font-medium">{t('category')}:</span>{' '}
                  <strong className="text-indigo-700 dark:text-indigo-300">{aiInterpretation.categoryName}</strong>
                </span>
              )}
              {aiInterpretation.maxPrice !== null && (
                <span className="bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-800 px-3 py-1 rounded-xl">
                  <span className="text-slate-400 font-medium">{t('max_price')}:</span>{' '}
                  <strong className="text-emerald-700 dark:text-emerald-400">{aiInterpretation.maxPrice} ৳</strong>
                </span>
              )}
              {aiInterpretation.condition && (
                <span className="bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-800 px-3 py-1 rounded-xl">
                  <span className="text-slate-400 font-medium">{t('condition')}:</span>{' '}
                  <strong className="text-slate-800 dark:text-white capitalize">{aiInterpretation.condition}</strong>
                </span>
              )}
              {aiInterpretation.listingType && (
                <span className="bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-800 px-3 py-1 rounded-xl">
                  <span className="text-slate-400 font-medium">{t('listing_type')}:</span>{' '}
                  <strong className="text-slate-800 dark:text-white capitalize">{aiInterpretation.listingType}</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Filter Controls Grid */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 text-xs relative z-10">
          {/* Category Dropdown */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              {t('category')}
            </label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full h-10.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition shadow-2xs cursor-pointer"
            >
              <option value="">{t('all_categories')}</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              {t('subcategory')}
            </label>
            <select
              value={filters.subCategory}
              disabled={subcategories.length === 0}
              onChange={(e) => handleFilterChange('subCategory', e.target.value)}
              className="w-full h-10.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-200 text-xs disabled:opacity-40 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition shadow-2xs cursor-pointer"
            >
              <option value="">{t('all_subcategories')}</option>
              {subcategories.map((sub, i) => (
                <option key={i} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Condition */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              {t('condition')}
            </label>
            <select
              value={filters.condition}
              onChange={(e) => handleFilterChange('condition', e.target.value)}
              className="w-full h-10.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition shadow-2xs cursor-pointer"
            >
              <option value="">{t('all_conditions')}</option>
              <option value="new">{t('condition_new')}</option>
              <option value="like-new">{t('condition_like_new')}</option>
              <option value="good">{t('condition_good')}</option>
              <option value="fair">{t('condition_fair')}</option>
            </select>
          </div>

          {/* Listing Type */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              {t('listing_type')}
            </label>
            <select
              value={filters.listingType}
              onChange={(e) => handleFilterChange('listingType', e.target.value)}
              className="w-full h-10.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition shadow-2xs cursor-pointer"
            >
              <option value="">{t('all_types')}</option>
              <option value="sell">{t('type_sell')}</option>
              <option value="exchange">{t('type_exchange')}</option>
              <option value="giveaway">{t('type_giveaway')}</option>
            </select>
          </div>

          {/* Campus Location */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              {t('campus_spot')}
            </label>
            <input
              type="text"
              placeholder={isBangla ? 'যেমন: লাইব্রেরি, ক্যাফে' : 'e.g. BUP Central, Cafeteria'}
              value={filters.campusLocation}
              onChange={(e) => handleFilterChange('campusLocation', e.target.value)}
              className="w-full h-10.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition shadow-2xs"
            />
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              {t('sort_by')}
            </label>
            <select
              value={filters.sort}
              onChange={(e) => handleFilterChange('sort', e.target.value)}
              className="w-full h-10.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition shadow-2xs cursor-pointer"
            >
              <option value="newest">{t('sort_newest')}</option>
              <option value="price_asc">{t('sort_price_low')}</option>
              <option value="price_desc">{t('sort_price_high')}</option>
              <option value="popular">{t('sort_popular')}</option>
            </select>
          </div>
        </div>

        {/* Price Range & Reset Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 relative z-10">
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
              {t('price_range')}:
            </span>
            <input
              type="number"
              placeholder={t('min_price')}
              min="0"
              value={filters.minPrice}
              onChange={(e) => handleFilterChange('minPrice', e.target.value)}
              className="w-24 h-9.5 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition shadow-2xs"
            />
            <span className="text-slate-400 font-bold">&ndash;</span>
            <input
              type="number"
              placeholder={t('max_price')}
              min="0"
              value={filters.maxPrice}
              onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
              className="w-24 h-9.5 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition shadow-2xs"
            />
          </div>

          {(hasActiveFilters || isAiFiltered) && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('reset_filters')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Results Count Header */}
      <div id="marketplace-products-section" className="flex items-center justify-between px-1 scroll-mt-24">
        <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
          {products.length} {t('results_found')} ({pagination.totalItems} total)
          {isAiFiltered && (
            <span className="ml-2 text-indigo-600 dark:text-indigo-400 font-bold">
              • AI Smart Filter Active
            </span>
          )}
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-sm">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-24 text-center space-y-4">
          <div className="relative w-14 h-14 mx-auto">
            <div className="w-14 h-14 border-3 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            {isBangla ? 'ক্যাম্পাসের পণ্য লোড হচ্ছে...' : 'Loading university listings...'}
          </p>
        </div>
      )}

      {/* Redesigned Empty State */}
      {!loading && !error && products.length === 0 && (
        <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-200/90 dark:border-slate-800 p-10 sm:p-14 text-center max-w-xl mx-auto space-y-6 shadow-sm">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-100 via-purple-100 to-indigo-50 dark:from-indigo-950 dark:via-purple-950 dark:to-slate-900 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center mx-auto shadow-md border border-indigo-200/60 dark:border-indigo-800/60 ring-8 ring-indigo-50/50 dark:ring-indigo-950/20">
            <PackageOpen className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h3 className="section-title text-slate-900 dark:text-white">
              {t('no_products_title')}
            </h3>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              {t('no_products_sub')}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {(hasActiveFilters || isAiFiltered) && (
              <button
                onClick={handleClearFilters}
                className="py-3 px-6 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t('clear_all_filters')}</span>
              </button>
            )}
            <button
              onClick={() => onNavigate('create-listing')}
              className="py-3 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-indigo-500/25 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('post_item_btn')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Product Grid */}
      {!loading && !error && products.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-7">
            {products.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onNavigate={onNavigate}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center space-x-3 pt-8 pb-4">
              <button
                disabled={!pagination.hasPreviousPage}
                onClick={() => fetchProducts(pagination.page - 1)}
                className="py-2.5 px-5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                &larr; {isBangla ? 'পূর্ববর্তী' : 'Previous'}
              </button>
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold">
                {isBangla
                  ? `পৃষ্ঠা ${pagination.page} / ${pagination.totalPages}`
                  : `Page ${pagination.page} of ${pagination.totalPages}`}
              </span>
              <button
                disabled={!pagination.hasNextPage}
                onClick={() => fetchProducts(pagination.page + 1)}
                className="py-2.5 px-5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                {isBangla ? 'পরবর্তী' : 'Next'} &rarr;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
