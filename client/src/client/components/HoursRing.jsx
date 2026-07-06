/**
 * HoursRing — circular SVG progress ring showing support hours used vs total.
 */
const HoursRing = ({ used = 0, total = 0, size = 100 }) => {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.min(used / total, 1) : 0;
  const stroke = circumference * (1 - pct);

  const color =
    pct >= 0.9 ? '#EF4444' :
    pct >= 0.7 ? '#F59E0B' :
    '#FF5A1F';

  const remaining = Math.max(0, total - used);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2B2A2A"
          strokeWidth={8}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={stroke}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      {/* Center label (overlaid) */}
      <div className="text-center -mt-1">
        <p className="text-white font-bold text-lg leading-none">{remaining}</p>
        <p className="text-[#9CA3AF] text-[10px]">hrs left</p>
      </div>
      <p className="text-[#6B7280] text-xs">{used} / {total} hrs used</p>
    </div>
  );
};

export default HoursRing;
