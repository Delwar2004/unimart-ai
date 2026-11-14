import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/api';

export const ProfilePage = ({ onNavigate }) => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    batch: '',
    phone: '',
    bio: '',
    campusLocation: '',
  });
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Sync state with current authenticated user
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        department: user.department || '',
        batch: user.batch || '',
        phone: user.phone || '',
        bio: user.bio || '',
        campusLocation: user.campusLocation || '',
      });
      if (user.avatarUrl) {
        let avatar = user.avatarUrl;
        if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('blob:')) {
          setAvatarPreview(avatar);
        } else {
          const prefix = import.meta.env.DEV ? 'http://localhost:5000' : '';
          setAvatarPreview(`${prefix}${avatar.startsWith('/') ? '' : '/'}${avatar}`);
        }
      }
    }
  }, [user]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await userService.updateOwnProfile(formData);
      if (res?.success && res?.data) {
        updateUser(res.data);
        setMessage('Profile updated successfully!');
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl);
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;

    setAvatarLoading(true);
    setError('');
    setMessage('');

    const uploadData = new FormData();
    uploadData.append('avatar', avatarFile);

    try {
      const res = await userService.uploadAvatar(uploadData);
      if (res?.success && res?.data) {
        updateUser({ avatarUrl: res.data.avatarUrl });
        setMessage('Profile picture updated successfully!');
        setAvatarFile(null);
      }
    } catch (err) {
      setError(err.message || 'Avatar upload failed.');
    } finally {
      setAvatarLoading(false);
    }
  };

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
          {/* Avatar Area */}
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 border-2 border-indigo-100 flex items-center justify-center shadow-inner">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  onError={() => setAvatarPreview('')}
                />
              ) : (
                <span className="text-3xl font-extrabold text-indigo-600">
                  {user?.name?.charAt(0) || 'U'}
                </span>
              )}
            </div>
            <label
              htmlFor="avatar-input"
              className="mt-2 block text-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              Choose Photo
            </label>
            <input
              id="avatar-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarFileSelect}
              className="hidden"
            />
            {avatarFile && (
              <button
                type="button"
                onClick={handleAvatarUpload}
                disabled={avatarLoading}
                className="mt-1 block w-full text-center py-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold cursor-pointer disabled:opacity-50"
              >
                {avatarLoading ? 'Saving...' : 'Save Photo'}
              </button>
            )}
          </div>

          {/* User Headline & Badges */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{user?.name}</h2>
              {user?.isVerified && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Verified Student
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <p className="text-xs text-slate-400 mt-1">
              Student ID: {user?.studentId || 'N/A'} &bull; Role: {user?.role}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
              <button
                type="button"
                onClick={() => onNavigate('public-profile', user?._id || user?.id)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded-lg transition cursor-pointer"
              >
                View Public Seller Profile &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error}
        </div>
      )}

      {/* Edit Profile Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <h3 className="text-lg font-bold text-slate-900 mb-6">Edit Profile Details</h3>
        <form onSubmit={handleProfileSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Department
              </label>
              <input
                type="text"
                placeholder="e.g. ICT, CSE, BBA"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Batch
              </label>
              <input
                type="text"
                placeholder="e.g. BICE-24"
                value={formData.batch}
                onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+8801..."
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Campus Handover Location *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. BUP Main Gate, Cafeteria, FST Building"
              value={formData.campusLocation}
              onChange={(e) => setFormData({ ...formData, campusLocation: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Preferred meetup and handover point inside or adjacent to campus.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Bio / About You
            </label>
            <textarea
              rows="3"
              placeholder="Tell fellow students what items you typically trade, semesters, or courses..."
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            ></textarea>
            <p className="text-[11px] text-slate-400 mt-1">Maximum 500 characters.</p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="py-2.5 px-6 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Saving Changes...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
