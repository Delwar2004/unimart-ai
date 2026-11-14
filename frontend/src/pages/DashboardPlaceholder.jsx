import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Logo } from '../components/Logo';

export const DashboardPlaceholder = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const { t, isBangla } = useLanguage();

  return (
    <div className="max-w-2xl w-full mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200/90 dark:border-slate-800 p-8 sm:p-10 transition-colors">
      <div className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <Logo variant="horizontal" size="md" onClick={() => onNavigate('browse-products')} />
      </div>

      <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 mb-2 border border-emerald-200 dark:border-emerald-800">
            {isBangla ? 'যাচাইকৃত শিক্ষার্থী' : 'Verified University Student'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {isBangla ? `স্বাগতম, ${user?.name}!` : `Welcome, ${user?.name}!`}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">{user?.email}</p>
        </div>
        <button
          onClick={() => {
            logout();
            onNavigate('browse-products');
          }}
          className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
        >
          {t('logout')}
        </button>
      </div>

      <div className="py-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80">
          <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-bold block mb-1">
            {isBangla ? 'শিক্ষার্থী আইডি' : 'Student ID'}
          </span>
          <span className="font-bold text-slate-900 dark:text-white">{user?.studentId || 'N/A'}</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80">
          <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-bold block mb-1">
            {isBangla ? 'বিভাগ ও ব্যাচ' : 'Department & Batch'}
          </span>
          <span className="font-bold text-slate-900 dark:text-white">
            {user?.department ? `${user.department} (${user.batch || 'Batch N/A'})` : 'N/A'}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80">
          <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-bold block mb-1">
            {isBangla ? 'ক্যাম্পাস স্পট' : 'Campus Location'}
          </span>
          <span className="font-bold text-slate-900 dark:text-white">{user?.campusLocation || 'Mirpur Cantonment Campus'}</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80">
          <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-bold block mb-1">
            {isBangla ? 'অ্যাকাউন্ট রোল' : 'Account Role'}
          </span>
          <span className="font-extrabold text-indigo-600 dark:text-indigo-400 uppercase text-xs">{user?.role}</span>
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          onClick={() => onNavigate('browse-products')}
          className="py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer"
        >
          {t('explore_items_btn')} &rarr;
        </button>
      </div>
    </div>
  );
};
