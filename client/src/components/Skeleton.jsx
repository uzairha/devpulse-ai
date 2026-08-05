import './Skeleton.css';

export function Skeleton({ width = '100%', height = '1rem', borderRadius = '6px', className = '' }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius }}
    />
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="metric-card">
      <Skeleton width="60%" height="0.75rem" />
      <Skeleton width="40%" height="1.75rem" style={{ marginTop: '0.5rem' }} />
    </div>
  );
}

export function MetricsGridSkeleton({ count = 6 }) {
  return (
    <div className="metrics-grid">
      {Array.from({ length: count }).map((_, i) => <MetricCardSkeleton key={i} />)}
    </div>
  );
}
