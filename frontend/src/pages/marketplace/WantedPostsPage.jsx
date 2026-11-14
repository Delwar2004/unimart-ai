import { useEffect, useState } from 'react';
import { Search, PlusCircle, Sparkles } from 'lucide-react';
import { categoryService, wantedPostService } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

const WantedPostsPage = ({ onOpenWanted, onCreateWanted }) => {
  const { t, isBangla } = useLanguage();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ q: '', category: '', minBudget: '', maxBudget: '', campusLocation: '' });
  const [draft, setDraft] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    categoryService.getCategories().then((response) => setCategories(response.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const params = { page, limit: 8 };
        if (filters.q) params.q = filters.q;
        if (filters.category) params.category = filters.category;
        if (filters.minBudget) params.minBudget = filters.minBudget;
        if (filters.maxBudget) params.maxBudget = filters.maxBudget;
        if (filters.campusLocation) params.campusLocation = filters.campusLocation;
        const response = await wantedPostService.getAll(params);
        setPosts(response.data?.posts || []);
        setPagination(response.data?.pagination || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filters, page]);

  const budgetLabel = (post) => {
    if (post.budgetMin == null && post.budgetMax == null) return isBangla ? 'বাজেট উন্মুক্ত' : 'Budget open';
    if (post.budgetMin != null && post.budgetMax != null) return `৳${post.budgetMin} – ৳${post.budgetMax}`;
    if (post.budgetMax != null) return `Up to ৳${post.budgetMax}`;
    return `From ৳${post.budgetMin}`;
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isBangla ? 'প্রয়োজনীয় পণ্যের অনুরোধ' : 'Wanted Requests'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isBangla
              ? 'ক্যাম্পাস সহপাঠীদের কাছ থেকে প্রয়োজনীয় বই, ক্যালকুলেটর বা সামগ্রী চেয়ে পোস্ট করুন।'
              : 'Students looking for textbooks, notes, lab gear, and campus equipment.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateWanted}
          className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 px-5 py-3 text-xs sm:text-sm font-extrabold text-white shadow-md shadow-indigo-500/20 active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{isBangla ? '+ অনুরোধ যোগ করুন' : '+ Post a Request'}</span>
        </button>
      </div>

      <form
        className="grid gap-3 rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-5 md:grid-cols-5 shadow-xs"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setFilters(draft);
        }}
      >
        <label className="text-xs md:col-span-2">
          <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{t('search_btn')}</span>
          <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={draft.q}
              onChange={(event) => setDraft({ ...draft, q: event.target.value })}
              className="w-full py-2.5 text-xs sm:text-sm outline-none bg-transparent text-slate-900 dark:text-white"
              placeholder={isBangla ? 'শিরোনাম বা বিস্তারিত দিয়ে খুঁজুন' : 'Title or description'}
            />
          </span>
        </label>
        <label className="text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{t('category')}</span>
          <select
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
            className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2.5 text-xs sm:text-sm"
          >
            <option value="">{t('all_categories')}</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{t('min_price')}</span>
          <input
            value={draft.minBudget}
            onChange={(event) => setDraft({ ...draft, minBudget: event.target.value })}
            className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2.5 text-xs sm:text-sm"
            placeholder="Min ৳"
          />
        </label>
        <label className="text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{t('max_price')}</span>
          <input
            value={draft.maxBudget}
            onChange={(event) => setDraft({ ...draft, maxBudget: event.target.value })}
            className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2.5 text-xs sm:text-sm"
            placeholder="Max ৳"
          />
        </label>
        <label className="text-xs md:col-span-4">
          <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{t('campus_spot')}</span>
          <input
            value={draft.campusLocation}
            onChange={(event) => setDraft({ ...draft, campusLocation: event.target.value })}
            className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2.5 text-xs sm:text-sm"
            placeholder="BUP Library, FST Lab, Cafeteria"
          />
        </label>
        <button
          type="submit"
          className="rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white md:self-end cursor-pointer shadow-xs"
        >
          {t('search_btn')}
        </button>
      </form>

      {error ? <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
      {loading ? <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Loading requests...</p> : null}
      {!loading && posts.length === 0 ? (
        <div className="bg-white/90 dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
          {isBangla ? 'কোনো অনুরোধ পোস্ট মেলেনি।' : 'No wanted posts match these filters.'}
        </div>
      ) : null}

      <div className="grid gap-3.5">
        {posts.map((post) => (
          <button
            key={post._id}
            type="button"
            onClick={() => onOpenWanted?.(post._id)}
            className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-5 text-left hover:border-indigo-500/50 hover:shadow-md transition cursor-pointer"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">{post.title}</h2>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                {post.status}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {post.description}
            </p>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
              {post.category?.name || 'Any category'} · {budgetLabel(post)} · {post.campusLocation || 'Any campus'} · {post.author?.name || 'Student'} · {new Date(post.createdAt).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            type="button"
            disabled={!pagination.hasPreviousPage}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs sm:text-sm font-semibold disabled:opacity-40 cursor-pointer"
          >
            &larr; {isBangla ? 'পূর্ববর্তী' : 'Previous'}
          </button>
          <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={!pagination.hasNextPage}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs sm:text-sm font-semibold disabled:opacity-40 cursor-pointer"
          >
            {isBangla ? 'পরবর্তী' : 'Next'} &rarr;
          </button>
        </div>
      ) : null}
    </section>
  );
};

export default WantedPostsPage;
