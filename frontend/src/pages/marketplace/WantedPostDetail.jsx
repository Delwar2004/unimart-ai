import { useEffect, useState } from 'react';
import { wantedPostService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ReportModal } from '../../components/reviews/ReportModal';

const WantedPostDetail = ({ postId, onEdit, onDeleted, onOpenConversation }) => {
  const { user, isAuthenticated } = useAuth();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);

  const load = async () => {
    const response = await wantedPostService.getById(postId);
    setPost(response.data);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [postId]);

  if (error && !post) return <p className="text-sm text-rose-600">{error}</p>;
  if (!post) return <p className="text-sm text-slate-500">Loading wanted post...</p>;

  const userId = user?.id || user?._id;
  const isOwner = userId && post.author?._id === userId;
  const budget = post.budgetMin == null && post.budgetMax == null
    ? 'Open'
    : `৳${post.budgetMin ?? '0'} – ৳${post.budgetMax ?? 'open'}`;

  const changeStatus = async (status) => {
    setBusy(true);
    setError('');
    try {
      await wantedPostService.updateStatus(post._id, status);
      setNotice(status === 'fulfilled' ? 'Marked as fulfilled.' : 'Wanted post closed.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this wanted post?')) return;
    setBusy(true);
    try {
      await wantedPostService.delete(post._id);
      onDeleted?.();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const contact = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await wantedPostService.contact(post._id);
      onOpenConversation?.(response.data?._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">{post.title}</h1>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-600">{post.status}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-slate-700">{post.description}</p>
      <dl className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <div><dt className="font-medium text-slate-800">Category</dt><dd>{post.category?.name || 'Any'}</dd></div>
        <div><dt className="font-medium text-slate-800">Budget</dt><dd>{budget}</dd></div>
        <div><dt className="font-medium text-slate-800">Campus</dt><dd>{post.campusLocation || 'Any'}</dd></div>
        <div><dt className="font-medium text-slate-800">Posted by</dt><dd>{post.author?.name || 'Student'} · {new Date(post.createdAt).toLocaleDateString()}</dd></div>
      </dl>
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {isOwner && post.status === 'active' ? (
          <>
            <button type="button" disabled={busy} onClick={() => onEdit?.(post._id)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Edit</button>
            <button type="button" disabled={busy} onClick={() => changeStatus('fulfilled')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Mark fulfilled</button>
            <button type="button" disabled={busy} onClick={() => changeStatus('closed')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Close</button>
          </>
        ) : null}
        {isOwner ? (
          <button type="button" disabled={busy} onClick={remove} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700">Delete</button>
        ) : null}
        {!isOwner && isAuthenticated && post.status === 'active' ? (
          <button type="button" disabled={busy} onClick={contact} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Contact requester</button>
        ) : null}
        {!isOwner && isAuthenticated ? (
          <button type="button" onClick={() => setReporting(true)} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700">Report Wanted Post</button>
        ) : null}
      </div>
      {reporting ? (
        <ReportModal
          open
          title="Report Wanted Post"
          targetType="WANTED_POST"
          targetId={post._id}
          onClose={() => setReporting(false)}
        />
      ) : null}
    </article>
  );
};

export default WantedPostDetail;
