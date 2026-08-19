const WIDTH = 120;
const HEIGHT = 28;

export function Sparkline({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  const stepX = data.length > 1 ? WIDTH / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? i * stepX : WIDTH / 2;
    const y = HEIGHT - (d.count / max) * HEIGHT;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Activity over the last ${data.length} days`}
    >
      <path d={linePath} className="sparkline-path" />
    </svg>
  );
}

export function timeAgo(dateStr) {
  if (!dateStr) return 'No recent activity';
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / 86400000);
  if (days <= 0) return 'Active today';
  if (days === 1) return 'Active yesterday';
  if (days < 14) return `Active ${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `Active ${weeks}w ago`;
}
