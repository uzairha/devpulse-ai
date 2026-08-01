import { useEffect, useState, useCallback } from 'react';
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

function PrStatebadge({ state, mergedAt }) {
  if (mergedAt) return <span className="pr-badge pr-badge--merged">Merged</span>;
  if (state === 'open') return <span className="pr-badge pr-badge--open">Open</span>;
  return <span className="pr-badge pr-badge--closed">Closed</span>;
}

function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <button className="page-btn" onClick={() => onPage(page - 1)} disabled={page <= 1}>←</button>
      <span className="page-info">Page {page} of {pages}</span>
      <button className="page-btn" onClick={() => onPage(page + 1)} disabled={page >= pages}>→</button>
    </div>
  );
}

function PrRow({ pr }) {
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSummarize = async () => {
    if (summary) { setExpanded((v) => !v); return; }
    setLoadingSummary(true);
    try {
      const res = await api.post('/ai/pr-summary', { prId: pr.id });
      setSummary(res.data.summary);
      setExpanded(true);
    } catch {
      setSummary('Failed to generate summary.');
      setExpanded(true);
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <>
      <tr>
        <td className="col-num">#{pr.number}</td>
        <td className="col-title">{pr.title}</td>
        <td className="col-author">{pr.authorLogin}</td>
        <td><PrStatebage state={pr.state} mergedAt={pr.mergedAt} /></td>
        <td className="col-diff">
          <span className="add">+{pr.additions}</span>{' '}
          <span className="del">-{pr.deletions}</span>
        </td>
        <td className="col-date">{new Date(pr.createdAt).toLocaleDateString()}</td>
        <td>
          <button className="summarize-btn" onClick={handleSummarize} disabled={loadingSummary}>
            {loadingSummary ? '…' : summary ? (expanded ? '▲' : '▼') : '✦ AI'}
          </button>
        </td>
      </tr>
      {expanded && summary && (
        <tr className="summary-row">
          <td colSpan={7}>
            <div className="pr-summary">{summary}</div>
          </td>
        </tr>
      )}
    </>
  );
}

function PrTable({ repoId }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback((p) => {
    setLoading(true);
    api.get(`/analytics/${repoId}/prs?page=${p}&limit=25`)
      .then((res) => { setData(res.data); setPage(p); })
      .finally(() => setLoading(false));
  }, [repoId]);

  useEffect(() => { fetch(1); }, [fetch]);

  if (loading && !data) return <div className="table-loading">Loading…</div>;
  if (!data?.total) return <div className="table-empty">No pull requests found. Run a sync first.</div>;

  return (
    <>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Author</th>
              <th>State</th>
              <th>+/-</th>
              <th>Created</th>
              <th>AI</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((pr) => <PrRow key={pr.id} pr={pr} />)}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={data.pages} onPage={fetch} />
    </>
  );
}

function CommitTable({ repoId }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback((p) => {
    setLoading(true);
    api.get(`/analytics/${repoId}/commits?page=${p}&limit=25`)
      .then((res) => { setData(res.data); setPage(p); })
      .finally(() => setLoading(false));
  }, [repoId]);

  useEffect(() => { fetch(1); }, [fetch]);

  if (loading && !data) return <div className="table-loading">Loading…</div>;
  if (!data?.total) return <div className="table-empty">No commits found. Run a sync first.</div>;

  return (
    <>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>SHA</th>
              <th>Message</th>
              <th>Author</th>
              <th>+/-</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((c) => (
              <tr key={c.id}>
                <td className="col-sha">{c.sha.slice(0, 7)}</td>
                <td className="col-title">{c.message.split('\n')[0].slice(0, 72)}</td>
                <td className="col-author">{c.authorLogin ?? '—'}</td>
                <td className="col-diff">
                  <span className="add">+{c.additions}</span>{' '}
                  <span className="del">-{c.deletions}</span>
                </td>
                <td className="col-date">{new Date(c.committedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={data.pages} onPage={fetch} />
    </>
  );
}

// Fix typo in PrStatebage -> PrStatebage kept for render consistency
function PrStatebage({ state, mergedAt }) {
  if (mergedAt) return <span className="pr-badge pr-badge--merged">Merged</span>;
  if (state === 'open') return <span className="pr-badge pr-badge--open">Open</span>;
  return <span className="pr-badge pr-badge--closed">Closed</span>;
}

function HealthScoreCard({ repoId }) {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.get(`/ai/health-score/${repoId}`).then((res) => setHealth(res.data)).catch(() => {});
  }, [repoId]);

  if (!health) return null;

  const color = health.score >= 75 ? '#15803d' : health.score >= 50 ? '#d97706' : '#b91c1c';
  const bg    = health.score >= 75 ? '#f0fdf4' : health.score >= 50 ? '#fffbeb' : '#fef2f2';
  const border= health.score >= 75 ? '#bbf7d0' : health.score >= 50 ? '#fde68a' : '#fecaca';

  return (
    <div className="health-card" style={{ background: bg, borderColor: border }}>
      <div className="health-score" style={{ color }}>{health.score}</div>
      <div className="health-label">Health Score</div>
      <div className="health-breakdown">
        {Object.entries(health.breakdown).map(([k, v]) => (
          <div key={k} className="health-item">
            <span className="health-item-label">
              {k.replace(/([A-Z])/g, ' $1').toLowerCase()}
            </span>
            <span className="health-item-val">{v}%</span>
          </div>
        ))}
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
  const [activeTab, setActiveTab] = useState('overview');

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

      <div className="detail-tabs">
        {['overview', 'pull requests', 'commits'].map((tab) => (
          <button
            key={tab}
            className={`detail-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
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

          {activeTab === 'overview' && (
            <>
              <HealthScoreCard repoId={id} />

              <section className="dash-section">
                <h2 className="dash-section-title">Pull Requests</h2>
                <div className="metrics-grid">
                  <MetricCard label="Total PRs" value={pr.total} />
                  <MetricCard label="Merged" value={pr.merged} sub={`${pr.mergeRate}% merge rate`} />
                  <MetricCard label="Open" value={pr.open} />
                  <MetricCard label="Avg Time to Merge" value={pr.avgTimeToMergeHours != null ? `${pr.avgTimeToMergeHours}h` : null} />
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

          {activeTab === 'pull requests' && (
            <section className="dash-section">
              <h2 className="dash-section-title">Pull Requests</h2>
              <PrTable repoId={id} />
            </section>
          )}

          {activeTab === 'commits' && (
            <section className="dash-section">
              <h2 className="dash-section-title">Commits</h2>
              <CommitTable repoId={id} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default RepoDetailPage;
