export function CommitTypeBreakdown({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="size-breakdown">
      {data.map((d) => (
        <div key={d.type} className="size-breakdown-row">
          <span className="size-breakdown-label size-breakdown-label--wide">{d.type}</span>
          <div className="size-breakdown-bar-track">
            <div className="size-breakdown-bar" style={{ width: `${Math.round((d.count / max) * 100)}%` }} />
          </div>
          <span className="size-breakdown-count">{d.count}</span>
        </div>
      ))}
    </div>
  );
}
