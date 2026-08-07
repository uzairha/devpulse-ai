import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { PrTable, CommitTable } from '../components/RepoTables';
import './DashboardPage.css';
import './RepoDetailPage.css';

const DAYS_OPTIONS = [7, 30, 90];

function TrendBadge({ deltaPct, invert }) {
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

function MetricCard({ label, value, sub, trend, trendInvert }) {
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

function ContributorDetailPage() {
  const { id, login } = useParams();
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pull requests');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .get(`/analytics/${id}/contributors/${encodeURIComponent(login)}?days=${days}`)
      .then((res) => setSummary(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, login, days]);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="repo-detail-breadcrumb">
          <Link to="/repos" className="breadcrumb-link">Repositories</Link>
          <span className="breadcrumb-sep">/</span>
          <Link to={`/repos/${id}`} className="breadcrumb-link">
            {summary?.repo?.fullName ?? '…'}
          </Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{login}</span>
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
        <div className="dashboard-loading">Loading contributor…</div>
      ) : (
        <>
          <section className="dash-section">
            <div className="metrics-grid">
              <MetricCard label="Pull Requests" value={summary.prCount} trend={summary.trends?.prCount} />
              <MetricCard
                label="Merged"
                value={summary.mergedPrCount}
                sub={`${summary.mergeRate}% merge rate`}
                trend={summary.trends?.mergedCount}
              />
              <MetricCard
                label="Avg Time to Merge"
                value={summary.avgTimeToMergeHours != null ? `${summary.avgTimeToMergeHours}h` : null}
                trend={summary.trends?.avgTimeToMergeHours}
                trendInvert
              />
              <MetricCard label="Commits" value={summary.commitCount} trend={summary.trends?.commitCount} />
              <MetricCard label="Lines Changed" value={`+${summary.totalAdditions} / -${summary.totalDeletions}`} />
            </div>
          </section>

          <div className="detail-tabs">
            {['pull requests', 'commits'].map((tab) => (
              <button
                key={tab}
                className={`detail-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === 'pull requests' && (
            <section className="dash-section">
              <PrTable repoId={id} author={login} />
            </section>
          )}

          {activeTab === 'commits' && (
            <section className="dash-section">
              <CommitTable repoId={id} author={login} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default ContributorDetailPage;
