import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, CircleDashed, AlertTriangle, MinusCircle, Hand, Rocket, ExternalLink } from 'lucide-react';
import clientApi from '../../services/clientApi';

const STATE = {
  done: { label: 'Done', icon: CheckCircle2, cls: 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25' },
  in_progress: { label: 'In progress', icon: Clock, cls: 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/25' },
  waiting_on_you: { label: 'Waiting on you', icon: Hand, cls: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30' },
  blocked: { label: 'Blocked', icon: AlertTriangle, cls: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25' },
  not_started: { label: 'Not started', icon: CircleDashed, cls: 'text-[#9CA3AF] bg-white/5 border-white/10' },
  not_needed: { label: 'Not needed', icon: MinusCircle, cls: 'text-[#9CA3AF] bg-white/5 border-white/10' },
};
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** The client's view of their launch setup: what is done, what we need from them, and proof we chose to share. */
const OnboardingTab = () => {
  const [data, setData] = useState(undefined); // undefined = loading, null = no checklist yet
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    clientApi.get('/client/onboarding')
      .then(({ data: res }) => { if (live) setData(res.data); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  if (failed) return <p className="text-[#9CA3AF] text-sm">We couldn&apos;t load your setup progress just now. Please try again shortly.</p>;
  if (data === undefined) return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-primary/30 border-t-[#FF5A1F] rounded-full animate-spin" /></div>;
  if (data === null) {
    return (
      <div className="text-center py-16 rounded-xl border border-border-default bg-bg-surface/30">
        <Rocket size={36} className="text-[#4B5563] mx-auto mb-3" />
        <p className="text-white text-sm font-medium">Your setup checklist will appear here</p>
        <p className="text-[#9CA3AF] text-xs mt-1">Your account team is preparing it. You&apos;ll see each step and what we need from you.</p>
      </div>
    );
  }

  const { summary } = data;
  const pct = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-white text-lg font-semibold">Setup progress</h2>
        <p className="text-[#9CA3AF] text-xs mt-1">The steps we complete before your campaigns go live.</p>
      </div>

      {data.live ? (
        <div className="flex items-center gap-3 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 px-4 py-3" role="status">
          <Rocket size={18} className="text-[#22C55E] shrink-0" />
          <p className="text-white text-sm font-medium">Your campaigns went live{data.liveDate ? ` on ${fmt(data.liveDate)}` : ''}.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border-default bg-bg-surface/30 p-4">
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Setup steps done">
              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-[#C3C8D2] shrink-0">{summary.done} of {summary.total} done</span>
          </div>
          {summary.waitingOnYou > 0 && (
            <p className="text-[#F59E0B] text-xs font-medium mt-2.5">{summary.waitingOnYou} step{summary.waitingOnYou > 1 ? 's are' : ' is'} waiting on you.</p>
          )}
        </div>
      )}

      <ul className="space-y-2.5">
        {data.items.map((item) => {
          const s = STATE[item.state] || STATE.not_started;
          const Icon = s.icon;
          return (
            <li key={item.key} className={`rounded-xl border p-3.5 ${item.state === 'waiting_on_you' ? 'border-[#F59E0B]/40 bg-[#F59E0B]/5' : 'border-border-default bg-bg-surface/30'}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="text-white text-sm font-medium flex-1 min-w-[12rem]">{item.label}</p>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}><Icon size={12} /> {s.label}</span>
              </div>
              {item.message && <p className="text-[#E5E7EB] text-sm mt-2 leading-relaxed"><span className="text-[#F59E0B] font-semibold">We need: </span>{item.message}</p>}
              {(item.completedAt || item.proofUrl) && (
                <p className="text-xs text-[#9CA3AF] mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {item.completedAt && <span>Completed {fmt(item.completedAt)}</span>}
                  {item.proofUrl && (
                    <a href={item.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary font-medium hover:underline">
                      <ExternalLink size={12} /> View proof
                    </a>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default OnboardingTab;
