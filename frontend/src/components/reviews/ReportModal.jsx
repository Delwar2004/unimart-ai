import { useState } from 'react';
import { reportService } from '../../services/api';

const REASONS = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'SCAM', label: 'Scam/Fraud' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate' },
  { value: 'COUNTERFEIT', label: 'Counterfeit' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'MISLEADING', label: 'Misleading' },
  { value: 'OTHER', label: 'Other' },
];

const MAX_DESCRIPTION = 1000;

export const ReportModal = ({ open, onClose, targetType, targetId, title = 'Report' }) => {
  const [reason, setReason] = useState('MISLEADING');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (description.trim().length > MAX_DESCRIPTION) {
      setError(`Description cannot exceed ${MAX_DESCRIPTION} characters.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await reportService.create({
        targetType,
        targetId,
        reason,
        description: description.trim(),
      });
      setNotice('Report submitted. You can review it under My Reports.');
      setDescription('');
    } catch (err) {
      setError(err.message || 'Could not submit this report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 cursor-pointer">Close</button>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Reason</span>
          <select value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {REASONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Description (optional)</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={MAX_DESCRIPTION}
            rows={4}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="What should a moderator know?"
          />
        </label>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        {notice ? <p className="text-xs text-emerald-700">{notice}</p> : null}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-rose-700 py-2 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer">
          {busy ? 'Submitting...' : 'Submit report'}
        </button>
      </form>
    </div>
  );
};
