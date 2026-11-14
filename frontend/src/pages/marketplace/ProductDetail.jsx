import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, ShoppingBag, BadgeDollarSign, ArrowLeftRight, Gift } from 'lucide-react';
import { productService, wishlistService, conversationService, reviewService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ProductStatusBadge } from '../../components/products/ProductStatusBadge';
import { RatingStars } from '../../components/reviews/RatingStars';
import { ReviewList } from '../../components/reviews/ReviewList';
import { ReportModal } from '../../components/reviews/ReportModal';
import { BuyRequestForm } from '../../components/marketplace/BuyRequestForm';
import { OfferForm } from '../../components/marketplace/OfferForm';
import ExchangeRequestForm from '../../components/marketplace/ExchangeRequestForm';
import GiveawayRequestForm from '../../components/marketplace/GiveawayRequestForm';

export const ProductDetail = ({ onNavigate, productId }) => {
  const { user, isAuthenticated } = useAuth();
  const [product, setProduct] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wishlisted, setWishlisted] = useState(null);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistError, setWishlistError] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [showBuyRequest, setShowBuyRequest] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [showExchange, setShowExchange] = useState(false);
  const [showGiveaway, setShowGiveaway] = useState(false);
  const [interestNotice, setInterestNotice] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewMeta, setReviewMeta] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const wishlistRequest = useRef(false);

  useEffect(() => {
    if (!productId) return undefined;
    let cancelled = false;
    reviewService
      .getProductReviews(productId, { page: 1, limit: 10 })
      .then((response) => {
        if (cancelled) return;
        setReviews(response?.data || []);
        setReviewMeta(response?.meta || null);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!productId) {
        setError('No product selected.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const res = await productService.getProductById(productId);
        if (res?.success && res?.data) {
          setProduct(res.data);
        }
      } catch (err) {
        setError(err.message || 'Failed to load product details.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [productId]);

  useEffect(() => {
    if (!isAuthenticated || !productId) {
      setWishlisted(null);
      return;
    }

    let cancelled = false;
    setWishlisted(null);
    wishlistService
      .checkWishlist(productId)
      .then((res) => {
        if (!cancelled) setWishlisted(Boolean(res?.data?.wishlisted));
      })
      .catch(() => {
        if (!cancelled) setWishlisted(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, productId]);

  const handleWishlistToggle = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      onNavigate('login');
      return;
    }
    if (wishlistRequest.current || wishlisted === null) return;

    wishlistRequest.current = true;
    setWishlistLoading(true);
    setWishlistError('');
    try {
      if (wishlisted) {
        await wishlistService.removeFromWishlist(product._id);
        setWishlisted(false);
      } else {
        await wishlistService.addToWishlist(product._id);
        setWishlisted(true);
      }
    } catch (err) {
      setWishlistError(err.message || 'Could not update your wishlist.');
    } finally {
      wishlistRequest.current = false;
      setWishlistLoading(false);
    }
  };

  const openInterest = (kind) => {
    if (!isAuthenticated) {
      onNavigate('login');
      return;
    }
    if (isOwner || product?.status !== 'available') return;
    setInterestNotice('');
    setShowBuyRequest(false);
    setShowOffer(false);
    setShowExchange(false);
    setShowGiveaway(false);
    if (kind === 'offer') setShowOffer(true);
    else if (kind === 'exchange') setShowExchange(true);
    else if (kind === 'giveaway') setShowGiveaway(true);
    else setShowBuyRequest(true);
  };

  const handleMessageSeller = async () => {
    if (!isAuthenticated) {
      onNavigate('login');
      return;
    }
    if (isOwner || !product?.seller?._id) return;

    setMessageLoading(true);
    setMessageError('');
    try {
      const res = await conversationService.createConversation({
        recipientId: product.seller._id,
        productId: product._id,
      });
      const conversationId = res?.data?._id;
      if (conversationId) {
        onNavigate('messages', conversationId);
      }
    } catch (err) {
      setMessageError(err.message || 'Could not start a conversation.');
    } finally {
      setMessageLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-3 text-sm text-slate-500">Loading item specifications...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Listing Unavailable</h3>
        <p className="text-sm text-slate-500">{error || 'This listing no longer exists.'}</p>
        <button
          onClick={() => onNavigate('browse-products')}
          className="text-xs text-indigo-600 font-semibold hover:underline cursor-pointer"
        >
          &larr; Return to Marketplace
        </button>
      </div>
    );
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:5000';
  const isOwner = user && (user._id === product.seller?._id || user.id === product.seller?._id);
  const canRequest = !isOwner && product.status === 'available' && product.listingType === 'sell';
  const canOffer = canRequest;
  const canExchange = !isOwner && product.status === 'available' && product.listingType === 'exchange';
  const canGiveaway = !isOwner && product.status === 'available' && product.listingType === 'giveaway';
  const messageLabel = product.listingType === 'sell' ? 'Message Seller' : 'Message Owner';

  const images = product.images || [];
  const currentImage = images[activeImageIndex] || images[0];
  const mainImageSrc = currentImage?.url
    ? (currentImage.url.startsWith('http') ? currentImage.url : `${baseUrl}${currentImage.url}`)
    : null;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => onNavigate('browse-products')}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
        >
          &larr; Back to Listings
        </button>
      </div>

      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 transition-colors">
        {/* Left Column: Image Gallery (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="w-full h-80 sm:h-96 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
            {mainImageSrc ? (
              <img
                src={mainImageSrc}
                alt={product.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80';
                }}
              />
            ) : (
              <div className="text-slate-400 text-center">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs mt-2 block font-medium">No photo available</span>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img, idx) => {
                const thumbSrc = img.url.startsWith('http') ? img.url : `${baseUrl}${img.url}`;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition ${
                      activeImageIndex === idx ? 'border-indigo-600 shadow-sm' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <img src={thumbSrc} alt="Thumb" className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Information & Actions (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                {product.category?.name || 'Category'} {product.subCategory && `• ${product.subCategory}`}
              </span>
              <div className="flex items-center space-x-2">
                <ProductStatusBadge status={product.status} />
                <span className="text-xs text-slate-400">Views: {product.viewsCount || 0}</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
              {product.title}
            </h1>

            {/* Price Section */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-0.5">
                  Listing Type: <span className="capitalize text-slate-900 dark:text-white font-bold">{product.listingType}</span>
                </span>
                {product.listingType === 'giveaway' ? (
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">Free Giveaway (0 BDT)</span>
                ) : product.listingType === 'exchange' ? (
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">Open for Barter / Exchange</span>
                ) : (
                  <span className="text-3xl font-black text-slate-900 dark:text-white">
                    {product.price} <span className="text-base font-semibold text-slate-500 dark:text-slate-400">{product.currency || 'BDT'}</span>
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Item Condition</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize">{product.condition}</span>
              </div>
            </div>

            {/* Description */}
            <div className="mt-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Item Description
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Exchange preferences if applicable */}
            {product.exchangePreferences && (
              <div className="mt-4 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200">
                <span className="font-bold block mb-1">Exchange Wishlist / Preference:</span>
                {product.exchangePreferences}
              </div>
            )}

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {product.tags.map((tag, i) => (
                  <span key={i} className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-[11px] font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Seller Card */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/80">
              <div
                className="flex items-center space-x-3 cursor-pointer"
                onClick={() => onNavigate('public-profile', product.seller?._id)}
              >
                <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold">
                  {product.seller?.name?.charAt(0) || 'S'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition">
                    {product.seller?.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    📍 {product.campusLocation}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-slate-800 flex items-center justify-end space-x-1">
                  <span>
                    {product.seller?.reputation?.ratingsCount
                      ? Number(product.seller.reputation.averageRating || 0).toFixed(1)
                      : 'New'}
                  </span>
                  <span className="text-amber-500">&#9733;</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {product.seller?.reputation?.ratingsCount || 0} reviews
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={handleWishlistToggle}
                disabled={wishlistLoading || (isAuthenticated && wishlisted === null)}
                className={`w-full py-3 px-4 rounded-xl border font-semibold text-xs transition cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60 ${
                  wishlisted
                    ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Heart className={`w-4 h-4 ${wishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
                {!isAuthenticated
                  ? 'Sign in to save'
                  : wishlisted === null
                  ? 'Checking wishlist...'
                  : wishlisted
                  ? 'Remove from Wishlist'
                  : 'Add to Wishlist'}
              </button>
              {product.status !== 'available' && (
                <p className="text-[11px] text-slate-500 text-center">
                  This listing is not currently available. You can still keep or remove it from your wishlist.
                </p>
              )}
              {wishlistError && (
                <p className="text-[11px] text-rose-600 text-center">{wishlistError}</p>
              )}

              <div className="flex items-center gap-3">
              {isOwner ? (
                <>
                  <button
                    onClick={() => onNavigate('edit-listing', product._id)}
                    className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm cursor-pointer text-center"
                  >
                    Edit Listing
                  </button>
                  <button
                    onClick={() => onNavigate('my-listings')}
                    className="py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer text-center"
                  >
                    Manage Status
                  </button>
                </>
              ) : (
                <div className="w-full space-y-2">
                  {canRequest && (
                    <button
                      type="button"
                      onClick={() => openInterest('request')}
                      className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm cursor-pointer inline-flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      {isAuthenticated ? 'Request to Buy' : 'Sign in to request'}
                    </button>
                  )}
                  {canExchange && (
                    <button
                      type="button"
                      onClick={() => openInterest('exchange')}
                      className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm cursor-pointer inline-flex items-center justify-center gap-2"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      {isAuthenticated ? 'Request Exchange' : 'Sign in to exchange'}
                    </button>
                  )}
                  {canGiveaway && (
                    <button
                      type="button"
                      onClick={() => openInterest('giveaway')}
                      className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm cursor-pointer inline-flex items-center justify-center gap-2"
                    >
                      <Gift className="w-4 h-4" />
                      {isAuthenticated ? 'Request Giveaway' : 'Sign in to request'}
                    </button>
                  )}
                  {canOffer && (
                    <button
                      type="button"
                      onClick={() => openInterest('offer')}
                      className="w-full py-3 px-4 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition cursor-pointer inline-flex items-center justify-center gap-2"
                    >
                      <BadgeDollarSign className="w-4 h-4" />
                      {isAuthenticated ? 'Make an Offer' : 'Sign in to offer'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (isAuthenticated ? setReportTarget({ targetType: 'PRODUCT', targetId: product._id, title: 'Report Listing' }) : onNavigate('login'))}
                    className="w-full py-3 px-4 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 font-semibold text-xs transition cursor-pointer"
                  >
                    {isAuthenticated ? 'Report Listing' : 'Sign in to report'}
                  </button>
                  <button
                    type="button"
                    onClick={handleMessageSeller}
                    disabled={messageLoading}
                    className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {isAuthenticated ? (messageLoading ? 'Opening chat...' : messageLabel) : 'Sign in to message'}
                  </button>
                  {messageError && <p className="text-[11px] text-rose-600 text-center">{messageError}</p>}
                  {interestNotice && <p className="text-[11px] text-emerald-700 text-center">{interestNotice}</p>}
                  {product.status === 'reserved' && (
                    <p className="text-[11px] text-amber-700 text-center font-semibold">
                      Reserved. New requests are closed while a transaction or exchange is active.
                    </p>
                  )}
                  {product.status === 'sold' && (
                    <p className="text-[11px] text-slate-600 text-center font-semibold">
                      Sold. New requests are closed.
                    </p>
                  )}
                  {product.status === 'inactive' && (
                    <p className="text-[11px] text-slate-500 text-center">
                      This listing is inactive. New requests are closed.
                    </p>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-6 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Reviews</h2>
          <p className="text-sm font-semibold text-slate-700">
            {(reviewMeta?.ratingCount ?? product.ratingCount)
              ? `${Number(reviewMeta?.averageRating ?? product.averageRating ?? 0).toFixed(1)} ★`
              : 'No ratings yet'}
            <span className="ml-2 font-medium text-slate-500">
              {reviewMeta?.ratingCount ?? product.ratingCount ?? 0} reviews
            </span>
          </p>
        </div>
        <RatingStars value={Math.round(reviewMeta?.averageRating ?? product.averageRating ?? 0)} readOnly />
        <ReviewList
          reviews={reviews}
          currentUserId={user?.id || user?._id}
          onReport={
            isAuthenticated
              ? (review) => setReportTarget({ targetType: 'REVIEW', targetId: review._id, title: 'Report Review' })
              : null
          }
        />
      </section>

      {reportTarget ? (
        <ReportModal
          open
          title={reportTarget.title}
          targetType={reportTarget.targetType}
          targetId={reportTarget.targetId}
          onClose={() => setReportTarget(null)}
        />
      ) : null}

      {showBuyRequest && (
        <BuyRequestForm
          product={product}
          onClose={() => setShowBuyRequest(false)}
          onSuccess={() => {
            setShowBuyRequest(false);
            setInterestNotice('Buy request sent. The seller can accept or decline it from their requests.');
          }}
        />
      )}
      {showOffer && (
        <OfferForm
          product={product}
          onClose={() => setShowOffer(false)}
          onSuccess={() => {
            setShowOffer(false);
            setInterestNotice('Offer sent. The seller can accept or decline it from their offers.');
          }}
        />
      )}
      {showExchange && (
        <ExchangeRequestForm
          product={product}
          userId={user?._id || user?.id}
          onClose={() => setShowExchange(false)}
          onCreated={() => setInterestNotice('Exchange request sent. The owner can accept it from Exchange Requests.')}
        />
      )}
      {showGiveaway && (
        <GiveawayRequestForm
          product={product}
          onClose={() => setShowGiveaway(false)}
          onCreated={() => setInterestNotice('Giveaway request sent. The owner can accept it from Giveaway Requests.')}
        />
      )}
    </div>
  );
};
