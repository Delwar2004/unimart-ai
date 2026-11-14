import React from 'react';
import { ProductForm } from '../../components/products/ProductForm';

export const CreateListing = ({ onNavigate }) => {
  return (
    <div className="w-full">
      <div className="mb-4 max-w-3xl mx-auto">
        <button
          onClick={() => onNavigate('browse-products')}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
        >
          &larr; Back to Marketplace
        </button>
      </div>
      <ProductForm onNavigate={onNavigate} isEdit={false} />
    </div>
  );
};
