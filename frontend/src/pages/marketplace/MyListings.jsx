import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { productService } from '../../services/api';
import { ProductStatusBadge } from '../../components/products/ProductStatusBadge';

export const MyListings = ({ onNavigate }) => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const fetchMyProducts = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const res = await productService.getProducts({ page: 1, limit: 50, seller: user._id || user.id });
      if (res?.success) {
        const list = res.data?.products || (Array.isArray(res.data) ? res.data : []);
        setProducts(list);
      }
    } catch (err) {
      setError(err.message || 'Failed to load your listings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyProducts();
  }, [user]);

  const handleStatusChange = async (productId, newStatus) => {
    try {
      const res = await productService.updateProductStatus(productId, newStatus);
      if (res?.success) {
        setActionMessage(`Status updated to ${newStatus}`);
        fetchMyProducts();
      }
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to remove this listing?')) return;
    try {
      const res = await productService.deleteProduct(productId);
      if (res?.success) {
        setActionMessage('Listing deactivated successfully.');
        fetchMyProducts();
      }
    } catch (err) {
      setError(err.message || 'Failed to remove listing.');
    }
  };

  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:5000';

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Listings</h1>
          <p className="text-sm text-slate-500">
            Manage your campus items, change availability, or edit details
          </p>
        </div>
        <button
          onClick={() => onNavigate('create-listing')}
          className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm cursor-pointer whitespace-nowrap"
        >
          + Create New Listing
        </button>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          {actionMessage}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          {error}
        </div>
      )}

      {loading && (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-sm text-slate-500">Loading your items...</p>
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-4">
          <h3 className="text-lg font-bold text-slate-900">No active items posted yet</h3>
          <p className="text-sm text-slate-500">
            Have old books, calculators, or gadgets? Put them up for sale or giveaway!
          </p>
          <button
            onClick={() => onNavigate('create-listing')}
            className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
          >
            Create Your First Listing
          </button>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
          {products.map((p) => {
            const thumb = p.images?.find((img) => img.isThumbnail) || p.images?.[0];
            const imgSrc = thumb?.url
              ? (thumb.url.startsWith('http') ? thumb.url : `${baseUrl}${thumb.url}`)
              : null;

            return (
              <div key={p._id} className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {imgSrc ? (
                      <img src={imgSrc} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">No photo</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-bold text-indigo-600 uppercase">
                        {p.category?.name || 'Item'}
                      </span>
                      <ProductStatusBadge status={p.status} />
                    </div>
                    <h3
                      onClick={() => onNavigate('product-detail', p._id)}
                      className="text-base font-bold text-slate-900 hover:text-indigo-600 cursor-pointer transition"
                    >
                      {p.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {p.listingType === 'giveaway' ? 'Free Giveaway' : `${p.price} BDT`} &bull; Condition: {p.condition} &bull; Views: {p.viewsCount || 0}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  {/* Status Dropdown */}
                  <select
                    value={p.status}
                    onChange={(e) => handleStatusChange(p._id, e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 bg-white cursor-pointer"
                  >
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="sold">Sold</option>
                    <option value="inactive">Inactive</option>
                  </select>

                  <button
                    onClick={() => onNavigate('edit-listing', p._id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(p._id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
