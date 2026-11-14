import { useEffect, useState } from 'react';
import { reportService } from '../../services/api';

const STATUS_LABELS = {
  PENDING: 'Pending',
  REVIEWED: 'Reviewed',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
};

const formatWhen = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

export const MyReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async (nextPage = page) => {
    const response = await reportService.getMyReports({ page: nextPage, limit: 10 });
    setReports(response?.data || []);
    setMeta(response?.meta?.pagination || null);
  };

  useEffect(() => {
    load(page).catch((err) => setError(err.message || 'Could not load your reports.'));
  }, [page]);

  const withdraw = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await reportService.delete(id);
      await load(page);
    } catch (err) {
      setError(err.message || 'Could not withdraw this report.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Reports</h1>
        <p className="text-sm text-slate-600">Reports you submitted. Pending reports can be withdrawn. Moderation happens later.</p>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {reports.length === 0 ? <p className="text-sm text-slate-500">You have not submitted any reports.</p> : null}
      <div className="space-y-3">
        {reports.map((report) => (
          <article key={report._id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{report.targetType}</p>
                <p className="text-xs text-slate-500">{report.reason} · {formatWhen(report.createdAt)}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {STATUS_LABELS[report.status] || report.status}
              </span>
            </div>
            {report.description ? <p className="mt-2 text-sm text-slate-700 line-clamp-2">{report.description}</p> : null}
            {report.status === 'PENDING' ? (
              <button
                type="button"
                disabled={busyId === report._id}
                onClick={() => withdraw(report._id)}
                className="mt-3 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 cursor-pointer"
              >
                Withdraw
              </button>
            ) : null}
          </article>
        ))}
      </div>
      {meta && meta.totalPages > 1 ? (
        <div className="flex gap-2">
          <button type="button" disabled={!meta.hasPreviousPage} onClick={() => setPage((current) => current - 1)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50">Previous</button>
          <button type="button" disabled={!meta.hasNextPage} onClick={() => setPage((current) => current + 1)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50">Next</button>
        </div>
      ) : null}
    </section>
  );
};
