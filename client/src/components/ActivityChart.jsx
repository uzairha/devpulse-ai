export function ActivityChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  // Show last 30 points max for readability
  const visible = data.slice(-30);

  return (
    <div className="chart-wrap">
      <div className="chart-bars">
        {visible.map((d) => (
          <div key={d.date} className="chart-bar-col" title={`${d.date}: ${d.count} commits`}>
            <div
              className="chart-bar"
              style={{ height: `${Math.round((d.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="chart-axis">
        <span>{visible[0]?.date.slice(5)}</span>
        <span>{visible[visible.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

const LINE_CHART_WIDTH = 300;
const LINE_CHART_HEIGHT = 80;

export function ThroughputChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  const stepX = data.length > 1 ? LINE_CHART_WIDTH / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? i * stepX : LINE_CHART_WIDTH / 2;
    const y = LINE_CHART_HEIGHT - (d.count / max) * LINE_CHART_HEIGHT;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <div className="chart-wrap">
      <svg
        className="chart-line-svg"
        viewBox={`0 0 ${LINE_CHART_WIDTH} ${LINE_CHART_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <path d={linePath} className="chart-line-path" />
        {points.map((p) => (
          <circle key={p.weekStart} cx={p.x} cy={p.y} r="2.5" className="chart-line-dot">
            <title>{`Week of ${p.weekStart}: ${p.count} merged`}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-axis">
        <span>{data[0]?.weekStart}</span>
        <span>{data[data.length - 1]?.weekStart}</span>
      </div>
    </div>
  );
}
