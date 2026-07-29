import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import './DashboardPage.css';
import './RepoDetailPage.css';

const DAYS_OPTIONS = [7, 30, 90];

function MetricCard({ label, value, sub }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value ?? '—'}</span>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  );
}

function ActivityChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  const visible = data.slice(-30);
  return (
    <div className="chart-wrap">
      <div className="chart-bars">
        {visible.map((d) => (
          <div key={d.date} className="chart-bar-col" title={`${d.date}: ${d.count} commits`}>
            <div className="chart-bar" style={{ height: `${Math.round((d.count / max) * 100)}%` }} />
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

function RepoDetailPage() {
  const { id } = useParams();
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .get(`/analytics/${id}?days=${days}`)
      .then((res) => setAnalytics(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, days]);

  const { prMetrics: pr, commitMetrics: cm, repo } = analytics || {};

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="repo-detail-breadcrumb">
          <Link to="/repos" className="breadcrumb-link">Repositories</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{repo?.fullName ?? '…'}</span>
        </div>
        <div className="days-tabs">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              className={`days-tab ${days === d ? 'active' : ''}`}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="dashboard-error">{error}</div>
      ) : loading ? (
        <div className="dashboard-loading">Loading analytics…</div>
      ) : !analytics ? null : (
        <>
          {!repo.lastSyncAt && (
            <div className="dashboard-warn">
              No data yet — go to <Link to="/repos">Repositories</Link> and run a sync.
            </div>
          )}

          <section className="dash-section">
            <h2 className="dash-section-title">Pull Requests</h2>
            <div className="metrics-grid">
              <MetricCard label="Total PRs" value={pr.total} />
              <MetricCard label="Merged" value={pr.merged} sub={`${pr.mergeRate}% merge rate`} />
              <MetricCard label="Open" value={pr.open} />
              <MetricCard
                label="Avg Time to Merge"
                value={pr.avgTimeToMergeHours != null ? `${pr.avgTimeToMergeHours}h` : null}
              />
              <MetricCard label="Avg Reviews / PR" value={pr.avgReviewCount} />
              <MetricCard label="Lines Changed" value={`+${pr.totalAdditions} / -${pr.totalDeletions}`} />
            </div>
          </section>

          <section className="dash-section">
            <h2 className="dash-section-title">Commits</h2>
            <div className="metrics-grid">
              <MetricCard label="Total Commits" value={cm.total} />
              <MetricCard label="Contributors" value={cm.contributorCount} />
              <MetricCard label="Lines Changed" value={`+${cm.totalAdditions} / -${cm.totalDeletions}`} />
            </div>

            {cm.topContributors.length > 0 && (
              <div className="contributors">
                <h3 className="contributors-title">Top Contributors</h3>
                <div className="contributors-list">
                  {cm.topContributors.map((c) => (
                    <div key={c.login} className="contributor-row">
                      <span className="contributor-login">{c.login}</span>
                      <span className="contributor-count">{c.count} commits</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="chart-section">
              <h3 className="chart-title">Daily Commit Activity</h3>
              <ActivityChart data={cm.dailyActivity} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default RepoDetailPage;
