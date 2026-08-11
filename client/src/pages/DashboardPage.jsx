import { useEffect, useState } from 'react';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import { MetricsGridSkeleton } from '../components/Skeleton';
import OnboardingSteps from '../components/OnboardingSteps';
import { MetricCard } from '../components/MetricCard';
import { DateRangePicker, DEFAULT_RANGE, buildRangeQuery } from '../components/DateRangePicker';
import './DashboardPage.css';

function ActivityChart({ data }) {
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

function DashboardPage() {
  const { user } = useAuth();
  const [repos, setRepos] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/repos').then((res) => {
      setRepos(res.data);
      if (res.data.length > 0) setSelectedId(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError('');
    api
      .get(`/analytics/${selectedId}?${buildRangeQuery(range)}`)
      .then((res) => setAnalytics(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedId, range]);

  const { prMetrics: pr, commitMetrics: cm, trends } = analytics || {};

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
        <div className="dashboard-controls">
          {repos.length > 0 && (
            <select
              className="dash-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
          )}
          <DateRangePicker range={range} onChange={setRange} />
        </div>
      </div>

      {repos.length === 0 ? (
        <OnboardingSteps hasGithub={!!user?.githubUsername} hasRepos={false} />
      ) : error ? (
        <div className="dashboard-error">{error}</div>
      ) : loading ? (
        <div>
          <MetricsGridSkeleton count={6} />
        </div>
      ) : !analytics ? null : (
        <>
          {!analytics.repo.lastSyncAt && (
            <div className="dashboard-warn">
              No data yet — go to <a href="/repos">Repositories</a> and run a sync first.
            </div>
          )}

          <section className="dash-section">
            <h2 className="dash-section-title">Pull Requests</h2>
            <div className="metrics-grid">
              <MetricCard label="Total PRs" value={pr.total} trend={trends?.prCount} />
              <MetricCard
                label="Merged"
                value={pr.merged}
                sub={`${pr.mergeRate}% merge rate`}
                trend={trends?.mergedCount}
              />
              <MetricCard label="Open" value={pr.open} />
              <MetricCard
                label="Avg Time to Merge"
                value={pr.avgTimeToMergeHours != null ? `${pr.avgTimeToMergeHours}h` : null}
                trend={trends?.avgTimeToMergeHours}
                trendInvert
              />
              <MetricCard label="Avg Reviews / PR" value={pr.avgReviewCount} />
              <MetricCard
                label="Lines Changed"
                value={`+${pr.totalAdditions} / -${pr.totalDeletions}`}
              />
            </div>
          </section>

          <section className="dash-section">
            <h2 className="dash-section-title">Commits</h2>
            <div className="metrics-grid">
              <MetricCard label="Total Commits" value={cm.total} trend={trends?.commitCount} />
              <MetricCard label="Contributors" value={cm.contributorCount} />
              <MetricCard
                label="Lines Changed"
                value={`+${cm.totalAdditions} / -${cm.totalDeletions}`}
              />
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

export default DashboardPage;
