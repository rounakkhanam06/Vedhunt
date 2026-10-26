import { useState, useEffect } from 'react';
import { Target } from 'lucide-react';
import clientApi from '../../services/clientApi';

const SECTIONS = [
  { key: 'objective', label: 'Objective' },
  { key: 'targetAudience', label: 'Target audience' },
  { key: 'adStrategySummary', label: 'Ad strategy' },
  { key: 'keyDifferentiator', label: 'Key differentiator / offer' },
  { key: 'specialInstructions', label: 'Special instructions' },
];

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** The campaign strategy Vedhunt has approved for sharing — read-only. */
const StrategyTab = () => {
  const [strategy, setStrategy] = useState(undefined); // undefined = loading, null = none shared yet
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    clientApi.get('/client/strategy')
      .then(({ data }) => { if (live) setStrategy(data.data); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  if (failed) return <p className="text-[#9CA3AF] text-sm">We couldn&apos;t load your strategy just now. Please try again shortly.</p>;
  if (strategy === undefined) {
    return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-primary/30 border-t-[#FF5A1F] rounded-full animate-spin" /></div>;
  }
  if (strategy === null) {
    return (
      <div className="text-center py-16 rounded-xl border border-border-default bg-bg-surface/30">
        <Target size={36} className="text-[#4B5563] mx-auto mb-3" />
        <p className="text-white text-sm font-medium">Your campaign strategy will appear here</p>
        <p className="text-[#9CA3AF] text-xs mt-1">Your account team will share it once it has been finalised.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white text-lg font-semibold">Campaign strategy</h2>
        <p className="text-[#9CA3AF] text-xs mt-1">Version {strategy.version} · shared {fmt(strategy.sharedAt || strategy.updatedAt)}</p>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {SECTIONS.filter((s) => strategy[s.key]).map((s) => (
          <div key={s.key} className="rounded-xl border border-border-default bg-bg-surface/30 p-4">
            <p className="text-[#9CA3AF] text-[11px] uppercase font-bold tracking-wider mb-1.5">{s.label}</p>
            <p className="text-white text-sm whitespace-pre-wrap leading-relaxed">{strategy[s.key]}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StrategyTab;
