import React, { useState, useEffect } from 'react';
import { authService } from '../../services/api';
import { Logo } from '../../components/Logo';

export const VerifyEmailPage = ({ onNavigate, token: propToken }) => {
  const [token, setToken] = useState(propToken || '');
  const [status, setStatus] = useState('idle'); // 'idle' | 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('');

  // Auto-verify if token is provided via prop / query param
  useEffect(() => {
    if (propToken) {
      handleVerify(propToken);
    }
  }, [propToken]);

  const handleVerify = async (tokenToUse) => {
    const finalToken = tokenToUse || token;
    if (!finalToken) {
      setStatus('error');
      setMessage('Please provide a verification token.');
      return;
    }

    setStatus('verifying');
    setMessage('');

    try {
      const res = await authService.verifyEmail(finalToken.trim());
      setStatus('success');
      setMessage(res?.message || 'Your university account has been verified successfully!');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Verification token is invalid or expired.');
    }
  };

  return (
    <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
      <div className="flex justify-center mb-6">
        <Logo variant="full" size="lg" onClick={() => onNavigate('browse-products')} />
      </div>

      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-2">Verify University Email</h2>
      <p className="text-sm text-slate-500 mb-6">
        Confirm your campus account to unlock student-to-student commerce
      </p>

      {status === 'verifying' && (
        <div className="py-6 flex flex-col items-center space-y-3">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-600">Verifying your university token...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm mb-6">
          <p className="font-semibold mb-1">Account Verified!</p>
          <p>{message}</p>
          <div className="mt-4">
            <button
              onClick={() => onNavigate('login')}
              className="py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition cursor-pointer"
            >
              Sign In Now
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm mb-6">
          <p className="font-semibold mb-1">Verification Failed</p>
          <p>{message}</p>
        </div>
      )}

      {status !== 'success' && (
        <div className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Paste Verification Token
            </label>
            <input
              type="text"
              placeholder="e.g. 6a8f1b2c4d..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={() => handleVerify()}
            disabled={status === 'verifying'}
            className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            Verify Token
          </button>
        </div>
      )}

      <div className="mt-6 text-xs text-slate-500">
        <button
          onClick={() => onNavigate('login')}
          className="text-indigo-600 hover:text-indigo-800 cursor-pointer"
        >
          &larr; Back to Sign In
        </button>
      </div>
    </div>
  );
};
