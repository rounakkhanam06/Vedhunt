import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Info, FileText, Rocket, RefreshCcw, LifeBuoy, Target, ChevronRight } from 'lucide-react';
import clientApi from '../../services/clientApi';
import ProjectProgressChart from '../components/charts/ProjectProgressChart';
import HoursPacingChart from '../components/charts/HoursPacingChart';
import BillingTrendChart from '../components/charts/BillingTrendChart';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

const TONES = {
  danger: { icon: AlertTriangle, cls: 'border-[#EF4444]/30 bg-[#EF4444]/10', ic: 'text-[#EF4444]' },
  warn: { icon: Clock, cls: 'border-[#F59E0B]/30 bg-[#F59E0B]/10', ic: 'text-[#F59E0B]' },
  info: { icon: Info, cls: 'border-[#3B82F6]/30 bg-[#3B82F6]/10', ic: 'text-[#3B82F6]' },
};

const card = 'rounded-xl border border-border-default bg-bg-surface/30';

function Stat({ icon: Icon, label, value, sub, subTone, onClick, bar }) {
  return (
    <button type="button" onClick={onClick} className={`${card} p-4 text-left cursor-pointer hover:border-primary/40 transition-colors`}>
      <div className="flex items-center gap-2 text-[#9CA3AF] text-[11px] uppercase font-bold tracking-wider">
        <Icon size={14} className="text-primary" /> {label}
      </div>
      <p className="text-white text-2xl font-bold mt-2">{value}</p>
      {bar != null && (
        <div className="h-1.5 mt-2 bg-white/10 rounded-full overflow-hidden" role="progressbar" aria-valuenow={bar} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} used`}>
          <div className={`h-full rounded-full ${bar >= 100 ? 'bg-[#EF4444]' : bar >= 80 ? 'bg-[#F59E0B]' : 'bg-primary'}`} style={{ width: `${bar}%` }} />
        </div>
      )}
      {sub && <p className={`text-xs mt-1 ${subTone || 'text-[#9CA3AF]'}`}>{sub}</p>}
    </button>
  );
}

function Section({ title, action, onAction, children }) {
  return (
    <section className={`${card} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white text-sm font-semibold">{title}</h3>
        {action && (
          <button onClick={onAction} className="flex items-center gap-1 text-primary text-xs font-medium cursor-pointer hover:underline">
            {action} <ChevronRight size={13} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

const OverviewTab = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const go = (tab) => navigate(`/client/dashboard?tab=${tab}`);

  useEffect(() => {
    let live = true;
    clientApi.get('/client/overview')
      .then(({ data: res }) => { if (live) setData(res.data); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  if (failed) return <p className="text-[#9CA3AF] text-sm">We couldn&apos;t load your overview just now. Please try again shortly.</p>;
  if (!data) {
    return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-primary/30 border-t-[#FF5A1F] rounded-full animate-spin" /></div>;
  }

  const { billing, projects, retainer, tickets, strategy, actions } = data;
  const usedPct = retainer && retainer.included > 0 ? Math.min(100, Math.round((retainer.used / retainer.included) * 100)) : 0;

  return (
    <div className="space-y-5">
      {/* Needs attention */}
      {actions.length > 0 ? (
        <section aria-label="Needs your attention" className="space-y-2">
          <h2 className="text-white text-sm font-semibold">Needs your attention</h2>
          {actions.map((a) => {
            const t = TONES[a.tone] || TONES.info;
            const Icon = t.icon;
            return (
              <button key={a.key} onClick={() => go(a.tab)} className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left cursor-pointer transition-opacity hover:opacity-90 ${t.cls}`}>
                <Icon size={18} className={`${t.ic} shrink-0`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-white text-sm font-medium">{a.title}</span>
                  <span className="block text-[#9CA3AF] text-xs mt-0.5">{a.detail}</span>
                </span>
                <ChevronRight size={16} className="text-[#9CA3AF] shrink-0" />
              </button>
            );
          })}
        </section>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-[#22C55E]/25 bg-[#22C55E]/10 px-4 py-3">
          <CheckCircle2 size={18} className="text-[#22C55E] shrink-0" />
          <p className="text-white text-sm font-medium">You&apos;re all caught up — nothing needs your attention.</p>
        </div>
      )}

      {/* At a glance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={FileText} label="Outstanding" value={inr(billing.outstanding)} onClick={() => go('billing')}
          sub={billing.overdueAmount > 0 ? `${inr(billing.overdueAmount)} overdue` : billing.outstanding > 0 ? 'Nothing overdue' : 'All paid up'}
          subTone={billing.overdueAmount > 0 ? 'text-[#EF4444] font-semibold' : undefined} />
        <Stat icon={Rocket} label="Active projects" value={projects.length} onClick={() => go('projects')}
          sub={projects.length ? `${Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)}% average progress` : 'No active projects'} />
        <Stat icon={RefreshCcw} label="Retainer hours" onClick={() => go('retainers')}
          value={retainer ? `${retainer.used}/${retainer.included}h` : '—'} bar={retainer ? usedPct : null}
          sub={retainer ? (retainer.hoursOverage > 0 ? `${retainer.hoursOverage}h over this month` : `${retainer.remaining}h left this month`) : 'No active retainer'}
          subTone={retainer?.hoursOverage > 0 ? 'text-[#EF4444] font-semibold' : undefined} />
        <Stat icon={LifeBuoy} label="Open tickets" value={tickets.open} onClick={() => go('support')}
          sub={tickets.awaitingClient > 0 ? `${tickets.awaitingClient} waiting for you` : tickets.open ? 'We are on it' : 'No open requests'}
          subTone={tickets.awaitingClient > 0 ? 'text-[#F59E0B] font-semibold' : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <ProjectProgressChart projects={projects} />
          {retainer && <HoursPacingChart trend={data.charts.hoursTrend} retainer={retainer} />}
        </div>

        <div className="space-y-5">
          <BillingTrendChart trend={data.charts.billingTrend} />

          {/* Billing */}
          <Section title="Billing" action="View invoices" onAction={() => go('billing')}>
            {billing.nextDue ? (
              <p className="text-sm text-white">
                Next payment: <span className="font-semibold">{inr(billing.nextDue.balance)}</span>{' '}
                <span className="text-[#9CA3AF]">for {billing.nextDue.invoiceId}, due {fmtDate(billing.nextDue.dueDate)}</span>
              </p>
            ) : billing.overdueInvoices > 0 ? (
              <p className="text-sm text-white"><span className="font-semibold text-[#EF4444]">{billing.overdueInvoices} overdue</span> <span className="text-[#9CA3AF]">· oldest by {billing.oldestOverdueDays} day{billing.oldestOverdueDays === 1 ? '' : 's'}</span></p>
            ) : (
              <p className="text-[#9CA3AF] text-sm">No payments due.</p>
            )}
            {billing.pendingProofs > 0 && <p className="text-[#9CA3AF] text-xs mt-2">{billing.pendingProofs} payment proof{billing.pendingProofs > 1 ? 's' : ''} being verified.</p>}
          </Section>

          {/* Support */}
          <Section title="Recent support requests" action="Support" onAction={() => go('support')}>
            {tickets.recent.length === 0 ? (
              <p className="text-[#9CA3AF] text-sm">No open requests.</p>
            ) : (
              <ul className="space-y-2">
                {tickets.recent.map((t) => (
                  <li key={t._id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white truncate">{t.subject}</span>
                    <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${t.status === 'Pending Client' ? 'bg-[#F59E0B]/15 text-[#F59E0B]' : 'bg-white/10 text-[#9CA3AF]'}`}>{t.status === 'Pending Client' ? 'Needs your reply' : t.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Strategy */}
          {strategy && (
            <Section title="Campaign strategy" action="Read it" onAction={() => go('strategy')}>
              <p className="flex items-center gap-2 text-sm text-white"><Target size={15} className="text-primary shrink-0" /> Version {strategy.version} shared on {fmtDate(strategy.sharedAt)}</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
