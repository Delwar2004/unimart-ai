import React, { useEffect, useRef, useState } from 'react';
import { Heart, MapPin, User, Star, ArrowRight } from 'lucide-react';
import { ProductStatusBadge } from './ProductStatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { wishlistService } from '../../services/api';

export const ProductCard = ({ product, onNavigate, isOwner = false }) => {
  const { isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const [wishlisted, setWishlisted] = useState(null);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const inFlight = useRef(false);
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:5000';

  useEffect(() => {
    if (!isAuthenticated || !product?._id) {
      setWishlisted(null);
      return;
    }

    let cancelled = false;
    wishlistService
      .checkWishlist(product._id)
      .then((res) => {
        if (!cancelled) setWishlisted(Boolean(res?.data?.wishlisted));
      })
      .catch(() => {
        if (!cancelled) setWishlisted(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, product?._id]);

  const handleWishlistToggle = async (event) => {
    event.stopPropagation();
    event.preventDefault();

    if (!isAuthenticated) {
      onNavigate?.('login');
      return;
    }

    if (inFlight.current || wishlisted === null) return;
    inFlight.current = true;
    setWishlistLoading(true);

    try {
      if (wishlisted) {
        await wishlistService.removeFromWishlist(product._id);
        setWishlisted(false);
      } else {
        await wishlistService.addToWishlist(product._id);
        setWishlisted(true);
      }
    } catch (err) {
      console.error('Wishlist update failed:', err.message);
    } finally {
      inFlight.current = false;
      setWishlistLoading(false);
    }
  };

  // Find thumbnail or first image
  const thumbnail = product.images?.find((img) => img.isThumbnail) || product.images?.[0];
  const imageSrc = thumbnail?.url
    ? (thumbnail.url.startsWith('http') ? thumbnail.url : `${baseUrl}${thumbnail.url}`)
    : null;

  const formatCondition = (cond) => {
    if (!cond) return '';
    if (cond === 'new') return t('condition_new');
    if (cond === 'like-new') return t('condition_like_new');
    if (cond === 'good') return t('condition_good');
    if (cond === 'fair') return t('condition_fair');
    return cond;
  };

  return (
    <div
      onClick={() => onNavigate('product-detail', product._id)}
      className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-2xl hover:shadow-indigo-500/15 hover:-translate-y-2 transition-all duration-300 cursor-pointer flex flex-col group relative"
    >
      {/* Image Container with 4:3 Aspect Ratio */}
      <div className="relative w-full aspect-4/3 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80';
            }}
          />
        ) : (
          <div className="text-slate-400 dark:text-slate-500 flex flex-col items-center">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs mt-1 font-medium">No photo</span>
          </div>
        )}

        {/* Listing Type Tag */}
        <div className="absolute top-3 left-3">
          <span
            className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm ${
              product.listingType === 'giveaway'
                ? 'bg-emerald-600/95 text-white ring-1 ring-white/20'
                : product.listingType === 'exchange'
                ? 'bg-blue-600/95 text-white ring-1 ring-white/20'
                : 'bg-slate-900/90 dark:bg-slate-800/90 text-white ring-1 ring-white/20'
            }`}
          >
            {product.listingType === 'giveaway'
              ? t('type_giveaway')
              : product.listingType === 'exchange'
              ? t('type_exchange')
              : t('type_sell')}
          </span>
        </div>

        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <ProductStatusBadge status={product.status} />
        </div>

        {/* Condition pill over image */}
        {product.condition && (
          <div className="absolute bottom-3 left-3">
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-black/65 backdrop-blur-md text-white shadow-xs">
              {formatCondition(product.condition)}
            </span>
          </div>
        )}

        {/* Wishlist Button */}
        <button
          type="button"
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={Boolean(wishlisted)}
          disabled={wishlistLoading || (isAuthenticated && wishlisted === null)}
          onClick={handleWishlistToggle}
          onMouseDown={(event) => event.stopPropagation()}
          className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-white/95 dark:bg-slate-850/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-500 hover:scale-110 active:scale-90 transition-all cursor-pointer"
        >
          <Heart className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${wishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>
      </div>

      {/* Body Info */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>{product.category?.name || 'Campus Item'}</span>
            {product.averageRating > 0 && (
              <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400 text-xs font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                {Number(product.averageRating).toFixed(1)}
              </span>
            )}
          </div>

          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200">
            {product.title}
          </h3>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            {product.listingType === 'giveaway' ? (
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {t('free_badge')}
              </span>
            ) : product.listingType === 'exchange' ? (
              <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                {t('exchange_badge')}
              </span>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  ৳ {product.price}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t('bdt_suffix')}
                </span>
              </div>
            )}

            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {product.seller?.name?.split(' ')[0] || 'Student'}
            </span>
          </div>

          {/* Footer Action Bar */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[140px] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{product.campusLocation || 'BUP Campus'}</span>
            </span>

            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold group-hover:bg-gradient-to-r group-hover:from-indigo-600 group-hover:via-indigo-600 group-hover:to-violet-600 group-hover:text-white transition-all duration-200 shadow-2xs group-hover:shadow-md group-hover:shadow-indigo-500/20">
              <span>{t('view_details')}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
