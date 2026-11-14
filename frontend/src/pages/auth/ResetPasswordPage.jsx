import React, { useState } from 'react';
import { authService } from '../../services/api';
import { Logo } from '../../components/Logo';

export const ResetPasswordPage = ({ onNavigate, token: propToken }) => {
  const [token, setToken] = useState(propToken || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const res = await authService.resetPassword(token.trim(), password);
      setMessage(res?.message || 'Password reset successful! You can now log in.');
    } catch (err) {
      setError(err.message || 'Failed to reset password. Token may be invalid or expired.');
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
        <h2 className="text-2xl font-bold text-slate-900">Set New Password</h2>
        <p className="text-sm text-slate-500 mt-1">
          Enter your reset token and new secure password
        </p>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {message ? (
        <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center space-y-4">
          <p className="text-sm font-medium">{message}</p>
          <div>
            <button
              onClick={() => onNavigate('login')}
              className="py-2 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition cursor-pointer"
            >
              Sign In With New Password
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Reset Token
            </label>
            <input
              type="text"
              required
              placeholder="Paste token from reset email"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              placeholder="At least 8 chars, 1 uppercase, 1 lowercase, 1 number"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition shadow-sm cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? 'Updating Password...' : 'Reset Password'}
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
