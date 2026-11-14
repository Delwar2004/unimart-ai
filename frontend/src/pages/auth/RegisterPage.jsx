import React, { useState } from 'react';
import { authService } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { Logo } from '../../components/Logo';
import { CheckCircle2 } from 'lucide-react';

export const RegisterPage = ({ onNavigate }) => {
  const { t, isBangla } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    studentId: '',
    department: '',
    batch: '',
    phone: '',
    campusLocation: 'Mirpur Cantonment Campus',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await authService.register(formData);
      if (res?.success) {
        setSuccess(
          res.message || (isBangla ? 'নিবন্ধন সফল হয়েছে! অনুগ্রহ করে বিশ্ববিদ্যালয়ের ইনবক্সে ভেরিফিকেশন লিঙ্কটি চেক করুন।' : 'Registration successful! Please check your university inbox for the verification link.')
        );
      }
    } catch (err) {
      setError(err.message || (isBangla ? 'নিবন্ধন ব্যর্থ হয়েছে। তথ্যগুলো পুনরায় যাচাই করুন।' : 'Registration failed. Please review your details.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl w-full mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200/90 dark:border-slate-800 p-8 sm:p-10 transition-colors">
      <div className="flex justify-center mb-6">
        <Logo variant="full" size="lg" onClick={() => onNavigate('browse-products')} />
      </div>

      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {t('register_title')}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5">
          {t('register_sub')}
        </p>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs sm:text-sm">
          {error}
        </div>
      )}

      {success ? (
        <div className="p-8 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {isBangla ? 'আপনার প্রাতিষ্ঠানিক ইনবক্স চেক করুন' : 'Check Your University Inbox'}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{success}</p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('login')}
              className="py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-extrabold text-sm shadow-md transition cursor-pointer"
            >
              {isBangla ? 'লগইনে যান' : 'Go to Sign In'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                {isBangla ? 'পূর্ণ নাম *' : 'Full Name *'}
              </label>
              <input
                type="text"
                required
                placeholder="Iftakharul Islam"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                {t('email_label')} *
              </label>
              <input
                type="email"
                required
                placeholder="student@bup.edu.bd"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                {isBangla ? 'শিক্ষার্থী আইডি' : 'Student ID'}
              </label>
              <input
                type="text"
                placeholder="24549010012"
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                {isBangla ? 'বিভাগ (Department)' : 'Department'}
              </label>
              <input
                type="text"
                placeholder="ICT / CSE / BBA"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                {isBangla ? 'ব্যাচ (Batch)' : 'Batch'}
              </label>
              <input
                type="text"
                placeholder="BICE-24"
                value={formData.batch}
                onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                {isBangla ? 'ক্যাম্পাস লোকেশন *' : 'Campus Location *'}
              </label>
              <input
                type="text"
                required
                placeholder="Mirpur Cantonment Campus"
                value={formData.campusLocation}
                onChange={(e) => setFormData({ ...formData, campusLocation: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              {t('password_label')} *
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {isBangla
                ? 'পাসওয়ার্ড অবশ্যই ৮+ অক্ষরের হতে হবে এবং বড় হাতের, ছোট হাতের অক্ষর ও সংখ্যা থাকতে হবে।'
                : 'Password must be 8+ characters and include uppercase, lowercase, and numeric characters.'}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-sm shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? (isBangla ? 'অ্যাকাউন্ট তৈরি হচ্ছে...' : 'Creating Account...') : t('register')}
          </button>
        </form>
      )}

      <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
        {isBangla ? 'ইতোমধ্যে অ্যাকাউন্ট আছে? ' : 'Already verified and registered? '}
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline ml-1 cursor-pointer"
        >
          {t('sign_in')}
        </button>
      </div>
    </div>
  );
};
