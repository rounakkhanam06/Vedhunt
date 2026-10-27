import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';

// One platform's KPI report (server/services/kpi.js), shared by the Admin panel (staff can
// enter Qualified Leads, Verified Orders and the Optimization Action) and the Client Portal
// (view only). `theme` picks the colours of the panel it sits in.
const THEMES = {
  admin: { head: 'bg-admin-bg text-on-surface-variant', text: 'text-on-surface', muted: 'text-on-surface-variant', border: 'border-outline-variant', foot: 'bg-admin-bg', input: 'bg-admin-bg border-outline-variant text-on-surface', sticky: 'bg-surface' },
  client: { head: 'bg-bg-surface/60 text-[#9CA3AF]', text: 'text-white', muted: 'text-[#9CA3AF]', border: 'border-border-default', foot: 'bg-bg-surface/60', input: 'bg-bg-surface/50 border-border-default text-white', sticky: 'bg-bg-surface' },
};

const inr = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
const pct = (n) => (n == null ? '—' : `${num(n)}%`);
const STATUS = { on_target: 'text-green-400', off_target: 'text-red-400' };

export default function KpiReportTable({ table, theme = 'admin', canEdit = false, onSaveEntry }) {
  const t = THEMES[theme];
  const [editing, setEditing] = useState(null); // { key, qualifiedLeads, verifiedOrders, action }
  const [saving, setSaving] = useState(false);
  const { setup } = table;

  const save = async () => {
    setSaving(true);
    try {
      await onSaveEntry({ platform: table.platform, frequency: table.frequency, periodStart: editing.key, qualifiedLeads: editing.qualifiedLeads, verifiedOrders: editing.verifiedOrders, action: editing.action });
      setEditing(null);
    } finally { setSaving(false); }
  };

  const th = 'px-2.5 py-2 font-semibold whitespace-nowrap text-right';
  const td = `px-2.5 py-2 whitespace-nowrap text-right border-b ${t.border}`;
  const cols = [
    // Monthly rows show the budget approved for that month (it can change over time)
    ...(table.frequency === 'Monthly' ? [['monthlyBudget', 'Budget', inr]] : []),
    ['plannedBudget', 'Planned', inr], ['spend', 'Spend', inr], ['remaining', 'Remaining', inr], ['utilization', 'Utilization', pct], ['spendVsPlan', 'Spend vs plan', inr],
    ['impressions', 'Impr.', num], ['clicks', 'Clicks', num], ['ctr', 'CTR', pct], ['cpc', 'CPC', inr], ['cpm', 'CPM', inr],
    ['conversions', 'Conversions', num], ['costPerConversion', 'Cost / conv.', inr], ['conversionValue', 'Value', inr], ['roas', 'ROAS', (n) => (n == null ? '—' : `${num(n)}x`)],
    ['qualifiedLeads', 'Qualified leads', num], ['verifiedOrders', 'Verified orders', num],
  ];
  const cellClass = (key, row) => {
    if (key === 'costPerConversion') return STATUS[row.cpaStatus] || '';
    if (key === 'roas') return STATUS[row.roasStatus] || '';
    if (key === 'spendVsPlan') return row.spendVsPlan > 0 ? 'text-amber-400' : '';
    return '';
  };

  return (
    <div className="space-y-2">
      <div className={`flex flex-wrap gap-x-5 gap-y-1 text-xs ${t.muted}`}>
        <span>Monthly budget (this month) <strong className={t.text}>{inr(setup.monthlyBudget)}</strong></span>
        <span>Goal <strong className={t.text}>{setup.primaryGoal}</strong></span>
        {setup.targetCpa != null && <span>Target CPA/CPL <strong className={t.text}>{inr(setup.targetCpa)}</strong></span>}
        {setup.targetRoas != null && <span>Target ROAS <strong className={t.text}>{num(setup.targetRoas)}x</strong></span>}
        <span>Reporting <strong className={t.text}>{setup.reportingFrequency}</strong></span>
        {setup.accountOwner && <span>Owner <strong className={t.text}>{setup.accountOwner}</strong></span>}
        {theme === 'admin' && setup.grossMarginPercent != null && <span>Gross margin <strong className={t.text}>{num(setup.grossMarginPercent)}%</strong> <em className="not-italic opacity-70">(internal)</em></span>}
      </div>

      {!table.rows.length ? (
        <p className={`text-xs ${t.muted} py-6 text-center`}>Nothing to show for this period yet.</p>
      ) : (
        <div className={`overflow-x-auto rounded-xl border ${t.border}`}>
          <table className="text-[11px] border-separate border-spacing-0 min-w-full">
            <thead className={`${t.head} uppercase tracking-wider text-[10px]`}>
              <tr>
                <th className={`${th} text-left sticky left-0 z-10 ${t.head}`}>Period</th>
                {cols.map(([k, label]) => <th key={k} className={th}>{label}</th>)}
                <th className={`${th} text-left min-w-[220px]`}>Result / optimization action</th>
                {canEdit && <th className={th} />}
              </tr>
            </thead>
            <tbody className={t.text}>
              {table.rows.map((r) => {
                const edit = editing?.key === r.key;
                return (
                  <tr key={r.key}>
                    <td className={`${td} text-left sticky left-0 z-10 ${t.sticky}`}>
                      {r.label}{r.partial && <span className={`block text-[10px] ${t.muted}`}>to date</span>}
                    </td>
                    {cols.map(([k, , fmt]) => {
                      if (edit && (k === 'qualifiedLeads' || k === 'verifiedOrders')) {
                        return (
                          <td key={k} className={td}>
                            <input type="number" min="0" step="1" value={editing[k] ?? ''} aria-label={k}
                              onChange={(e) => setEditing((x) => ({ ...x, [k]: e.target.value }))}
                              className={`w-20 px-2 py-1 rounded border text-right ${t.input}`} />
                          </td>
                        );
                      }
                      if (k === 'conversions' && r.otherResults > 0) {
                        return (
                          <td key={k} className={td} title={`${num(r.otherResults)} results from campaigns with a different result type are not counted`}>
                            {fmt(r[k])}<span className={`block text-[10px] ${t.muted}`}>+{num(r.otherResults)} other</span>
                          </td>
                        );
                      }
                      return <td key={k} className={`${td} ${cellClass(k, r)}`}>{fmt(r[k])}</td>;
                    })}
                    <td className={`${td} text-left whitespace-normal`}>
                      {edit
                        ? <textarea rows={2} value={editing.action} onChange={(e) => setEditing((x) => ({ ...x, action: e.target.value }))} aria-label="Optimization action"
                            className={`w-full min-w-[220px] px-2 py-1 rounded border resize-y ${t.input}`} />
                        : (r.action || <span className={t.muted}>—</span>)}
                    </td>
                    {canEdit && (
                      <td className={td}>
                        {edit ? (
                          <span className="flex gap-1 justify-end">
                            <button type="button" onClick={save} disabled={saving} title="Save" className="p-1 rounded text-green-400 hover:bg-green-500/10 cursor-pointer disabled:opacity-50"><Check size={14} /></button>
                            <button type="button" onClick={() => setEditing(null)} title="Cancel" className={`p-1 rounded ${t.muted} cursor-pointer`}><X size={14} /></button>
                          </span>
                        ) : (
                          <button type="button" title="Enter qualified leads, verified orders and the action"
                            onClick={() => setEditing({ key: r.key, qualifiedLeads: r.qualifiedLeads ?? '', verifiedOrders: r.verifiedOrders ?? '', action: r.action || '' })}
                            className="p-1 rounded text-secondary hover:bg-secondary/10 cursor-pointer"><Pencil size={13} /></button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {table.totals && (
              <tfoot className={`${t.foot} font-bold ${t.text}`}>
                <tr>
                  <td className={`px-2.5 py-2 text-left sticky left-0 z-10 ${t.foot}`}>Total</td>
                  {cols.map(([k, , fmt]) => <td key={k} className={`px-2.5 py-2 text-right whitespace-nowrap ${cellClass(k, table.totals)}`}>{fmt(table.totals[k])}</td>)}
                  <td className="px-2.5 py-2" />
                  {canEdit && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      <p className={`text-[10px] ${t.muted}`}>
        Planned budget uses the real days of each month and the budget approved for that month. Conversions, their cost, value and ROAS count only campaigns whose result matches the goal ({setup.primaryGoal}); spend counts every campaign. Cost / conversion and ROAS turn green when on target and red when not. Platform numbers are platform-attributed; verified orders are the business's own count.
      </p>
    </div>
  );
}
