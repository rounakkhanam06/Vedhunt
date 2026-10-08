import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { proposalApi } from '../lib/proposalApi';
import { fmtINR } from '../lib/datetime';
import { emptyItem } from '../lib/proposal';

const field = 'w-full bg-form-input-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary/50';
const label = 'block text-[10px] font-bold text-app-text-muted uppercase tracking-wider mb-1';

const TITLE_SUGGESTIONS = [
  'Performance Marketing Proposal', 'Digital Marketing Proposal', 'Website Development Proposal',
  'Social Media Management Proposal', 'SEO Proposal', 'Mobile App Development Proposal', 'Dashboard & Automation Proposal',
];

// [key, label, type] — type: input (default) | text (textarea rows)
const GROUPS = [
  ['Client', [['clientName', 'Client / business name *'], ['website', 'Website'], ['contactPerson', 'Contact person'],
    ['contactDesignation', 'Contact designation'], ['email', 'Client email'], ['phone', 'Client phone']]],
  ['Billing (for the proforma invoice)', [['address', 'Billing address', 2], ['gstin', 'Client GSTIN'], ['pan', 'Client PAN']]],
  ['What we understand about the client', [['industry', 'Industry / category'], ['businessModel', 'Business model'],
    ['targetAudience', 'Target customer / geography'], ['currentStatus', 'Current marketing / tech status'],
    ['painPoints', 'Key pain points', 2], ['goal', 'Business goal for this engagement', 2]]],
  ['Proposal', [['requirement', 'Requirement *', 3], ['scope', 'Scope of work *', 4], ['deliverables', 'Deliverables (one per line)', 4],
    ['timeline', 'Timeline / engagement process (one step per line)', 3], ['paymentTerms', 'Payment terms', 2],
    ['clientRequirements', 'What we need from the client (one per line)', 3], ['assumptions', 'Assumptions (one per line)', 2],
    ['exclusions', 'Exclusions (one per line)', 2], ['notes', 'Special notes', 2]]],
];

/** Proposal fields + Service Master line items. Controlled: `form` / `setForm` live in ProposalWorkflow. */
export default function ProposalForm({ form, setForm, portal = 'employee' }) {
  const proposals = proposalApi(portal);
  const { data: masters } = useQuery({ queryKey: proposals.keys.masters, queryFn: () => proposals.get('/proposal-masters'), staleTime: Infinity });
  const services = masters?.services || [];
  const states = masters?.states || [];

  const setDetail = (key, value) => setForm((f) => ({ ...f, details: { ...f.details, [key]: value } }));
  const setItem = (i, patch) => setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  const pickService = (i, name) => {
    const m = services.find((s) => s.name === name);
    setItem(i, m ? { service: m.name, description: m.description, sac: m.sac, uom: m.uom, gstPercent: m.gstPercent } : { service: name });
  };

  const taxable = form.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const gst = form.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0) * (Number(it.gstPercent) || 0) / 100, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className={label}>Proposal title</label>
          <input className={field} list="proposal-titles" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <datalist id="proposal-titles">{TITLE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
        <div>
          <label className={label}>Valid for (days)</label>
          <input type="number" min="1" max="180" className={field} value={form.validityDays} onChange={(e) => setForm((f) => ({ ...f, validityDays: e.target.value }))} />
        </div>
      </div>

      {GROUPS.map(([title, fields]) => (
        <fieldset key={title} className="space-y-3">
          <legend className="text-xs font-bold text-primary uppercase tracking-wider mb-2">{title}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map(([key, text, rows]) => (
              <div key={key} className={rows ? 'sm:col-span-2' : ''}>
                <label className={label}>{text}</label>
                {rows
                  ? <textarea rows={rows} className={`${field} resize-y`} value={form.details[key] || ''} onChange={(e) => setDetail(key, e.target.value)} />
                  : <input className={field} value={form.details[key] || ''} onChange={(e) => setDetail(key, e.target.value)} />}
              </div>
            ))}
            {title.startsWith('Billing') && (
              <div>
                <label className={label}>Place of supply (state)</label>
                <select className={field} value={form.details.placeOfSupply || ''} onChange={(e) => setDetail('placeOfSupply', e.target.value)}>
                  <option value="">Maharashtra (default)</option>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <p className="text-[10px] text-app-text-muted mt-1">Maharashtra → CGST + SGST; any other state → IGST.</p>
              </div>
            )}
          </div>
        </fieldset>
      ))}

      <fieldset className="space-y-3">
        <legend className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Services & commercials *</legend>
        {form.items.map((item, i) => (
          <div key={i} className="p-3 rounded-lg border border-app-border bg-form-input-bg/40 space-y-2">
            <div className="flex gap-2">
              <select className={field} value={services.some((s) => s.name === item.service) ? item.service : ''} onChange={(e) => pickService(i, e.target.value)} aria-label="Service">
                <option value="">Select a service from the Service Master…</option>
                {services.map((s) => <option key={s.name} value={s.name}>{s.name} · {s.uom}</option>)}
              </select>
              <button type="button" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))} disabled={form.items.length === 1}
                className="px-2 text-rose-400 hover:text-rose-300 disabled:opacity-30 cursor-pointer" aria-label="Remove line"><Trash2 size={15} /></button>
            </div>
            <textarea rows={2} className={`${field} resize-y`} placeholder="Line description (printed on the proposal and proforma)" value={item.description} onChange={(e) => setItem(i, { description: e.target.value })} />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div><label className={label}>HSN / SAC</label><input className={field} value={item.sac} onChange={(e) => setItem(i, { sac: e.target.value })} /></div>
              <div><label className={label}>Qty</label><input type="number" min="0" step="0.5" className={field} value={item.qty} onChange={(e) => setItem(i, { qty: e.target.value })} /></div>
              <div><label className={label}>Unit</label><input className={field} value={item.uom} onChange={(e) => setItem(i, { uom: e.target.value })} /></div>
              <div><label className={label}>Rate (₹)</label><input type="number" min="0" className={field} value={item.rate} onChange={(e) => setItem(i, { rate: e.target.value })} /></div>
              <div><label className={label}>GST %</label><input type="number" min="0" max="28" className={field} value={item.gstPercent} onChange={(e) => setItem(i, { gstPercent: e.target.value })} /></div>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }))} disabled={form.items.length >= 12}
          className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline disabled:opacity-40 cursor-pointer"><Plus size={14} /> Add service</button>
        {taxable > 0 && (
          <p className="text-xs text-app-text-muted">
            Subtotal {fmtINR(taxable)} + GST {fmtINR(gst)} = <span className="font-bold text-app-text">{fmtINR(taxable + gst)}</span>
          </p>
        )}
      </fieldset>
    </div>
  );
}
