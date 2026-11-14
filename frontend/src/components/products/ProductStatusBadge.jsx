import React from 'react';

export const ProductStatusBadge = ({ status }) => {
  const styles = {
    available: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    reserved: 'bg-amber-100 text-amber-800 border-amber-200',
    sold: 'bg-slate-100 text-slate-800 border-slate-200',
    inactive: 'bg-rose-100 text-rose-800 border-rose-200',
  };

  const labels = {
    available: 'Available',
    reserved: 'Reserved',
    sold: 'Sold',
    inactive: 'Inactive',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${
        styles[status] || styles.available
      }`}
    >
      {labels[status] || status}
    </span>
  );
};
