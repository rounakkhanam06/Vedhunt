import { Users, UserCheck, UserX, IndianRupee, Wallet, AlertTriangle, Percent } from 'lucide-react';

import { inr, pct } from './format';

function Card({ icon: Icon, label, value, sub, tone = 'text-secondary', onClick, active }) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">
        <Icon size={13} className={tone} /> {label}
      </div>
      <p className="text-on-surface text-xl font-bold mt-1.5">{value}</p>
      {sub && <p className="text-on-surface-variant text-[11px] mt-0.5">{sub}</p>}
    </>
  );
  const cls = `text-left bg-surface border rounded-xl p-3.5 transition-colors ${active ? 'border-secondary/60 bg-secondary/5' : 'border-outline-variant'}`;
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} cursor-pointer hover:border-secondary/40`}>{body}</button>
    : <div className={cls}>{body}</div>;
}

/**
 * Portfolio KPI cards. Money cards only appear when the API sent them — a
 * person without invoice access gets the account counts alone.
 * `onPick(filter)` lets a card drive the table below (status / billing).
 */
export default function PortfolioKpis({ kpis, topByRevenue = [], revenuePeriod, status, billing, onPick }) {
  if (!kpis) return null;
  const hasMoney = kpis.monthlyRecurringRevenue !== undefined;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <Card icon={Users} label="Total clients" value={kpis.totalClients} sub={kpis.archivedClients ? `${kpis.archivedClients} deleted` : undefined}
          onClick={() => onPick({ status: '', billing: '' })} active={!status && !billing} />
        <Card icon={UserCheck} label="Active" value={kpis.activeClients} tone="text-green-400"
          onClick={() => onPick({ status: 'active', billing: '' })} active={status === 'active'} />
        <Card icon={UserX} label="Inactive" value={kpis.inactiveClients} tone="text-amber-400" sub="Suspended accounts"
          onClick={() => onPick({ status: 'inactive', billing: '' })} active={status === 'inactive'} />
        {hasMoney && (
          <>
            <Card icon={IndianRupee} label="Monthly recurring" value={inr(kpis.monthlyRecurringRevenue)} sub="Active plans, excl. one-time" />
            <Card icon={Wallet} label="Outstanding" value={inr(kpis.outstandingReceivables)} tone="text-blue-400"
              sub={kpis.overdueReceivables ? `${inr(kpis.overdueReceivables)} overdue` : 'Nothing overdue'}
              onClick={() => onPick({ status: '', billing: 'outstanding' })} active={billing === 'outstanding'} />
            <Card icon={AlertTriangle} label="Defaulters" value={kpis.paymentDefaulters} tone="text-red-400" sub="Overdue invoices"
              onClick={() => onPick({ status: '', billing: 'overdue' })} active={billing === 'overdue'} />
            <Card icon={Percent} label="Collection" value={pct(kpis.collectionPercent)} sub="Received ÷ billed" />
          </>
        )}
      </div>

      {hasMoney && topByRevenue.length > 0 && (
        <div className="bg-surface border border-outline-variant rounded-xl px-4 py-3">
          <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-2">
            Top clients by revenue collected
            {revenuePeriod?.from && <span className="normal-case font-normal"> · {new Date(revenuePeriod.from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – today (month so far, partial)</span>}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            {topByRevenue.map((t, i) => (
              <span key={t._id} className="text-xs text-on-surface">
                <span className="text-on-surface-variant mr-1">{i + 1}.</span>{t.businessName}
                <span className="text-secondary font-semibold ml-1.5">{inr(t.collected)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
