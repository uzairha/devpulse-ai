const SIZE_LABELS = {
  XS: '≤10 lines',
  S: '11–50 lines',
  M: '51–200 lines',
  L: '201–500 lines',
  XL: '500+ lines',
};

export function PrSizeBreakdown({ data }) {
  if (!data || data.every((d) => d.count === 0)) return null;
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="size-breakdown">
      {data.map((d) => (
        <div key={d.label} className="size-breakdown-row" title={SIZE_LABELS[d.label]}>
          <span className="size-breakdown-label">{d.label}</span>
          <div className="size-breakdown-bar-track">
            <div className="size-breakdown-bar" style={{ width: `${Math.round((d.count / max) * 100)}%` }} />
          </div>
          <span className="size-breakdown-count">{d.count}</span>
        </div>
      ))}
    </div>
  );
}
