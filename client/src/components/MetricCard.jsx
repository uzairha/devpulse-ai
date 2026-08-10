export function TrendBadge({ deltaPct, invert }) {
  if (deltaPct == null) return null;
  const isGood = invert ? deltaPct <= 0 : deltaPct >= 0;
  const direction = deltaPct === 0 ? 'flat' : isGood ? 'up' : 'down';
  const arrow = deltaPct === 0 ? '→' : deltaPct > 0 ? '▲' : '▼';
  return (
    <span className={`metric-trend metric-trend--${direction}`} title="vs. previous period">
      {arrow} {Math.abs(deltaPct)}%
    </span>
  );
}

export function MetricCard({ label, value, sub, trend, trendInvert }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <div className="metric-value-row">
        <span className="metric-value">{value ?? '—'}</span>
        {trend && <TrendBadge deltaPct={trend.deltaPct} invert={trendInvert} />}
      </div>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  );
}
