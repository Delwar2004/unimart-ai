import { useEffect, useState } from 'react';
import { categoryService, wantedPostService } from '../../services/api';

const empty = { title: '', description: '', categoryId: '', budgetMin: '', budgetMax: '', campusLocation: '' };

const WantedPostForm = ({ postId, onSaved, onCancel }) => {
  const [form, setForm] = useState(empty);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    categoryService.getCategories().then((response) => setCategories(response.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!postId) return;
    wantedPostService.getById(postId).then((response) => {
      const post = response.data;
      setForm({
        title: post.title || '',
        description: post.description || '',
        categoryId: post.category?._id || '',
        budgetMin: post.budgetMin ?? '',
        budgetMax: post.budgetMax ?? '',
        campusLocation: post.campusLocation || '',
      });
    }).catch((err) => setError(err.message));
  }, [postId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      campusLocation: form.campusLocation.trim(),
      categoryId: form.categoryId || null,
      budgetMin: form.budgetMin === '' ? null : Number(form.budgetMin),
      budgetMax: form.budgetMax === '' ? null : Number(form.budgetMax),
    };
    try {
      const response = postId
        ? await wantedPostService.update(postId, payload)
        : await wantedPostService.create(payload);
      onSaved?.(response.data?._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h1 className="text-2xl font-semibold text-slate-900">{postId ? 'Edit wanted post' : 'New wanted post'}</h1>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Title</span>
        <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Description</span>
        <textarea required rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Category</span>
        <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
          <option value="">Any</option>
          {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Minimum budget</span>
          <input type="number" min="0" value={form.budgetMin} onChange={(event) => setForm({ ...form, budgetMin: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Maximum budget</span>
          <input type="number" min="0" value={form.budgetMax} onChange={(event) => setForm({ ...form, budgetMax: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Campus location</span>
        <input value={form.campusLocation} onChange={(event) => setForm({ ...form, campusLocation: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
      </label>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {submitting ? 'Saving...' : 'Save wanted post'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
      </div>
    </form>
  );
};

export default WantedPostForm;
