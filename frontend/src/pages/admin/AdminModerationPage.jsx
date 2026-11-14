import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Eye,
  User,
  ShoppingBag,
  FileText,
  Star,
  MessageSquare,
  Ban,
  Slash,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  BarChart3,
  LogOut,
  ArrowLeft,
} from 'lucide-react';

export const AdminModerationPage = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, resolved: 0, dismissed: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [activeReportId, setActiveReportId] = useState(null);
  const [activeReportDetail, setActiveReportDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [moderationNote, setModerationNote] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null); // { type: 'resolve' | 'dismiss', action?: string }

  // Restrict UI to administrators only
  if (user?.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-4 my-12 shadow-sm">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Access Denied</h3>
        <p className="text-sm text-slate-600">
          Administrator privileges are required to access the UniMart AI Moderation Portal.
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

  const fetchReports = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      if (targetTypeFilter) params.targetType = targetTypeFilter;

      const res = await adminService.getReports(params);
      if (res?.success) {
        setReports(res.data?.reports || []);
        if (res.data?.summary) setSummary(res.data.summary);
        if (res.meta?.pagination) setPagination(res.meta.pagination);
      }
    } catch (err) {
      setError(err.message || 'Failed to load moderation reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(1);
  }, [statusFilter, targetTypeFilter]);

  const openReportDetail = async (reportId) => {
    setActiveReportId(reportId);
    setDetailLoading(true);
    setError(null);
    setSelectedAction('');
    setModerationNote('');
    try {
      const res = await adminService.getReportById(reportId);
      if (res?.success) {
        setActiveReportDetail(res.data);
        // Default action based on target type
        const tType = res.data?.report?.targetType;
        if (tType === 'PRODUCT') setSelectedAction('DEACTIVATE_PRODUCT');
        else if (tType === 'WANTED_POST') setSelectedAction('CLOSE_WANTED_POST');
        else if (tType === 'REVIEW') setSelectedAction('HIDE_REVIEW');
        else if (tType === 'USER') setSelectedAction('SUSPEND_USER');
        else setSelectedAction('NONE');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch report details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!activeReportId) return;
    setActionInProgress(true);
    setError(null);
    try {
      await adminService.resolveReport(activeReportId, {
        action: selectedAction || 'NONE',
        note: moderationNote,
      });
      setActionSuccessMsg('Report resolved and moderation action applied successfully.');
      setConfirmDialog(null);
      await openReportDetail(activeReportId);
      fetchReports(pagination.page);
    } catch (err) {
      setError(err.message || 'Failed to resolve report.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDismiss = async () => {
    if (!activeReportId) return;
    setActionInProgress(true);
    setError(null);
    try {
      await adminService.dismissReport(activeReportId, {
        note: moderationNote || 'Dismissed as non-violating',
      });
      setActionSuccessMsg('Report dismissed successfully.');
      setConfirmDialog(null);
      await openReportDetail(activeReportId);
      fetchReports(pagination.page);
    } catch (err) {
      setError(err.message || 'Failed to dismiss report.');
    } finally {
      setActionInProgress(false);
    }
  };

  const getTargetIcon = (type) => {
    switch (type) {
      case 'PRODUCT':
        return <ShoppingBag className="w-4 h-4 text-blue-600" />;
      case 'USER':
        return <User className="w-4 h-4 text-purple-600" />;
      case 'REVIEW':
        return <Star className="w-4 h-4 text-amber-500" />;
      case 'WANTED_POST':
        return <FileText className="w-4 h-4 text-teal-600" />;
      case 'MESSAGE':
        return <MessageSquare className="w-4 h-4 text-slate-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-slate-500" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Resolved
          </span>
        );
      case 'DISMISSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <XCircle className="w-3 h-3" /> Dismissed
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Admin Moderation Portal</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review user reports, enforce community policies, and moderate violating listings or accounts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Back to Marketplace Button */}
          <button
            onClick={() => onNavigate('browse-products')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            title="Return to Public Campus Marketplace"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>

          {/* Analytics Dashboard */}
          <button
            onClick={() => onNavigate('admin-analytics')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition cursor-pointer"
            title="View Platform Analytics & Oversight"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics Dashboard</span>
          </button>

          <span className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl border border-slate-200">
            Admin: {user?.name}
          </span>

          {/* Logout Button */}
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

      {/* Global Alerts */}
      {actionSuccessMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-900">✕</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Total Reports</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{summary.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
          <span className="text-xs text-amber-700 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </span>
          <p className="text-2xl font-bold text-amber-700 mt-1">{summary.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
          <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
          </span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.resolved}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Dismissed
          </span>
          <p className="text-2xl font-bold text-slate-700 mt-1">{summary.dismissed}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>

          <select
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Target Types</option>
            <option value="PRODUCT">Products</option>
            <option value="USER">Users</option>
            <option value="REVIEW">Reviews</option>
            <option value="WANTED_POST">Wanted Posts</option>
            <option value="MESSAGE">Messages</option>
          </select>
        </div>

        <button
          onClick={() => fetchReports(pagination.page)}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-lg px-3 py-1.5 transition cursor-pointer"
        >
          Refresh List
        </button>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></div>
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-700">No reports found.</p>
            <p className="text-slate-400 mt-1">There are no reports matching the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Reporter</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <tr key={report._id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {getTargetIcon(report.targetType)}
                        <span className="font-semibold text-slate-900">{report.targetType}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        ID: {report.targetId?.slice(-6)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-slate-800">{report.reason}</span>
                      {report.description && (
                        <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                          "{report.description}"
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-slate-900 block">{report.reporter?.name || 'Anonymous'}</span>
                      <span className="text-[10px] text-slate-400 block">{report.reporter?.email}</span>
                    </td>
                    <td className="px-4 py-3.5">{getStatusBadge(report.status)}</td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => openReportDetail(report._id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
            <span>
              Showing Page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} items)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={!pagination.hasPreviousPage}
                onClick={() => fetchReports(pagination.page - 1)}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white disabled:opacity-40 cursor-pointer font-medium"
              >
                Previous
              </button>
              <button
                disabled={!pagination.hasNextPage}
                onClick={() => fetchReports(pagination.page + 1)}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white disabled:opacity-40 cursor-pointer font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Detail Modal / Drawer */}
      {activeReportId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                  <ShieldAlert className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900">Report Inspection &amp; Moderation</h3>
              </div>
              <button
                onClick={() => {
                  setActiveReportId(null);
                  setActiveReportDetail(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs">
              {detailLoading ? (
                <div className="py-12 text-center text-slate-500">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  Loading report &amp; target content...
                </div>
              ) : activeReportDetail ? (
                <>
                  {/* Report Overview Header */}
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getTargetIcon(activeReportDetail.report.targetType)}
                        <span className="font-bold text-slate-900 uppercase">
                          {activeReportDetail.report.targetType} REPORT
                        </span>
                        <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {activeReportDetail.report.reason}
                        </span>
                      </div>
                      {getStatusBadge(activeReportDetail.report.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-slate-600 pt-2 border-t border-slate-200/60">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Reporter</span>
                        <span className="font-semibold text-slate-800">{activeReportDetail.report.reporter?.name}</span>
                        <span className="text-slate-400 block">{activeReportDetail.report.reporter?.email}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Reported At</span>
                        <span>{new Date(activeReportDetail.report.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {activeReportDetail.report.description && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Reporter Description</span>
                        <p className="mt-1 text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 italic">
                          "{activeReportDetail.report.description}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Target Snapshot Preview */}
                  <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <h4 className="font-bold text-slate-900 flex items-center justify-between">
                      <span>Associated Target Content</span>
                      {!activeReportDetail.targetExists && (
                        <span className="text-rose-600 font-normal text-[11px]">(Target content deleted / missing)</span>
                      )}
                    </h4>

                    {activeReportDetail.targetExists && activeReportDetail.target ? (
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                        {activeReportDetail.report.targetType === 'PRODUCT' && (
                          <>
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-bold text-slate-900 text-sm">{activeReportDetail.target.title}</span>
                                <span className="block text-indigo-600 font-bold mt-0.5">
                                  {activeReportDetail.target.price} {activeReportDetail.target.currency} &bull; Condition: {activeReportDetail.target.condition}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-800">
                                Status: {activeReportDetail.target.status}
                              </span>
                            </div>
                            <p className="text-slate-600 line-clamp-3">{activeReportDetail.target.description}</p>
                            <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                              Seller: <span className="font-semibold text-slate-800">{activeReportDetail.target.seller?.name}</span> ({activeReportDetail.target.seller?.email})
                            </div>
                          </>
                        )}

                        {activeReportDetail.report.targetType === 'WANTED_POST' && (
                          <>
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-slate-900 text-sm">{activeReportDetail.target.title}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-800">
                                {activeReportDetail.target.status}
                              </span>
                            </div>
                            <p className="text-slate-600">{activeReportDetail.target.description}</p>
                            <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                              Author: <span className="font-semibold text-slate-800">{activeReportDetail.target.author?.name}</span> ({activeReportDetail.target.author?.email})
                            </div>
                          </>
                        )}

                        {activeReportDetail.report.targetType === 'REVIEW' && (
                          <>
                            <div className="flex items-center gap-1 text-amber-500 font-bold">
                              ★ {activeReportDetail.target.rating} / 5
                            </div>
                            <p className="text-slate-700 italic">"{activeReportDetail.target.comment}"</p>
                            <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200 flex justify-between">
                              <span>By: {activeReportDetail.target.reviewer?.name}</span>
                              <span>Target: {activeReportDetail.target.reviewee?.name}</span>
                            </div>
                          </>
                        )}

                        {activeReportDetail.report.targetType === 'USER' && (
                          <>
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-bold text-slate-900 text-sm">{activeReportDetail.target.name}</span>
                                <span className="text-slate-500 block">{activeReportDetail.target.email}</span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-800">
                                Account: {activeReportDetail.target.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-2 border-t border-slate-200">
                              <span>Department: {activeReportDetail.target.department || 'N/A'}</span>
                              <span>Batch: {activeReportDetail.target.batch || 'N/A'}</span>
                              <span>Student ID: {activeReportDetail.target.studentId || 'N/A'}</span>
                              <span>Reputation: {activeReportDetail.target.reputation?.averageRating || 0} ★</span>
                            </div>
                          </>
                        )}

                        {activeReportDetail.report.targetType === 'MESSAGE' && (
                          <>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">Reported Message Content:</span>
                            <p className="text-slate-800 bg-white p-2 rounded border border-slate-200 font-mono text-[11px]">
                              {activeReportDetail.target.text}
                            </p>
                            <div className="text-[11px] text-slate-500 pt-1 flex justify-between">
                              <span>Sender: {activeReportDetail.target.sender?.name} ({activeReportDetail.target.sender?.email})</span>
                              <span>Recipient: {activeReportDetail.target.recipient?.name}</span>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                        Content was already removed or does not exist.
                      </p>
                    )}
                  </div>

                  {/* Audit Trail (If already finalized) */}
                  {(activeReportDetail.report.status === 'RESOLVED' || activeReportDetail.report.status === 'DISMISSED') && (
                    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-2">
                      <h4 className="font-bold text-slate-900">Moderation Audit Record</h4>
                      <div className="grid grid-cols-2 gap-3 text-slate-600">
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 font-bold block">Moderator</span>
                          <span className="font-semibold text-slate-800">{activeReportDetail.report.moderator?.name || 'Administrator'}</span>
                          <span className="text-slate-400 block">{activeReportDetail.report.moderator?.email}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 font-bold block">Finalized At</span>
                          <span>{activeReportDetail.report.moderatedAt ? new Date(activeReportDetail.report.moderatedAt).toLocaleString() : 'N/A'}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Action Taken</span>
                        <span className="font-mono font-semibold text-indigo-700 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                          {activeReportDetail.report.moderationAction || 'NONE'}
                        </span>
                      </div>
                      {activeReportDetail.report.moderationNote && (
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 font-bold block">Moderation Note</span>
                          <p className="mt-0.5 text-slate-700 bg-white p-2 rounded border border-slate-200">
                            {activeReportDetail.report.moderationNote}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Moderation Controls (Only available for PENDING reports) */}
                  {activeReportDetail.report.status === 'PENDING' && (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                      <h4 className="font-bold text-slate-900">Take Moderation Decision</h4>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Select Action to Apply</label>
                        <select
                          value={selectedAction}
                          onChange={(e) => setSelectedAction(e.target.value)}
                          className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="NONE">No Content Mutation (Resolve report only)</option>
                          {activeReportDetail.report.targetType === 'PRODUCT' && (
                            <option value="DEACTIVATE_PRODUCT">Deactivate Listing (Set Inactive &amp; Rejected)</option>
                          )}
                          {activeReportDetail.report.targetType === 'WANTED_POST' && (
                            <option value="CLOSE_WANTED_POST">Close Wanted Post (Set Closed)</option>
                          )}
                          {activeReportDetail.report.targetType === 'REVIEW' && (
                            <option value="HIDE_REVIEW">Hide Review &amp; Recalculate Rating</option>
                          )}
                          <option value="SUSPEND_USER">Suspend User / Offender Account</option>
                          <option value="BAN_USER">Permanently Ban User / Offender Account</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Administrative Note / Reason</label>
                        <textarea
                          rows={2}
                          value={moderationNote}
                          onChange={(e) => setModerationNote(e.target.value)}
                          placeholder="Provide context or explanation for this moderation action..."
                          className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-indigo-100">
                        <button
                          type="button"
                          onClick={() => setConfirmDialog({ type: 'dismiss' })}
                          disabled={actionInProgress}
                          className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer transition"
                        >
                          Dismiss Report
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDialog({ type: 'resolve', action: selectedAction })}
                          disabled={actionInProgress}
                          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer shadow-sm transition"
                        >
                          Confirm &amp; Resolve
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200 shadow-2xl text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
              confirmDialog.type === 'resolve' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'
            }`}>
              {confirmDialog.type === 'resolve' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            </div>
            <h4 className="text-base font-bold text-slate-900">
              {confirmDialog.type === 'resolve' ? 'Confirm Resolution' : 'Confirm Dismissal'}
            </h4>
            <p className="text-xs text-slate-500">
              {confirmDialog.type === 'resolve'
                ? `Are you sure you want to resolve this report with action '${selectedAction || 'NONE'}'? This decision is irreversible.`
                : 'Are you sure you want to dismiss this report as non-violating?'}
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold text-xs cursor-pointer hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDialog.type === 'resolve' ? handleResolve : handleDismiss}
                disabled={actionInProgress}
                className={`px-4 py-2 rounded-lg text-white font-semibold text-xs cursor-pointer shadow-sm ${
                  confirmDialog.type === 'resolve' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-700 hover:bg-slate-800'
                }`}
              >
                {actionInProgress ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminModerationPage;
