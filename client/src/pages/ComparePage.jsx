import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { DateRangePicker, DEFAULT_RANGE, buildRangeQuery } from '../components/DateRangePicker';
import './ReportsPage.css';
import './RepoDetailPage.css';
import './ComparePage.css';

function healthColor(score) {
  if (score >= 75) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

function ComparePage() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.resolve().then(() => {
      setLoading(true);
      setError('');
      api
        .get(`/analytics/compare?${buildRangeQuery(range)}`)
        .then((res) => setData(res.data))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    });
  }, [range]);

  return (
    <div className="compare-page">
      <div className="compare-header">
        <div>
          <h1 className="reports-title">Compare Repositories</h1>
          <p className="reports-subtitle">Activity and health across all your connected repos, side by side.</p>
        </div>
        <DateRangePicker range={range} onChange={setRange} />
      </div>

      {error ? (
        <div className="reports-error">{error}</div>
      ) : loading ? (
        <div className="table-loading">Loading…</div>
      ) : !data || data.repos.length === 0 ? (
        <div className="reports-empty">
          No repositories connected. Go to <a href="/repos">Repositories</a> to connect one first.
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Health</th>
                <th>PRs</th>
                <th>Merge Rate</th>
                <th>Avg Merge Time</th>
                <th>Avg Review Turnaround</th>
                <th>Commits</th>
                <th>Contributors</th>
                <th>Conventional Commits</th>
                <th>Lines Changed</th>
              </tr>
            </thead>
            <tbody>
              {data.repos.map((r) => (
                <tr key={r.repo.id}>
                  <td>
                    <Link to={`/repos/${r.repo.id}`} className="author-link">
                      {r.repo.fullName}
                    </Link>
                  </td>
                  <td>
                    <span className="compare-health" style={{ color: healthColor(r.healthScore) }}>
                      {r.healthScore}
                    </span>
                  </td>
                  <td>{r.mergedCount} / {r.prCount}</td>
                  <td>{r.mergeRate}%</td>
                  <td>{r.avgTimeToMergeHours != null ? `${r.avgTimeToMergeHours}h` : '—'}</td>
                  <td>{r.avgReviewTurnaroundHours != null ? `${r.avgReviewTurnaroundHours}h` : '—'}</td>
                  <td>{r.commitCount}</td>
                  <td>{r.contributorCount}</td>
                  <td>{r.commitCount > 0 ? `${r.commitComplianceRate}%` : '—'}</td>
                  <td className="col-diff">
                    <span className="add">+{r.additions}</span> / <span className="del">-{r.deletions}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ComparePage;
