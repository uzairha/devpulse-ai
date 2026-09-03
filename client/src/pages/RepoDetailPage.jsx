import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { PrTable, CommitTable } from '../components/RepoTables';
import { MetricCard } from '../components/MetricCard';
import { DateRangePicker, DEFAULT_RANGE, buildRangeQuery } from '../components/DateRangePicker';
import { ActivityChart, ThroughputChart } from '../components/ActivityChart';
import { PrSizeBreakdown } from '../components/PrSizeBreakdown';
import { ContributorLeaderboard } from '../components/ContributorLeaderboard';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { StalePrList } from '../components/StalePrList';
import { CommitTypeBreakdown } from '../components/CommitTypeBreakdown';
import './DashboardPage.css';
import './RepoDetailPage.css';

function ChatPanel({ repoId }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Ask me anything about this repository — PRs, commits, contributors, trends.' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useState(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const history = messages.filter((m) => m.role !== 'assistant' || messages.indexOf(m) > 0);
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const res = await api.post(`/ai/chat/${repoId}`, { message: text, history });
      setMessages([...next, { role: 'assistant', content: res.data.reply }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Sorry, something went wrong. Try again.' }]);
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg--${m.role}`}>
            <span className="chat-bubble">{m.content}</span>
          </div>
        ))}
        {sending && (
          <div className="chat-msg chat-msg--assistant">
            <span className="chat-bubble chat-thinking">Thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about this repo…"
          disabled={sending}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={sending || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

function HealthScoreCard({ repoId }) {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.get(`/ai/health-score/${repoId}`).then((res) => setHealth(res.data)).catch(() => {});
  }, [repoId]);

  if (!health) return null;

  const color = health.score >= 75 ? 'var(--success)' : health.score >= 50 ? 'var(--warning)' : 'var(--danger)';
  const bg    = health.score >= 75 ? 'var(--success-bg-subtle)' : health.score >= 50 ? 'var(--warning-bg)' : 'var(--danger-bg)';
  const border= health.score >= 75 ? 'var(--success-border)' : health.score >= 50 ? 'var(--warning-border)' : 'var(--danger-border)';

  return (
    <div className="health-card" style={{ background: bg, borderColor: border }}>
      <div className="health-score" style={{ color }}>{health.score}</div>
      <div className="health-label">Health Score</div>
      <div className="health-breakdown">
        {Object.entries(health.breakdown).map(([k, v]) => (
          <div key={k} className="health-item">
            <span className="health-item-label">
              {k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
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
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    Promise.resolve().then(() => {
      setLoading(true);
      setError('');
      api
        .get(`/analytics/${id}?${buildRangeQuery(range)}`)
        .then((res) => setAnalytics(res.data))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    });
  }, [id, range]);

  const { prMetrics: pr, commitMetrics: cm, trends, leaderboard, activityHeatmap, stalePrs, repo } = analytics || {};

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="repo-detail-breadcrumb">
          <Link to="/repos" className="breadcrumb-link">Repositories</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{repo?.fullName ?? '…'}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <DateRangePicker range={range} onChange={setRange} />
          {analytics && (
            <button
              className="export-btn"
              onClick={() => {
                const blob = new Blob([JSON.stringify(analytics, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${analytics.repo.fullName.replace('/', '-')}-analytics-${analytics.startDate}_to_${analytics.endDate}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              title="Export analytics as JSON"
            >
              Export JSON
            </button>
          )}
        </div>
      </div>

      <div className="detail-tabs">
        {[
          ['overview', 'Overview'],
          ['pull requests', 'Pull Requests'],
          ['commits', 'Commits'],
          ['chat', 'Chat'],
        ].map(([tab, label]) => (
          <button
            key={tab}
            className={`detail-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {label}
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
                    label="Avg Review Turnaround"
                    value={pr.avgReviewTurnaroundHours != null ? `${pr.avgReviewTurnaroundHours}h` : null}
                    trend={trends?.avgReviewTurnaroundHours}
                    trendInvert
                  />
                  <MetricCard label="Lines Changed" value={`+${pr.totalAdditions} / -${pr.totalDeletions}`} />
                </div>

                <div className="chart-section">
                  <h3 className="chart-title">Weekly Merged PRs</h3>
                  <ThroughputChart data={pr.weeklyThroughput} />
                </div>

                <div className="chart-section">
                  <h3 className="chart-title">PR Size Breakdown</h3>
                  <PrSizeBreakdown data={pr.sizeBreakdown} />
                </div>

                {stalePrs?.length > 0 && (
                  <div className="chart-section">
                    <h3 className="chart-title">Stale Open PRs (7+ days)</h3>
                    <StalePrList data={stalePrs} repoFullName={repo?.fullName} />
                  </div>
                )}
              </section>

              <section className="dash-section">
                <h2 className="dash-section-title">Commits</h2>
                <div className="metrics-grid">
                  <MetricCard label="Total Commits" value={cm.total} trend={trends?.commitCount} />
                  <MetricCard label="Contributors" value={cm.contributorCount} />
                  <MetricCard label="Conventional Commits" value={cm.total > 0 ? `${cm.complianceRate}%` : null} />
                  <MetricCard label="Lines Changed" value={`+${cm.totalAdditions} / -${cm.totalDeletions}`} />
                </div>

                <div className="chart-section">
                  <h3 className="chart-title">Daily Commit Activity</h3>
                  <ActivityChart data={cm.dailyActivity} />
                </div>

                {cm.typeBreakdown?.length > 0 && (
                  <div className="chart-section">
                    <h3 className="chart-title">Commit Message Types</h3>
                    <CommitTypeBreakdown data={cm.typeBreakdown} />
                  </div>
                )}
              </section>

              {activityHeatmap?.some((c) => c.count > 0) && (
                <section className="dash-section">
                  <h2 className="dash-section-title">Activity Heatmap</h2>
                  <div className="chart-section">
                    <h3 className="chart-title">When the team is most active (PRs + commits, UTC)</h3>
                    <ActivityHeatmap data={activityHeatmap} />
                  </div>
                </section>
              )}

              {leaderboard?.length > 0 && (
                <section className="dash-section">
                  <h2 className="dash-section-title">Contributor Leaderboard</h2>
                  <div className="contributors">
                    <ContributorLeaderboard data={leaderboard} repoId={id} />
                  </div>
                </section>
              )}
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

          {activeTab === 'chat' && (
            <section className="dash-section">
              <h2 className="dash-section-title">AI Chat</h2>
              <ChatPanel repoId={id} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default RepoDetailPage;
