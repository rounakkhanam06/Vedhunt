import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Clock, ExternalLink, ClipboardCheck } from 'lucide-react';
import clientApi from '../../services/clientApi';

// What Vedhunt has asked the client to approve (strategy, budget, creative …) and the history.
// The client decides here; an answer given another way is recorded by the team with its source.
const STATUS = {
  Pending: { label: 'Waiting for you', icon: Clock, cls: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/25' },
  Approved: { label: 'Approved', icon: CheckCircle2, cls: 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25' },
  Rejected: { label: 'Changes requested', icon: XCircle, cls: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25' },
  Cancelled: { label: 'Withdrawn', icon: XCircle, cls: 'text-[#9CA3AF] bg-white/5 border-white/10' },
};
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

function Card({ a, onDone }) {
  const s = STATUS[a.status] || STATUS.Pending;
  const Icon = s.icon;
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (decision) => {
    setBusy(true);
    try {
      const res = await clientApi.put(`/client/approvals/${a._id}`, { decision, note });
      toast.success(res.data.message);
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save your answer');
    } finally { setBusy(false); }
  };

  return (
    <li className="rounded-xl border border-border-default bg-bg-surface/30 p-4 space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[10px] uppercase tracking-wider font-bold text-[#9CA3AF]">{a.kind}</span>
        <h3 className="text-white text-sm font-semibold">{a.title}</h3>
        {a.versionLabel && <span className="text-xs text-[#9CA3AF]">· {a.versionLabel}</span>}
        <span className={`ml-auto inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}><Icon size={12} /> {s.label}</span>
      </div>
      {a.amount != null && <p className="text-sm text-white">Budget: <strong>{inr(a.amount)}</strong> per month</p>}
      {a.details && <p className="text-sm text-[#C3C8D2] whitespace-pre-line leading-relaxed">{a.details}</p>}
      {a.linkUrl && <a href={a.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink size={12} /> View it</a>}
      <p className="text-[11px] text-[#6B7280]">Asked {day(a.requestedAt)}</p>

      {a.status !== 'Pending' && (
        <p className="text-xs text-[#9CA3AF]">
          {a.status === 'Cancelled' ? 'Withdrawn' : a.decidedByClient ? `You ${a.status === 'Approved' ? 'approved' : 'asked for changes'}` : `Recorded by Vedhunt as ${a.status === 'Approved' ? 'approved' : 'changes requested'} (${a.channel})`} on {day(a.decidedAt)}.
          {a.note && <span className="block mt-1 text-[#C3C8D2]">“{a.note}”</span>}
        </p>
      )}

      {a.status === 'Pending' && !rejecting && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" disabled={busy} onClick={() => decide('approve')} className="px-4 py-2 rounded-xl bg-[#22C55E] text-black text-sm font-semibold hover:opacity-90 disabled:opacity-60 cursor-pointer">Approve</button>
          <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="px-4 py-2 rounded-xl border border-border-default text-sm text-[#E5E7EB] hover:bg-white/5 cursor-pointer">Ask for changes…</button>
        </div>
      )}
      {a.status === 'Pending' && rejecting && (
        <div className="space-y-2 pt-1">
          <label className="block text-[#E5E7EB] text-xs font-medium" htmlFor={`appr-${a._id}`}>What should change?</label>
          <textarea id={`appr-${a._id}`} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full px-3.5 py-3 bg-bg-surface/50 border border-border-default rounded-xl text-white text-sm focus:outline-none focus:border-primary/60 resize-none" />
          <div className="flex gap-2">
            <button type="button" disabled={busy || note.trim().length < 5} onClick={() => decide('reject')} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">Send</button>
            <button type="button" onClick={() => { setRejecting(false); setNote(''); }} className="px-4 py-2 rounded-xl border border-border-default text-sm text-[#E5E7EB] cursor-pointer">Cancel</button>
          </div>
        </div>
      )}
    </li>
  );
}

const ApprovalsTab = () => {
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState({ key: null, rows: [], error: '' });

  useEffect(() => {
    let live = true;
    clientApi.get('/client/approvals')
      .then(({ data }) => { if (live) setResult({ key: reload, rows: data.data, error: '' }); })
      .catch(() => { if (live) setResult({ key: reload, rows: [], error: 'Could not load your approvals.' }); });
    return () => { live = false; };
  }, [reload]);

  if (result.key !== reload) return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-primary/30 border-t-[#FF5A1F] rounded-full animate-spin" /></div>;
  const pending = result.rows.filter((r) => r.status === 'Pending');
  const history = result.rows.filter((r) => r.status !== 'Pending');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white text-lg font-semibold flex items-center gap-2"><ClipboardCheck size={18} className="text-primary" /> Approvals</h2>
        <p className="text-[#9CA3AF] text-xs mt-1">Strategy, budget and creatives we need your go-ahead on before we proceed.</p>
      </div>
      {result.error && <p className="text-[#EF4444] text-sm" role="alert">{result.error}</p>}
      {!result.rows.length && !result.error && <p className="text-sm text-[#9CA3AF] py-10 text-center rounded-xl border border-border-default bg-bg-surface/30">Nothing to approve right now.</p>}
      {pending.length > 0 && <ul className="space-y-3">{pending.map((a) => <Card key={a._id} a={a} onDone={() => setReload((n) => n + 1)} />)}</ul>}
      {history.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[#9CA3AF] text-[11px] uppercase font-bold tracking-wider">History</h3>
          <ul className="space-y-3">{history.map((a) => <Card key={a._id} a={a} onDone={() => setReload((n) => n + 1)} />)}</ul>
        </section>
      )}
    </div>
  );
};

export default ApprovalsTab;
