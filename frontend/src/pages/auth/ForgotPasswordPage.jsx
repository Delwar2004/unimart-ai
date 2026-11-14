import React, { useState } from 'react';
import { authService } from '../../services/api';
import { Logo } from '../../components/Logo';

export const ForgotPasswordPage = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await authService.forgotPassword(email);
      setMessage(
        res?.message || 'If an account associated with that email exists, reset instructions have been sent.'
      );
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <div className="flex justify-center mb-6">
        <Logo variant="full" size="lg" onClick={() => onNavigate('browse-products')} />
      </div>

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Reset Password</h2>
        <p className="text-sm text-slate-500 mt-1">
          Enter your university email to receive a password reset link
        </p>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {message ? (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-sm space-y-3">
          <p>{message}</p>
          <div className="pt-2 text-center">
            <button
              onClick={() => onNavigate('reset-password')}
              className="text-xs text-indigo-600 font-semibold hover:underline block mb-2 cursor-pointer"
            >
              Have a reset token? Enter it here &rarr;
            </button>
            <button
              onClick={() => onNavigate('login')}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              University Email
            </label>
            <input
              type="email"
              required
              placeholder="student@bup.edu.bd"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Sending Instructions...' : 'Send Reset Link'}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              &larr; Back to Sign In
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
