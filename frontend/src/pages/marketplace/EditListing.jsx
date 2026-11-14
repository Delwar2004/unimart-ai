import React, { useState, useEffect } from 'react';
import { productService } from '../../services/api';
import { ProductForm } from '../../components/products/ProductForm';

export const EditListing = ({ onNavigate, productId }) => {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchItem = async () => {
      if (!productId) {
        setError('No product selected for edit.');
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
        setError(err.message || 'Failed to load product data.');
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [productId]);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-3 text-sm text-slate-500">Loading item for edit...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Cannot Edit Listing</h3>
        <p className="text-sm text-slate-500">{error || 'Product not found.'}</p>
        <button
          onClick={() => onNavigate('my-listings')}
          className="text-xs text-indigo-600 font-semibold hover:underline cursor-pointer"
        >
          &larr; Back to My Listings
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 max-w-3xl mx-auto">
        <button
          onClick={() => onNavigate('my-listings')}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
        >
          &larr; Back to My Listings
        </button>
      </div>
      <ProductForm initialData={product} isEdit={true} onNavigate={onNavigate} />
    </div>
  );
};
