import React, { useEffect, useState } from 'react';
import { Heart, Trash2 } from 'lucide-react';
import { wishlistService } from '../../services/api';
import { ProductStatusBadge } from '../../components/products/ProductStatusBadge';

const formatPrice = (product) => {
  if (!product) return '';
  if (product.listingType === 'giveaway') return 'Free Giveaway';
  if (product.listingType === 'exchange') return 'Barter / Exchange';
  return `${product.price} ${product.currency || 'BDT'}`;
};

export const WishlistPage = ({ onNavigate }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState(null);

  const loadWishlist = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await wishlistService.getWishlist();
      setItems(res?.data?.items || []);
    } catch (err) {
      setError(err.message || 'Failed to load your wishlist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWishlist();
  }, []);

  const handleRemove = async (productId) => {
    if (!productId || removingId) return;
    setRemovingId(productId);
    try {
      await wishlistService.removeFromWishlist(productId);
      setItems((current) => current.filter((item) => item.product?._id !== productId));
    } catch (err) {
      setError(err.message || 'Could not remove this item.');
    } finally {
      setRemovingId(null);
    }
  };

  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:5000';

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Wishlist</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? 'Loading saved items...' : `${items.length} saved ${items.length === 1 ? 'item' : 'items'}`}
          </p>
        </div>
      </div>

      {loading && (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-sm text-slate-500">Loading your wishlist...</p>
        </div>
      )}

      {!loading && error && (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-3">
          <h2 className="text-base font-bold text-slate-900">Could not load wishlist</h2>
          <p className="text-sm text-rose-600">{error}</p>
          <button
            onClick={loadWishlist}
            className="py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-3 shadow-sm">
          <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
            <Heart className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Your wishlist is empty.</h2>
          <p className="text-sm text-slate-500">
            Save products you&apos;re interested in and find them here later.
          </p>
          <button
            onClick={() => onNavigate('browse-products')}
            className="py-2.5 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition cursor-pointer"
          >
            Browse marketplace
          </button>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const product = item.product;
            if (!product) {
              return (
                <div key={item._id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                  <h3 className="font-bold text-slate-900 text-sm">Listing unavailable</h3>
                  <p className="text-xs text-slate-500">This product is no longer available.</p>
                </div>
              );
            }

            const thumbnail = product.images?.find((img) => img.isThumbnail) || product.images?.[0];
            const imageSrc = thumbnail?.url
              ? (thumbnail.url.startsWith('http') ? thumbnail.url : `${baseUrl}${thumbnail.url}`)
              : null;
            const unavailable = product.status && product.status !== 'available';

            return (
              <article
                key={item._id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => onNavigate('product-detail', product._id)}
                  className="relative w-full h-44 bg-slate-100 text-left cursor-pointer"
                >
                  {imageSrc ? (
                    <img src={imageSrc} alt={product.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">No photo</div>
                  )}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white">
                      {product.listingType}
                    </span>
                  </div>
                  <div className="absolute top-2.5 right-2.5">
                    <ProductStatusBadge status={product.status} />
                  </div>
                </button>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-2">{product.title}</h3>
                    <p className="mt-1 text-sm font-black text-slate-900">{formatPrice(product)}</p>
                    <p className="text-[11px] text-slate-500 capitalize mt-1">Condition: {product.condition}</p>
                    <p className="text-[11px] text-slate-400 mt-1">📍 {product.campusLocation}</p>
                    {unavailable && (
                      <p className="text-[11px] font-semibold text-rose-600 mt-2">This item is no longer available.</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => product.seller?._id && onNavigate('public-profile', product.seller._id)}
                      className="text-left text-xs text-slate-600 hover:text-indigo-600 cursor-pointer"
                    >
                      <span className="block text-[10px] uppercase tracking-wide text-slate-400">Seller</span>
                      <span className="font-semibold">{product.seller?.name || 'Student'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={removingId === product._id}
                      onClick={() => handleRemove(product._id)}
                      className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:border-rose-200 disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {removingId === product._id ? 'Removing' : 'Remove'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
