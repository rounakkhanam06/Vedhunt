import { useEffect, useMemo, useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const ACTION_LABELS = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', assign: 'Assign', sensitive: 'Sensitive data', process: 'Process' };
// Shown under a page when it has these actions
const ACTION_HINTS = {
  employees: 'View shows the employee list with PAN, Aadhaar, bank and salary masked. Sensitive data shows them in full. Adding, editing and deleting employees stays with the role.',
  'bank-changes': 'View shows requests with account numbers masked. Sensitive data shows them in full. Edit (approve or reject) needs Sensitive data ticked too.',
  performance: 'View shows cycles, KPI goals and scores. Edit lets them assign KPI goals, enter actuals and write manager reviews. Creating cycles stays with the role.',
  payroll: 'View shows payroll status only. Sensitive data adds salary figures and payslips. Process (generate, adjust, approve, mark paid, revise salary) needs Sensitive data ticked too. A person never sees their own payroll through this.',
};
const MODE_LABELS = {
  all: { client: 'All clients', lead: 'All leads', employee: 'All employees', global: 'Everything' },
  clients: 'Selected clients',
  own: 'Own leads',
  team: "Team's leads",
  reports: 'Direct reports',
  departments: 'Selected departments',
};
const modeLabel = (mode, scopeType) => (typeof MODE_LABELS[mode] === 'string' ? MODE_LABELS[mode] : MODE_LABELS[mode]?.[scopeType] || mode);

const emptyGrant = (page) => ({ page, actions: [], scope: { mode: '', clients: [], departments: [] } });
const fromServer = (g) => ({
  page: g.page,
  actions: g.actions || [],
  scope: { mode: g.scope?.mode || '', clients: (g.scope?.clients || []).map(String), departments: g.scope?.departments || [] },
});

/**
 * Employee Manager → Page Access: give this person individual pages with
 * individual actions, limited to a data scope, on top of their role
 * (server/config/pageAccess.js). The pages appear in their Employee Portal;
 * the API enforces the same scope. Pages you don't hold yourself are shown
 * read-only and kept as they are.
 */
export default function CrmAccessEditor({ employeeId }) {
  const [catalog, setCatalog] = useState(null); // { pages, scopeModes, departments, isSelf }
  const [grants, setGrants] = useState(null); // { [page]: grant }
  const [clients, setClients] = useState([]);
  const [hidden, setHidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const applyGrants = (pages, list) => {
    const byPage = Object.fromEntries(pages.map((p) => [p.key, emptyGrant(p.key)]));
    for (const g of list || []) if (byPage[g.page]) byPage[g.page] = fromServer(g);
    setGrants(byPage);
  };

  useEffect(() => {
    let cancelled = false; // mounted with key={employeeId}, so state starts fresh per employee
    Promise.all([
      api.get(`/employees/${employeeId}/access-grants`),
      api.get('/admin/client-options', { params: { page: 'clients' } }).catch(() => ({ data: { data: [] } })),
    ]).then(([g, c]) => {
      if (cancelled) return;
      setCatalog({ pages: g.data.pages || [], scopeModes: g.data.scopeModes || {}, departments: g.data.departments || [], isSelf: Boolean(g.data.isSelf) });
      // Names for clients already granted, even ones no longer in the picker
      const known = new Map((c.data.data || []).map((cl) => [String(cl._id), cl]));
      for (const cl of g.data.clients || []) if (!known.has(String(cl._id))) known.set(String(cl._id), cl);
      setClients([...known.values()]);
      applyGrants(g.data.pages || [], g.data.grants);
    }).catch((err) => {
      if (cancelled) return;
      if (err?.response?.status === 403) setHidden(true); // nothing this admin may grant
      else setError(err?.response?.data?.message || 'Could not load page access.');
    });
    return () => { cancelled = true; };
  }, [employeeId]);

  const clientName = useMemo(() => {
    const map = new Map(clients.map((c) => [String(c._id), `${c.businessName} — ${c.clientId}`]));
    return (id) => map.get(String(id)) || 'Archived / removed client';
  }, [clients]);

  const groups = useMemo(() => {
    const out = new Map();
    for (const p of catalog?.pages || []) out.set(p.group, [...(out.get(p.group) || []), p]);
    return [...out.entries()];
  }, [catalog]);

  const update = (page, changes) => setGrants((g) => ({ ...g, [page]: { ...g[page], ...changes } }));
  const updateScope = (page, changes) => setGrants((g) => ({ ...g, [page]: { ...g[page], scope: { ...g[page].scope, ...changes } } }));

  // 'view' is implied by any other action, and dropping 'view' drops the rest
  const toggleAction = (pageDef, action) => {
    const grant = grants[pageDef.key];
    let next = grant.actions.includes(action) ? grant.actions.filter((a) => a !== action) : [...grant.actions, action];
    if (action === 'view' && !next.includes('view')) next = [];
    if (next.length && !next.includes('view')) next = ['view', ...next];
    for (const [needer, needs] of Object.entries(pageDef.requires || {})) {
      if (next.includes(needer) && needs.some((n) => !next.includes(n))) next = next.filter((a) => a !== needer);
    }
    // First action on a page picks the narrowest sensible scope to start from
    const defaultMode = pageDef.scope === 'client' ? 'clients' : (catalog.scopeModes[pageDef.scope] || [])[0];
    const scope = next.length && !grant.scope.mode ? { ...grant.scope, mode: defaultMode } : grant.scope;
    update(pageDef.key, { actions: pageDef.actions.filter((a) => next.includes(a)), scope });
  };

  // A page only grants something with actions AND a complete scope; anything
  // else is saved as "no access" — which is also how access is revoked.
  const grantsAccess = (g) => g.actions.length > 0 && g.scope.mode
    && (g.scope.mode !== 'clients' || g.scope.clients.length > 0)
    && (g.scope.mode !== 'departments' || g.scope.departments.length > 0);

  const save = async () => {
    setSaving(true);
    try {
      const payload = Object.values(grants).filter(grantsAccess);
      const res = await api.put(`/employees/${employeeId}/access-grants`, { grants: payload });
      applyGrants(catalog.pages, res.data.grants);
      toast.success(res.data.grants?.length
        ? 'Page access saved. It applies the next time they open the portal.'
        : 'All page access removed.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save page access');
    } finally {
      setSaving(false);
    }
  };

  if (hidden) return null;
  // Your own access is changed by another authorised admin (the server refuses it too)
  const locked = Boolean(catalog?.isSelf);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-app-text-muted flex items-center gap-1.5"><KeyRound size={14} /> Page Access</h3>
        <p className="text-[11px] text-app-text-muted mt-1">
          Extra pages for this person only, limited to the chosen actions and data. Their role stays the same; the pages appear in their Employee Portal.
        </p>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}
      {locked && <p className="text-[11px] text-amber-500">This is your own access. Another authorised admin has to change it.</p>}
      {!grants && !error && <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />}

      {grants && groups.map(([group, pages]) => (
        <div key={group} className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-muted">{group}</p>
          {pages.map((pageDef) => {
            const { key, label, scope: scopeType, grantable } = pageDef;
            const grant = grants[key];
            const enabled = grant.actions.length > 0;
            const modes = catalog.scopeModes[scopeType] || [];
            const available = clients.filter((c) => !grant.scope.clients.includes(String(c._id)));
            return (
              <div key={key} className={`rounded-lg border p-3 space-y-2 ${enabled ? 'border-primary/30 bg-primary/5' : 'border-app-border'} ${grantable ? '' : 'opacity-70'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-app-text">{label}</span>
                  <div className="flex flex-wrap gap-1">
                    {pageDef.actions.map((action) => (
                      // Only actions you hold in full yourself can be handed out
                      <button key={action} type="button" disabled={locked || !grantable || !(pageDef.grantableActions || []).includes(action) || (pageDef.requires?.[action] || []).some((n) => !grant.actions.includes(n))} onClick={() => toggleAction(pageDef, action)}
                        title={grantable && !(pageDef.grantableActions || []).includes(action) ? "You don't have this action yourself"
                          : (pageDef.requires?.[action] || []).some((n) => !grant.actions.includes(n)) ? `Tick ${(pageDef.requires[action]).map((n) => ACTION_LABELS[n] || n).join(', ')} first` : undefined}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors disabled:cursor-not-allowed ${
                          grant.actions.includes(action)
                            ? 'bg-primary text-white border-primary'
                            : 'border-app-border text-app-text-muted hover:border-primary/40'
                        } ${grantable ? 'cursor-pointer' : ''}`}>
                        {ACTION_LABELS[action] || action}
                      </button>
                    ))}
                  </div>
                </div>

                {ACTION_HINTS[key] && grantable && <p className="text-[11px] text-app-text-muted">{ACTION_HINTS[key]}</p>}

                {!grantable && (
                  <p className="text-[11px] text-app-text-muted">You don&apos;t have this page yourself, so you can&apos;t change it here.</p>
                )}

                {enabled && grantable && !locked && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {modes.length > 1 ? (
                        <select value={grant.scope.mode} onChange={(e) => updateScope(key, { mode: e.target.value })}
                          className="text-[11px] rounded-lg border border-app-border bg-form-input-bg px-2 py-1 text-app-text focus:outline-none">
                          {modes.map((m) => (
                            <option key={m} value={m} className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">{modeLabel(m, scopeType)}</option>
                          ))}
                        </select>
                      ) : <span className="text-[11px] text-app-text-muted">{modeLabel(modes[0], scopeType)}</span>}
                      <button type="button" onClick={() => update(key, emptyGrant(key))}
                        className="text-[11px] font-semibold text-rose-400 hover:underline cursor-pointer shrink-0">
                        Remove access
                      </button>
                    </div>
                    {key === 'clients' && grant.scope.mode === 'all' && (
                      <p className="text-[11px] text-app-text-muted">All clients also allows creating new clients (if Create is on).</p>
                    )}

                    {grant.scope.mode === 'departments' && (
                      <>
                        <div className="flex flex-wrap gap-1">
                          {grant.scope.departments.map((d) => (
                            <span key={d} className="inline-flex items-center gap-1 max-w-full rounded-full bg-app-bg border border-app-border px-2 py-0.5 text-[11px] text-app-text">
                              <span className="truncate">{d}</span>
                              <button type="button" onClick={() => updateScope(key, { departments: grant.scope.departments.filter((x) => x !== d) })}
                                className="text-app-text-muted hover:text-rose-400 cursor-pointer" aria-label="Remove department">
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                          {!grant.scope.departments.length && <span className="text-[11px] text-amber-500">No departments chosen — this page won&apos;t be given until you add one</span>}
                        </div>
                        <select value="" onChange={(e) => e.target.value && updateScope(key, { departments: [...grant.scope.departments, e.target.value] })}
                          className="w-full text-xs rounded-lg border border-app-border bg-form-input-bg px-2 py-1.5 text-app-text focus:outline-none">
                          <option value="" className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">+ Add department…</option>
                          {(catalog.departments || []).filter((d) => !grant.scope.departments.includes(d)).map((d) => (
                            <option key={d} value={d} className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">{d}</option>
                          ))}
                        </select>
                      </>
                    )}

                    {grant.scope.mode === 'clients' && (
                      <>
                        <div className="flex flex-wrap gap-1">
                          {grant.scope.clients.map((id) => (
                            <span key={id} className="inline-flex items-center gap-1 max-w-full rounded-full bg-app-bg border border-app-border px-2 py-0.5 text-[11px] text-app-text">
                              <span className="truncate">{clientName(id)}</span>
                              <button type="button" onClick={() => updateScope(key, { clients: grant.scope.clients.filter((c) => c !== id) })}
                                className="text-app-text-muted hover:text-rose-400 cursor-pointer" aria-label="Remove client">
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                          {!grant.scope.clients.length && <span className="text-[11px] text-amber-500">No clients chosen — this page won&apos;t be given until you add one</span>}
                        </div>
                        <select value="" onChange={(e) => e.target.value && updateScope(key, { clients: [...grant.scope.clients, e.target.value] })}
                          className="w-full text-xs rounded-lg border border-app-border bg-form-input-bg px-2 py-1.5 text-app-text focus:outline-none">
                          <option value="" className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">+ Add client…</option>
                          {available.map((c) => (
                            <option key={c._id} value={String(c._id)} className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">{c.businessName} — {c.clientId}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                )}

                {enabled && (!grantable || locked) && (
                  <p className="text-[11px] text-app-text">
                    {grant.actions.map((a) => ACTION_LABELS[a] || a).join(', ')} · {modeLabel(grant.scope.mode, scopeType)}
                    {grant.scope.mode === 'clients' ? ` (${grant.scope.clients.length})` : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {grants && !locked && (
        <button type="button" onClick={save} disabled={saving}
          className="w-full py-2 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/20 text-xs font-semibold hover:bg-orange-600 hover:text-white transition-all cursor-pointer disabled:opacity-40">
          {saving ? 'Saving…' : 'Save Page Access'}
        </button>
      )}
    </div>
  );
}
