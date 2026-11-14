import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart3,
  Users,
  ShoppingBag,
  Receipt,
  ShieldAlert,
  TrendingUp,
  RefreshCw,
  Calendar,
  Building2,
  Tag,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Gift,
  ArrowLeftRight,
  FileText,
  LogOut,
  ArrowLeft,
} from 'lucide-react';

export const AdminAnalyticsPage = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('30d');

  // Restrict UI to administrators only
  if (user?.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-4 my-12 shadow-sm">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Access Denied</h3>
        <p className="text-sm text-slate-600">
          Administrator privileges are required to view platform analytics and oversight metrics.
        </p>
        <button
          onClick={() => onNavigate('browse-products')}
          className="py-2.5 px-6 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition cursor-pointer"
        >
          Return to Marketplace
        </button>
      </div>
    );
  }

  const fetchAnalytics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await adminService.getAnalyticsOverview({ timeRange });
      if (res?.success) {
        setData(res.data);
      } else {
        throw new Error(res?.message || 'Failed to fetch platform metrics.');
      }
    } catch (err) {
      setError(err.message || 'Error loading platform analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const users = data?.users || { total: 0, active: 0, suspended: 0, banned: 0, verified: 0, unverified: 0 };
  const listings = data?.listings || { total: 0, available: 0, reserved: 0, sold: 0, inactive: 0, byType: {} };
  const transactions = data?.transactions || {
    totalSalesTransactions: 0,
    completedSales: 0,
    cancelledSales: 0,
    completedSalesVolumeBDT: 0,
    completedExchanges: 0,
    completedGiveaways: 0,
    totalCompletedAll: 0,
  };
  const wanted = data?.wantedPosts || { total: 0, active: 0, fulfilled: 0, closed: 0 };
  const reports = data?.reports || { total: 0, pending: 0, reviewed: 0, resolved: 0, dismissed: 0 };
  const trends = data?.trends || { userRegistrations: [], newListings: [], completedTransactions: [] };
  const categories = data?.categoryDistribution || [];
  const campuses = data?.campusDistribution || [];

  // Simple SVG Trend Sparkline / Bar Chart Component
  const SimpleBarChart = ({ items, valueKey, labelKey = 'date', color = 'bg-indigo-500', height = 120 }) => {
    if (!items || items.length === 0) {
      return (
        <div className="h-28 flex items-center justify-center text-xs text-slate-400">
          No trend data recorded for this time range.
        </div>
      );
    }

    const maxValue = Math.max(...items.map((i) => i[valueKey] || 0), 1);
    const visibleItems = items.slice(-14); // show last up to 14 periods for clean rendering

    return (
      <div className="space-y-2">
        <div className="flex items-end gap-1.5 h-28 pt-4 px-1 border-b border-slate-100">
          {visibleItems.map((item, idx) => {
            const val = item[valueKey] || 0;
            const barHeightPercent = Math.max(Math.round((val / maxValue) * 100), 4);
            const dateLabel = item[labelKey]?.slice(5) || ''; // MM-DD

            return (
              <div key={idx} className="flex-1 flex flex-col items-center group relative">
                {/* Tooltip */}
                <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition pointer-events-none bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded shadow z-10 whitespace-nowrap">
                  {val.toLocaleString()} ({item[labelKey]})
                </div>
                <div
                  className={`w-full rounded-t transition-all ${color} group-hover:opacity-80`}
                  style={{ height: `${barHeightPercent}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 px-1">
          <span>{visibleItems[0]?.[labelKey]}</span>
          <span>{visibleItems[visibleItems.length - 1]?.[labelKey]}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Platform Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Platform Oversight & Analytics</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time marketplace metrics, transaction velocity, listing volume, and campus community activity.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Range Preset Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                timeRange === '7d' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setTimeRange('14d')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                timeRange === '14d' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              14D
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                timeRange === '30d' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              30D
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                timeRange === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              All
            </button>
          </div>

          {/* Back to Marketplace Action */}
          <button
            onClick={() => onNavigate('browse-products')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            title="Return to Public Campus Marketplace"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>

          {/* Refresh Action */}
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Switch to Moderation Portal */}
          <button
            onClick={() => onNavigate('admin-moderation')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Moderation Portal</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          {/* Logout Action */}
          <button
            onClick={() => {
              logout();
              onNavigate('browse-products');
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition cursor-pointer"
            title="Sign out of Admin Session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchAnalytics()}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-slate-200 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 bg-slate-200 rounded-2xl" />
            <div className="h-64 bg-slate-200 rounded-2xl" />
            <div className="h-64 bg-slate-200 rounded-2xl" />
          </div>
        </div>
      ) : (
        <>
          {/* Primary Top-Level KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Students */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Registered Users</span>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-900">{users.total.toLocaleString()}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <span className="text-emerald-600 font-semibold">{users.active} active</span>
                  <span>&bull;</span>
                  <span className="text-indigo-600 font-semibold">{users.verified} verified</span>
                </div>
              </div>
            </div>

            {/* Marketplace Listings */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Marketplace Listings</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <ShoppingBag className="w-4 h-4" />
                </span>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-900">{listings.total.toLocaleString()}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <span className="text-emerald-600 font-semibold">{listings.available} available</span>
                  <span>&bull;</span>
                  <span className="text-blue-600 font-semibold">{listings.sold} sold</span>
                </div>
              </div>
            </div>

            {/* Completed Transactions & GMV */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Completed Deals</span>
                <span className="p-2 rounded-xl bg-violet-50 text-violet-600">
                  <Receipt className="w-4 h-4" />
                </span>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-900">
                  {transactions.totalCompletedAll.toLocaleString()}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <span className="text-slate-800 font-bold">
                    ৳{Number(transactions.completedSalesVolumeBDT || 0).toLocaleString()}
                  </span>
                  <span>sales volume</span>
                </div>
              </div>
            </div>

            {/* Moderation Queue */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Pending Reports</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <ShieldAlert className="w-4 h-4" />
                </span>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-amber-600">{reports.pending}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <span className="text-slate-600">{reports.total} total reports</span>
                  <span>&bull;</span>
                  <span className="text-emerald-600 font-semibold">{reports.resolved} resolved</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Transaction Velocity & Detailed Completion Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Transaction Metrics */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-violet-600" />
                  Transaction Velocity & Fulfillment
                </h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                  <span className="text-slate-600 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Completed Direct Sales
                  </span>
                  <span className="font-bold text-slate-900">{transactions.completedSales}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                  <span className="text-slate-600 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    Completed Item Exchanges
                  </span>
                  <span className="font-bold text-slate-900">{transactions.completedExchanges}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                  <span className="text-slate-600 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    Completed Student Giveaways
                  </span>
                  <span className="font-bold text-slate-900">{transactions.completedGiveaways}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                  <span className="text-slate-600 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    Active / In-Progress Deals
                  </span>
                  <span className="font-bold text-amber-700">
                    {(transactions.activeSales || 0) + (transactions.activeExchanges || 0)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 text-xs">
                  <span className="text-slate-600 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    Cancelled Transactions
                  </span>
                  <span className="font-bold text-rose-600">{transactions.totalCancelledAll || 0}</span>
                </div>
              </div>

              <div className="bg-violet-50 rounded-xl p-3.5 text-xs text-violet-900 space-y-1">
                <span className="font-bold">Monetary Revenue Rule:</span>
                <p className="text-[11px] text-violet-700 leading-relaxed">
                  Only completed direct sale transactions contribute to the ৳
                  {Number(transactions.completedSalesVolumeBDT || 0).toLocaleString()} GMV volume. Exchanges and
                  zero-price giveaways are tracked separately.
                </p>
              </div>
            </div>

            {/* Listing Status & Type Distribution */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                  Listing Health & Formats
                </h3>
                <span className="text-xs text-slate-400">{listings.total} items</span>
              </div>

              {/* Progress Bar Breakdown */}
              <div className="space-y-2">
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{
                      width: `${listings.total > 0 ? (listings.available / listings.total) * 100 : 0}%`,
                    }}
                    title={`Available: ${listings.available}`}
                  />
                  <div
                    className="bg-amber-400 h-full transition-all"
                    style={{
                      width: `${listings.total > 0 ? (listings.reserved / listings.total) * 100 : 0}%`,
                    }}
                    title={`Reserved: ${listings.reserved}`}
                  />
                  <div
                    className="bg-blue-500 h-full transition-all"
                    style={{
                      width: `${listings.total > 0 ? (listings.sold / listings.total) * 100 : 0}%`,
                    }}
                    title={`Sold: ${listings.sold}`}
                  />
                  <div
                    className="bg-slate-400 h-full transition-all"
                    style={{
                      width: `${listings.total > 0 ? (listings.inactive / listings.total) * 100 : 0}%`,
                    }}
                    title={`Inactive: ${listings.inactive}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Available: <strong className="text-slate-900">{listings.available}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    Reserved: <strong className="text-slate-900">{listings.reserved}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    Sold: <strong className="text-slate-900">{listings.sold}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    Inactive: <strong className="text-slate-900">{listings.inactive}</strong>
                  </div>
                </div>
              </div>

              {/* By Listing Type */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Listings by Type
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 bg-slate-50 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 block">For Sale</span>
                    <strong className="text-sm text-slate-900">{listings.byType?.sell || 0}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 block">Exchange</span>
                    <strong className="text-sm text-slate-900">{listings.byType?.exchange || 0}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl text-center">
                    <span className="text-[10px] text-slate-500 block">Giveaway</span>
                    <strong className="text-sm text-slate-900">{listings.byType?.giveaway || 0}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Student Demand: Wanted Posts */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  Student Demand (Wanted Posts)
                </h3>
                <span className="text-xs text-slate-400">{wanted.total} posts</span>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                  <span className="text-slate-600 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                    Open / Active Demands
                  </span>
                  <span className="font-bold text-teal-700">{wanted.active}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100 text-xs">
                  <span className="text-slate-600 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    Fulfilled Requests
                  </span>
                  <span className="font-bold text-blue-700">{wanted.fulfilled}</span>
                </div>
                <div className="flex justify-between items-center py-2 text-xs">
                  <span className="text-slate-600 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    Closed Posts
                  </span>
                  <span className="font-bold text-slate-600">{wanted.closed}</span>
                </div>
              </div>

              {/* User Community Health */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Community Account Status
                </span>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Suspended / Banned:</span>
                  <span className="font-semibold text-rose-600">
                    {users.suspended} suspended &bull; {users.banned} banned
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Verification Rate:</span>
                  <span className="font-semibold text-emerald-600">
                    {users.total > 0 ? Math.round((users.verified / users.total) * 100) : 0}% verified
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Trend Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* New Listings Trend */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  New Listings Velocity
                </h3>
              </div>
              <SimpleBarChart items={trends.newListings} valueKey="count" color="bg-emerald-500" />
            </div>

            {/* Completed Transactions Trend */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-600" />
                  Completed Transactions
                </h3>
              </div>
              <SimpleBarChart items={trends.completedTransactions} valueKey="count" color="bg-violet-500" />
            </div>

            {/* User Registrations Trend */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Student Onboarding Trend
                </h3>
              </div>
              <SimpleBarChart items={trends.userRegistrations} valueKey="count" color="bg-blue-500" />
            </div>
          </div>

          {/* Section 4: Category and Campus Distributions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Distribution */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  Category-Wise Listing Distribution
                </h3>
                <span className="text-xs text-slate-400">{categories.length} categories</span>
              </div>

              {categories.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No category listings found.</p>
              ) : (
                <div className="space-y-3">
                  {categories.slice(0, 6).map((cat, i) => {
                    const maxListings = Math.max(...categories.map((c) => c.totalListings || 0), 1);
                    const widthPercent = Math.max(Math.round((cat.totalListings / maxListings) * 100), 4);

                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-800">{cat.name}</span>
                          <span className="text-slate-500">
                            <strong>{cat.totalListings}</strong> total ({cat.availableListings} available)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full transition-all"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Campus Distribution */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  Campus Activity Distribution
                </h3>
                <span className="text-xs text-slate-400">{campuses.length} locations</span>
              </div>

              {campuses.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No campus activity recorded.</p>
              ) : (
                <div className="space-y-3">
                  {campuses.slice(0, 6).map((camp, i) => {
                    const maxCamp = Math.max(...campuses.map((c) => c.listingsCount || 0), 1);
                    const widthPercent = Math.max(Math.round((camp.listingsCount / maxCamp) * 100), 4);

                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-800">{camp.campus}</span>
                          <span className="text-slate-500">
                            <strong>{camp.listingsCount}</strong> listings ({camp.availableCount} available)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAnalyticsPage;
