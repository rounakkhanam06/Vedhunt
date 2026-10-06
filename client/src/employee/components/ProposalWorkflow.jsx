import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Eye, Pencil, CheckCircle2, Send, Download, Copy, ArrowLeft, ExternalLink, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import employeeApi from '../../services/employeeApi';
import { essGet, essPost, essPut, essKeys, apiError, openPdf, useEssProfile } from '../lib/ess';
import { fmtDate, fmtDateTime, fmtINR } from '../lib/datetime';
import { WHATSAPP_APPS, buildWhatsAppUrl, openWhatsApp } from '../lib/whatsapp';
import ProposalForm from './ProposalForm';
import { emptyItem } from '../lib/proposal';

const STATUS_CLASS = {
  Draft: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Final: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Shared: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Superseded: 'bg-gray-500/10 text-app-text-muted border-gray-500/20',
};
const field = 'w-full bg-form-input-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary/50';
const label = 'block text-[10px] font-bold text-app-text-muted uppercase tracking-wider mb-1';
const btn = 'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50';

function formFromLead(lead) {
  return {
    title: 'Business Proposal',
    validityDays: 15,
    details: {
      clientName: lead.businessName || lead.fullName || '',
      website: lead.website || '',
      contactPerson: lead.fullName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      industry: lead.businessType || '',
      requirement: lead.requirementSummary || lead.message || '',
      timeline: lead.timeline || '',
      paymentTerms: '100% advance payable before work begins.',
    },
    items: [emptyItem()],
  };
}
const formFromProposal = (p) => ({
  title: p.title || 'Business Proposal',
  validityDays: p.validityDays,
  details: { ...p.details },
  items: p.items?.length ? p.items.map(({ service, description, sac, uom, qty, rate, gstPercent }) => ({ service, description, sac, uom, qty, rate, gstPercent })) : [emptyItem()],
});

function PdfPreview({ proposal }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url = '';
    employeeApi.get(`/employee-portal/ess/proposals/${proposal._id}/pdf`, { responseType: 'blob' })
      .then(({ data }) => { url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' })); setSrc(url); })
      .catch(() => setFailed(true));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [proposal._id, proposal.updatedAt]);

  if (failed) return <p className="text-sm text-rose-400">Could not load the preview.</p>;
  if (!src) return <div className="h-[60vh] flex items-center justify-center text-sm text-app-text-muted">Rendering preview…</div>;
  return (
    <div className="space-y-2">
      <iframe title="Proposal preview" src={src} className="w-full h-[60vh] rounded-lg border border-app-border bg-white" />
      <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
        <ExternalLink size={12} /> Open preview in a new tab
      </a>
    </div>
  );
}

/**
 * Proposal generation & sharing for one lead: history → form (pre-filled
 * from the lead) → PDF preview → edit / generate final → share by Email or
 * WhatsApp. Finalizing and sharing are recorded on the lead timeline.
 */
export default function ProposalWorkflow({ lead, onClose, onLeadChanged }) {
  const queryClient = useQueryClient();
  const { data: me } = useEssProfile();
  const { data: proposals = [], isLoading } = useQuery({
    queryKey: essKeys.proposals(lead._id),
    queryFn: () => essGet(`/leads/${lead._id}/proposals`).then((d) => d.proposals || []),
  });

  const [view, setView] = useState('list'); // list | form | preview | share
  const [current, setCurrent] = useState(null); // proposal being previewed/shared
  const [form, setForm] = useState(null);
  const [basedOn, setBasedOn] = useState(null); // revising a final proposal
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [share, setShare] = useState({ channel: 'Email', recipient: '', message: '', app: 'web' });

  useEffect(() => {
    if (!isLoading && proposals.length === 0 && view === 'list') openForm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const refresh = (proposal) => {
    queryClient.invalidateQueries({ queryKey: essKeys.proposals(lead._id) });
    if (proposal) setCurrent(proposal);
  };

  function openForm(source, { revise = false } = {}) {
    setError('');
    setBasedOn(revise ? source._id : null);
    setCurrent(revise ? null : source);
    setForm(source ? formFromProposal(source) : formFromLead(lead));
    setView('form');
  }


  const saveForm = async () => {
    setBusy(true);
    setError('');
    try {
      const res = current?.status === 'Draft'
        ? await essPut(`/proposals/${current._id}`, form)
        : await essPost(`/leads/${lead._id}/proposals`, { ...form, basedOn: basedOn || undefined });
      refresh(res.proposal);
      setView('preview');
    } catch (err) {
      setError(apiError(err, 'Could not save the proposal.'));
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (!window.confirm('Generate the final proposal? It can no longer be edited — changes will need a new version.')) return;
    setBusy(true);
    try {
      const res = await essPost(`/proposals/${current._id}/finalize`);
      toast.success('Final proposal generated');
      refresh(res.proposal);
      onLeadChanged?.();
    } catch (err) {
      toast.error(apiError(err, 'Could not generate the final proposal.'));
    } finally {
      setBusy(false);
    }
  };

  const openShare = (proposal) => {
    setCurrent(proposal);
    const saved = me?.preferences?.whatsappApp;
    setShare({
      channel: 'Email',
      recipient: proposal.details?.email || lead.email || '',
      message: `Dear ${proposal.details?.contactPerson || proposal.details?.clientName},\n\nPlease find attached our proposal for ${proposal.details?.service}. Happy to walk you through it.`,
      app: saved && saved !== 'ask' ? saved : 'web',
    });
    setError('');
    setView('share');
  };

  const sendShare = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await essPost(`/proposals/${current._id}/share`, { channel: share.channel, recipient: share.recipient, message: share.message });
      if (share.channel === 'WhatsApp') {
        openWhatsApp(buildWhatsAppUrl(share.app, share.recipient, res.whatsappText));
        if (res.missingPdfLink) toast('The PDF link is unavailable — download the PDF and attach it in WhatsApp.', { icon: '⚠️' });
      }
      toast.success(`Proposal shared via ${share.channel}`);
      refresh(res.proposal);
      onLeadChanged?.();
      setView('list');
    } catch (err) {
      setError(apiError(err, 'Could not share the proposal.'));
    } finally {
      setBusy(false);
    }
  };

  // Allocates the proforma number on first open, so refresh the list afterwards.
  const proforma = (p) => openPdf(`/employee-portal/ess/proposals/${p._id}/proforma`)
    .then(() => { queryClient.invalidateQueries({ queryKey: essKeys.proposals(lead._id) }); onLeadChanged?.(); })
    .catch(() => toast.error('Could not generate the proforma invoice.'));

  const download = (p) => openPdf(`/employee-portal/ess/proposals/${p._id}/pdf?download=1`, { download: true, filename: `Proposal-${p.proposalNumber}-v${p.version}.pdf` })
    .catch(() => toast.error('Could not download the PDF.'));

  const hasDraftRevision = (p) => proposals.some((x) => x.proposalNumber === p.proposalNumber && x.status === 'Draft');
  const back = proposals.length > 0 && view !== 'list' && (
    <button type="button" onClick={() => setView('list')} className="text-xs font-semibold text-app-text-muted hover:text-app-text flex items-center gap-1 mb-4 cursor-pointer">
      <ArrowLeft size={14} /> All proposals
    </button>
  );

  return (
    <Modal title="Proposal" subtitle={`${lead.leadId} · ${lead.fullName}`} onClose={onClose} size={view === 'preview' ? 'xl' : 'lg'}>
      {back}

      {view === 'list' && (
        <div className="space-y-3">
          <button type="button" onClick={() => openForm(null)} className={`${btn} bg-primary text-white hover:bg-primary-hover`}>
            <Plus size={14} /> New proposal
          </button>
          {isLoading ? <p className="text-sm text-app-text-muted">Loading…</p> : proposals.map((p) => (
            <div key={p._id} className="p-4 rounded-xl border border-app-border bg-form-input-bg">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText size={14} className="text-primary" />
                  <span className="font-mono text-sm font-semibold text-app-text">{p.proposalNumber} v{p.version}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${STATUS_CLASS[p.status]}`}>{p.status}</span>
                </div>
                <span className="text-sm font-bold text-app-text">{fmtINR(p.totalAmount)} <span className="text-[11px] font-normal text-app-text-muted">incl. GST</span></span>
              </div>
              <p className="text-xs text-app-text-muted mt-1">
                {p.details?.service} · created {fmtDate(p.createdAt)}{p.finalizedAt ? ` · final ${fmtDate(p.finalizedAt)}` : ''}
              </p>
              {p.shares?.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {p.shares.map((s) => <li key={s._id} className="text-[11px] text-emerald-400">Shared via {s.channel} to {s.recipient} · {fmtDateTime(s.sharedAt)}</li>)}
                </ul>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button" className={`${btn} border border-app-border text-app-text hover:border-primary/40`} onClick={() => { setCurrent(p); setView('preview'); }}><Eye size={13} /> Preview</button>
                {p.status === 'Draft' && <button type="button" className={`${btn} border border-app-border text-app-text hover:border-primary/40`} onClick={() => openForm(p)}><Pencil size={13} /> Edit</button>}
                {['Final', 'Shared'].includes(p.status) && <button type="button" className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`} onClick={() => openShare(p)}><Send size={13} /> Share</button>}
                {['Final', 'Shared'].includes(p.status) && !hasDraftRevision(p) && (
                  <button type="button" className={`${btn} border border-app-border text-app-text hover:border-primary/40`} onClick={() => openForm(p, { revise: true })}><Copy size={13} /> New version</button>
                )}
                <button type="button" className={`${btn} border border-app-border text-app-text hover:border-primary/40`} onClick={() => download(p)}><Download size={13} /> PDF</button>
                {['Final', 'Shared'].includes(p.status) && (
                  <button type="button" className={`${btn} border border-app-border text-app-text hover:border-primary/40`} onClick={() => proforma(p)}>
                    <Receipt size={13} /> {p.proformaNumber ? `Proforma #${p.proformaNumber}` : 'Proforma invoice'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'form' && form && (
        <div className="space-y-4">
          {basedOn && <p className="text-xs text-blue-400">Creating a new version — the earlier one stays exactly as it was shared.</p>}
          <ProposalForm form={form} setForm={setForm} />
          {error && <p className="text-xs text-rose-400" role="alert">{error}</p>}
          <button type="button" disabled={busy} onClick={saveForm} className={`${btn} w-full bg-primary text-white hover:bg-primary-hover py-2.5`}>
            <Eye size={14} /> {busy ? 'Saving…' : 'Save & preview'}
          </button>
        </div>
      )}

      {view === 'preview' && current && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-app-text">{current.proposalNumber} v{current.version}</span>
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${STATUS_CLASS[current.status]}`}>{current.status}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {current.status === 'Draft' && (
                <>
                  <button type="button" className={`${btn} border border-app-border text-app-text hover:border-primary/40`} onClick={() => openForm(current)}><Pencil size={13} /> Edit</button>
                  <button type="button" disabled={busy} className={`${btn} bg-primary text-white hover:bg-primary-hover`} onClick={finalize}><CheckCircle2 size={13} /> {busy ? 'Generating…' : 'Generate final'}</button>
                </>
              )}
              {['Final', 'Shared'].includes(current.status) && (
                <>
                  <button type="button" className={`${btn} border border-app-border text-app-text hover:border-primary/40`} onClick={() => proforma(current)}><Receipt size={13} /> Proforma</button>
                  <button type="button" className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`} onClick={() => openShare(current)}><Send size={13} /> Share</button>
                </>
              )}
            </div>
          </div>
          <PdfPreview proposal={current} />
        </div>
      )}

      {view === 'share' && current && (
        <div className="space-y-4">
          <div className="flex bg-form-input-bg border border-app-border p-1 rounded-lg text-xs font-bold">
            {['Email', 'WhatsApp'].map((channel) => (
              <button key={channel} type="button"
                onClick={() => setShare((s) => ({ ...s, channel, recipient: channel === 'Email' ? (current.details?.email || lead.email || '') : (current.details?.phone || lead.phone || '') }))}
                className={`flex-1 py-1.5 rounded-md cursor-pointer ${share.channel === channel ? 'bg-primary text-white' : 'text-app-text-muted hover:text-app-text'}`}>
                {channel}
              </button>
            ))}
          </div>
          <div>
            <label className={label}>{share.channel === 'Email' ? 'Recipient email' : 'WhatsApp number'}</label>
            <input className={field} value={share.recipient} onChange={(e) => setShare((s) => ({ ...s, recipient: e.target.value }))} />
          </div>
          {share.channel === 'WhatsApp' && (
            <div>
              <label className={label}>Open with</label>
              <select className={field} value={share.app} onChange={(e) => setShare((s) => ({ ...s, app: e.target.value }))}>
                {WHATSAPP_APPS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={label}>Message</label>
            <textarea rows={5} className={`${field} resize-y`} value={share.message} onChange={(e) => setShare((s) => ({ ...s, message: e.target.value }))} />
            <p className="text-[11px] text-app-text-muted mt-1">
              {share.channel === 'Email' ? 'The PDF is attached automatically.' : 'The proposal summary and PDF link are added below your message.'}
            </p>
          </div>
          {error && <p className="text-xs text-rose-400" role="alert">{error}</p>}
          <button type="button" disabled={busy} onClick={sendShare} className={`${btn} w-full bg-emerald-600 text-white hover:bg-emerald-700 py-2.5`}>
            <Send size={14} /> {busy ? 'Sending…' : share.channel === 'Email' ? 'Send email' : 'Open WhatsApp'}
          </button>
        </div>
      )}
    </Modal>
  );
}
