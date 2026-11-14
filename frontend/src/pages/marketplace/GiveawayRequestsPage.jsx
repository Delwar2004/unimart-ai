import { useEffect, useState } from 'react';
import { Gift, MessageCircle } from 'lucide-react';
import { conversationService, giveawayRequestService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { InterestStatusBadge } from '../../components/marketplace/InterestStatusBadge';

const GiveawayRequestsPage = ({ onOpenProduct, onOpenConversation, onOpenTransactions }) => {
  const { user } = useAuth();
  const userId = user?.id || user?._id;
  const [box, setBox] = useState('received');
  const [status, setStatus] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = status ? { status, limit: 20 } : { limit: 20 };
      const response = box === 'sent'
        ? await giveawayRequestService.getSent(params)
        : await giveawayRequestService.getReceived(params);
      setRequests(response.data?.requests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [box, status]);

  const run = async (id, action) => {
    setBusyId(id);
    setNotice('');
    setError('');
    try {
      if (action === 'accept') await giveawayRequestService.accept(id);
      if (action === 'reject') await giveawayRequestService.reject(id);
      if (action === 'cancel') await giveawayRequestService.cancel(id);
      setNotice(action === 'accept' ? 'Giveaway accepted. Confirm it from Transactions.' : 'Giveaway request updated.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const messageParty = async (item) => {
    const mine = userId === item.requester?._id;
    const recipientId = mine ? item.owner?._id : item.requester?._id;
    if (!recipientId || !item.product?._id) return;
    const response = await conversationService.createConversation({ recipientId, productId: item.product._id });
    onOpenConversation?.(response.data?._id);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-slate-700" />
        <h1 className="text-2xl font-semibold text-slate-900">Giveaway requests</h1>
      </div>
      <p className="text-sm text-slate-600">Ask to receive a free campus giveaway. Accepting reserves the listing at an agreed value of zero until both students confirm.</p>
      <div className="flex flex-wrap gap-2">
        {['received', 'sent'].map((value) => (
          <button key={value} type="button" onClick={() => setBox(value)} className={`rounded-full px-3 py-1 text-sm font-semibold ${box === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>
            {value === 'received' ? 'Received' : 'Sent'}
          </button>
        ))}
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-full border border-slate-200 px-3 py-1 text-sm">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading giveaway requests...</p> : null}
      {!loading && requests.length === 0 ? <p className="text-sm text-slate-500">No giveaway requests in this view.</p> : null}
      <div className="space-y-3">
        {requests.map((item) => (
          <article key={item._id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <button type="button" onClick={() => onOpenProduct?.(item.product?._id)} className="font-semibold text-slate-900 hover:underline">
                  {item.product?.title || 'Giveaway'}
                </button>
                <p className="text-xs text-slate-500">
                  {userId === item.requester?._id ? 'Owner' : 'Requester'}: {(userId === item.requester?._id ? item.owner : item.requester)?.name || 'Student'}
                </p>
              </div>
              <InterestStatusBadge status={item.status} />
            </div>
            {item.message ? <p className="mt-2 text-sm text-slate-700">{item.message}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {box === 'received' && item.status === 'pending' ? (
                <>
                  <button type="button" disabled={busyId === item._id} onClick={() => run(item._id, 'accept')} className="rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white">Accept</button>
                  <button type="button" disabled={busyId === item._id} onClick={() => run(item._id, 'reject')} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700">Reject</button>
                </>
              ) : null}
              {box === 'sent' && item.status === 'pending' ? (
                <button type="button" disabled={busyId === item._id} onClick={() => run(item._id, 'cancel')} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700">Cancel</button>
              ) : null}
              {item.status === 'accepted' ? (
                <button type="button" onClick={() => onOpenTransactions?.()} className="rounded-xl bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white">Open transaction</button>
              ) : null}
              <button type="button" onClick={() => messageParty(item)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700">
                <MessageCircle className="h-4 w-4" /> Message
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default GiveawayRequestsPage;
