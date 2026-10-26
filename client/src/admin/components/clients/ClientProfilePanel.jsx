import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Edit2, Save, X, Plus, Trash2 } from 'lucide-react';

const SERVICE_OPTIONS = ['Performance Marketing', 'Digital Marketing', 'Website Development', 'App Development', 'Social Media Management'];
const PLATFORM_OPTIONS = ['Meta', 'Google Ads'];

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const csv = (arr) => (arr || []).join(', ');
const list = (text) => String(text || '').split(',').map((s) => s.trim()).filter(Boolean);
const staffName = (s) => [s.firstName, s.lastName].filter(Boolean).join(' ');

const inputCls = 'w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:border-secondary';

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">{label}</label>
      {children}
      {hint && <p className="text-on-surface-variant text-[10px] mt-1">{hint}</p>}
    </div>
  );
}

function Chips({ items, empty = '—' }) {
  if (!items?.length) return <span className="text-on-surface text-sm">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => <span key={i} className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[11px] font-medium">{i}</span>)}
    </div>
  );
}

/**
 * Portfolio profile of a client (Client Portal CRM §3): sector/services,
 * platforms, account manager + dedicated team, dates, ad budget, signatory.
 * Status, fees and payments are NOT edited here — they come from the linked
 * retainers / invoices / payments.
 */
export default function ClientProfilePanel({ client, http, base, canEdit, onSaved }) {
  const profile = client.profile || {};
  const [staff, setStaff] = useState([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    let live = true;
    http.get(`${base}/clients-staff`).then((r) => { if (live) setStaff(r.data.data || []); }).catch(() => {});
    return () => { live = false; };
  }, [http, base]);

  const byId = useMemo(() => new Map(staff.map((s) => [String(s._id), s])), [staff]);
  const nameOf = (id) => { const s = byId.get(String(id?._id || id)); return s ? staffName(s) : '—'; };

  const startEdit = () => {
    const known = new Set(PLATFORM_OPTIONS);
    setForm({
      logoUrl: profile.logoUrl || '',
      domains: csv(profile.domains),
      sectors: csv(profile.sectors),
      services: profile.services || [],
      platforms: (profile.platforms || []).filter((p) => known.has(p)),
      otherPlatforms: csv((profile.platforms || []).filter((p) => !known.has(p))),
      accountManager: String(profile.accountManager?._id || profile.accountManager || ''),
      dedicatedTeam: (profile.dedicatedTeam || []).map((m) => ({ employee: String(m.employee?._id || m.employee), role: m.role || '' })),
      onboardingDate: toDateInput(profile.onboardingDate),
      adAccountLiveDate: toDateInput(profile.adAccountLiveDate),
      paymentReceivedDate: toDateInput(profile.paymentReceivedDate),
      monthlyAdBudget: profile.monthlyAdBudget ?? '',
      authorisedSignatory: profile.authorisedSignatory || '',
    });
    setEditing(true);
  };

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (k, v) => setForm((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        logoUrl: form.logoUrl,
        domains: list(form.domains),
        sectors: list(form.sectors),
        services: form.services,
        platforms: [...form.platforms, ...list(form.otherPlatforms)],
        accountManager: form.accountManager || null,
        dedicatedTeam: form.dedicatedTeam.filter((m) => m.employee),
        onboardingDate: form.onboardingDate || null,
        adAccountLiveDate: form.adAccountLiveDate || null,
        paymentReceivedDate: form.paymentReceivedDate || null,
        monthlyAdBudget: form.monthlyAdBudget === '' ? null : Number(form.monthlyAdBudget),
        authorisedSignatory: form.authorisedSignatory,
      };
      await http.put(`${base}/clients/${client._id}`, { profile: payload });
      toast.success('Profile saved');
      setEditing(false);
      onSaved?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save the profile');
    } finally { setSaving(false); }
  };

  if (!editing) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-on-surface-variant text-xs">Account details used by the portfolio. Fees and balances are calculated from retainers and invoices.</p>
          {canEdit && (
            <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-secondary text-xs font-medium hover:bg-secondary/10 cursor-pointer">
              <Edit2 size={13} /> Edit profile
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Brand / domain">
            {profile.domains?.length
              ? <div className="flex flex-col">{profile.domains.map((d) => <a key={d} href={`https://${d}`} target="_blank" rel="noreferrer" className="text-secondary text-sm hover:underline">{d}</a>)}</div>
              : <span className="text-on-surface text-sm">—</span>}
          </Field>
          <Field label="Sector"><Chips items={profile.sectors} /></Field>
          <Field label="Services taken"><Chips items={profile.services} /></Field>
          <Field label="Platforms"><Chips items={profile.platforms} /></Field>
          <Field label="Account manager"><span className="text-on-surface text-sm">{profile.accountManager ? nameOf(profile.accountManager) : '—'}</span></Field>
          <Field label="Dedicated team">
            {profile.dedicatedTeam?.length
              ? <ul className="text-on-surface text-sm space-y-0.5">{profile.dedicatedTeam.map((m) => <li key={String(m.employee?._id || m.employee)}>{nameOf(m.employee)}{m.role ? <span className="text-on-surface-variant"> · {m.role}</span> : null}</li>)}</ul>
              : <span className="text-on-surface text-sm">—</span>}
          </Field>
          <Field label="Onboarding date"><span className="text-on-surface text-sm">{fmt(profile.onboardingDate)}</span></Field>
          <Field label="Ad account live date"><span className="text-on-surface text-sm">{fmt(profile.adAccountLiveDate)}</span></Field>
          <Field label="Payment received date"><span className="text-on-surface text-sm">{fmt(profile.paymentReceivedDate)}</span></Field>
          <Field label="Monthly ad budget plan"><span className="text-on-surface text-sm">{profile.monthlyAdBudget != null ? `₹${Number(profile.monthlyAdBudget).toLocaleString('en-IN')}` : '—'}</span></Field>
          <Field label="Authorised signatory"><span className="text-on-surface text-sm">{profile.authorisedSignatory || '—'}</span></Field>
          <Field label="Logo">
            {profile.logoUrl ? <img src={profile.logoUrl} alt="" className="h-10 object-contain rounded bg-white p-1" /> : <span className="text-on-surface text-sm">—</span>}
          </Field>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Domain(s)" hint="Comma-separated, e.g. mudgarvale.com"><input className={inputCls} value={form.domains} onChange={set('domains')} /></Field>
        <Field label="Logo URL"><input className={inputCls} value={form.logoUrl} onChange={set('logoUrl')} placeholder="https://…" /></Field>
        <Field label="Sector(s)" hint="Comma-separated, e.g. Fitness, E-commerce"><input className={inputCls} value={form.sectors} onChange={set('sectors')} /></Field>
        <Field label="Authorised signatory"><input className={inputCls} value={form.authorisedSignatory} onChange={set('authorisedSignatory')} /></Field>
      </div>

      <Field label="Services taken" hint="Decides which onboarding steps apply">
        <div className="flex flex-wrap gap-2">
          {SERVICE_OPTIONS.map((s) => (
            <button key={s} type="button" onClick={() => toggle('services', s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer ${form.services.includes(s) ? 'bg-secondary/15 text-secondary border-secondary/30' : 'bg-admin-bg text-on-surface-variant border-outline-variant'}`}>
              {s}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Ad platforms" hint="Meta and Google steps appear in onboarding only when selected">
        <div className="flex flex-wrap items-center gap-2">
          {PLATFORM_OPTIONS.map((p) => (
            <button key={p} type="button" onClick={() => toggle('platforms', p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer ${form.platforms.includes(p) ? 'bg-secondary/15 text-secondary border-secondary/30' : 'bg-admin-bg text-on-surface-variant border-outline-variant'}`}>
              {p}
            </button>
          ))}
          <input className={`${inputCls} max-w-xs`} value={form.otherPlatforms} onChange={set('otherPlatforms')} placeholder="Other platforms (comma-separated)" />
        </div>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Onboarding date"><input type="date" className={inputCls} value={form.onboardingDate} onChange={set('onboardingDate')} /></Field>
        <Field label="Ad account live date"><input type="date" className={inputCls} value={form.adAccountLiveDate} onChange={set('adAccountLiveDate')} /></Field>
        <Field label="Payment received date"><input type="date" className={inputCls} value={form.paymentReceivedDate} onChange={set('paymentReceivedDate')} /></Field>
        <Field label="Monthly ad budget (₹)"><input type="number" min="0" className={inputCls} value={form.monthlyAdBudget} onChange={set('monthlyAdBudget')} /></Field>
        <Field label="Account manager">
          <select className={inputCls} value={form.accountManager} onChange={set('accountManager')}>
            <option value="">— None —</option>
            {staff.map((s) => <option key={s._id} value={s._id}>{staffName(s)}{s.designation ? ` · ${s.designation}` : ''}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Dedicated team">
        <div className="space-y-2">
          {form.dedicatedTeam.map((m, i) => (
            <div key={i} className="flex gap-2">
              <select className={inputCls} value={m.employee}
                onChange={(e) => setForm((p) => ({ ...p, dedicatedTeam: p.dedicatedTeam.map((x, j) => (j === i ? { ...x, employee: e.target.value } : x)) }))}>
                <option value="">— Select person —</option>
                {staff.map((s) => <option key={s._id} value={s._id}>{staffName(s)}</option>)}
              </select>
              <input className={inputCls} value={m.role} placeholder="Role on this account"
                onChange={(e) => setForm((p) => ({ ...p, dedicatedTeam: p.dedicatedTeam.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) }))} />
              <button type="button" aria-label="Remove" onClick={() => setForm((p) => ({ ...p, dedicatedTeam: p.dedicatedTeam.filter((_, j) => j !== i) }))}
                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer"><Trash2 size={15} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setForm((p) => ({ ...p, dedicatedTeam: [...p.dedicatedTeam, { employee: '', role: '' }] }))}
            className="flex items-center gap-1.5 text-secondary text-xs font-medium cursor-pointer"><Plus size={13} /> Add team member</button>
        </div>
      </Field>

      <div className="flex gap-3 pt-1">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 disabled:opacity-60 cursor-pointer">
          <Save size={14} /> {saving ? 'Saving…' : 'Save profile'}
        </button>
        <button onClick={() => setEditing(false)} className="flex items-center gap-2 px-4 py-2 bg-admin-bg border border-outline-variant text-on-surface-variant rounded-lg text-sm cursor-pointer">
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}
