import React, { useState, useEffect } from 'react';
import { userService, reviewService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ReviewList } from '../../components/reviews/ReviewList';
import { ReportModal } from '../../components/reviews/ReportModal';

export const PublicProfilePage = ({ onNavigate, userId }) => {
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    const fetchPublicProfile = async () => {
      if (!userId) {
        setError('No seller ID provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const res = await userService.getPublicProfile(userId);
        if (res?.success && res?.data) {
          setProfile(res.data);
        }
        const reviewRes = await reviewService.getUserReviews(userId, { page: 1, limit: 5 });
        setReviews(reviewRes?.data || []);
      } catch (err) {
        setError(err.message || 'Unable to load seller profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchPublicProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-4 text-sm text-slate-500">Loading seller profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-900">Profile Not Found</h3>
        <p className="text-sm text-slate-500">{error || 'This user profile does not exist.'}</p>
        <button
          onClick={() => onNavigate('home')}
          className="text-xs text-indigo-600 font-semibold hover:underline cursor-pointer"
        >
          &larr; Return to Marketplace
        </button>
      </div>
    );
  }

  const resolveAvatar = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
    const prefix = import.meta.env.DEV ? 'http://localhost:5000' : '';
    return `${prefix}${url.startsWith('/') ? '' : '/'}${url}`;
  };
  const avatarSrc = resolveAvatar(profile.avatarUrl);

  return (
    <div className="max-w-2xl w-full mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 border-2 border-indigo-100 flex items-center justify-center shadow-inner shrink-0">
            {avatarSrc ? (
              <img src={avatarSrc} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-extrabold text-indigo-600">
                {profile.name?.charAt(0) || 'U'}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-2xl font-bold text-slate-900">{profile.name}</h2>
            <p className="text-xs text-indigo-600 font-medium mt-0.5">Verified Student Member</p>

            <div className="mt-2 text-sm text-slate-600 space-y-1">
              {profile.department && (
                <p>
                  <span className="text-slate-400">Department:</span> {profile.department}
                  {profile.batch && ` (${profile.batch})`}
                </p>
              )}
              {profile.campusLocation && (
                <p>
                  <span className="text-slate-400">Pickup Area:</span> {profile.campusLocation}
                </p>
              )}
            </div>

            {profile.bio && (
              <p className="mt-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                "{profile.bio}"
              </p>
            )}
          </div>
        </div>

        {/* Reputation Summary */}
        <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs text-slate-500 font-medium block">Rating</span>
            <span className="text-lg font-bold text-slate-900 flex items-center justify-center space-x-1">
              <span>
                {profile.reputation?.ratingsCount
                  ? Number(profile.reputation.averageRating || 0).toFixed(1)
                  : 'New'}
              </span>
              <span className="text-amber-500 text-sm">&#9733;</span>
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs text-slate-500 font-medium block">Reviews</span>
            <span className="text-lg font-bold text-slate-900">
              {profile.reputation?.ratingsCount || 0}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs text-slate-500 font-medium block">Handaways</span>
            <span className="text-lg font-bold text-slate-900">
              {profile.reputation?.successfulTransactions || 0}
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Recent reviews</h3>
          <ReviewList
            reviews={reviews}
            currentUserId={user?.id || user?._id}
            onReport={
              isAuthenticated
                ? (review) => setReporting({ targetType: 'REVIEW', targetId: review._id, title: 'Report Review' })
                : null
            }
            emptyLabel="No published reviews yet."
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            &larr; Back to Marketplace
          </button>
          {isAuthenticated && String(user?.id || user?._id) !== String(profile.id) ? (
            <button
              type="button"
              onClick={() => setReporting({ targetType: 'USER', targetId: profile.id, title: 'Report User' })}
              className="text-xs font-semibold text-rose-700 cursor-pointer"
            >
              Report User
            </button>
          ) : null}
        </div>
      </div>
      {reporting ? (
        <ReportModal
          open
          title={reporting.title}
          targetType={reporting.targetType}
          targetId={reporting.targetId}
          onClose={() => setReporting(false)}
        />
      ) : null}
    </div>
  );
};
