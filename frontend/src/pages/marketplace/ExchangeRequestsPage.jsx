import { useEffect, useState } from 'react';
import { ArrowLeftRight, MessageCircle } from 'lucide-react';
import { conversationService, exchangeRequestService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { InterestStatusBadge } from '../../components/marketplace/InterestStatusBadge';
import { TransactionReviewPanel } from '../../components/reviews/TransactionReviewPanel';

const ExchangeRequestsPage = ({ onOpenProduct, onOpenConversation }) => {
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
        ? await exchangeRequestService.getSent(params)
        : await exchangeRequestService.getReceived(params);
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
      if (action === 'accept') await exchangeRequestService.accept(id);
      if (action === 'reject') await exchangeRequestService.reject(id);
      if (action === 'cancel') await exchangeRequestService.cancel(id);
      setNotice('Exchange request updated.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const runTransaction = async (item, action) => {
    const transactionId = item.exchangeTransaction?._id;
    if (!transactionId) return;
    setBusyId(transactionId);
    setNotice('');
    setError('');
    try {
      if (action === 'confirm') await exchangeRequestService.confirmTransaction(transactionId);
      if (action === 'cancel-exchange') {
        const reason = window.prompt('Why are you cancelling this exchange?') || '';
        await exchangeRequestService.cancelTransaction(transactionId, { cancellationReason: reason });
      }
      setNotice('Exchange updated.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const messageParty = async (item) => {
    const mine = userId === item.proposer?._id;
    const recipientId = mine ? item.owner?._id : item.proposer?._id;
    const productId = item.requestedProduct?._id;
    if (!recipientId) return;
    const response = await conversationService.createConversation({ recipientId, productId });
    onOpenConversation?.(response.data?._id);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="h-5 w-5 text-slate-700" />
        <h1 className="text-2xl font-semibold text-slate-900">Exchange requests</h1>
      </div>
      <p className="text-sm text-slate-600">Propose one of your exchange listings for another student&apos;s item. Accepting reserves both products until both students confirm.</p>
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
      {loading ? <p className="text-sm text-slate-500">Loading exchange requests...</p> : null}
      {!loading && requests.length === 0 ? <p className="text-sm text-slate-500">No exchange requests in this view.</p> : null}
      <div className="space-y-3">
        {requests.map((item) => {
          const active = ['PENDING', 'CONFIRMED_BY_PROPOSER', 'CONFIRMED_BY_OWNER'].includes(item.exchangeTransaction?.status);
          const mineProposer = userId === item.proposer?._id;
          const already = mineProposer ? item.exchangeTransaction?.proposerConfirmed : item.exchangeTransaction?.ownerConfirmed;
          return (
            <article key={item._id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <button type="button" onClick={() => onOpenProduct?.(item.requestedProduct?._id)} className="font-semibold text-slate-900 hover:underline">
                    Requested: {item.requestedProduct?.title || 'Listing'}
                  </button>
                  <p className="text-sm text-slate-600">Offered: {item.offeredProduct?.title || 'Listing'}</p>
                  <p className="text-xs text-slate-500">{mineProposer ? 'Owner' : 'Proposer'}: {(mineProposer ? item.owner : item.proposer)?.name || 'Student'}</p>
                </div>
                <InterestStatusBadge status={item.status} />
              </div>
              {item.message ? <p className="mt-2 text-sm text-slate-700">{item.message}</p> : null}
              {item.exchangeTransaction ? <p className="mt-2 text-xs font-medium text-slate-500">Exchange: {item.exchangeTransaction.status.replaceAll('_', ' ')}</p> : null}
              {item.exchangeTransaction?.status === 'COMPLETED' ? (
                <div className="mt-3">
                  <TransactionReviewPanel transactionId={item.exchangeTransaction._id} />
                </div>
              ) : null}
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
                {active && !already ? (
                  <button type="button" disabled={busyId === item.exchangeTransaction._id} onClick={() => runTransaction(item, 'confirm')} className="rounded-xl bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white">Confirm exchange</button>
                ) : null}
                {active ? (
                  <button type="button" disabled={busyId === item.exchangeTransaction._id} onClick={() => runTransaction(item, 'cancel-exchange')} className="rounded-xl border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-700">Cancel exchange</button>
                ) : null}
                <button type="button" onClick={() => messageParty(item)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700">
                  <MessageCircle className="h-4 w-4" /> Message
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default ExchangeRequestsPage;
