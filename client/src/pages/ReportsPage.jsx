import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import './ReportsPage.css';

function ReportsPage() {
  const [searchParams] = useSearchParams();
  const [repos, setRepos] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = (repoId, { autoView, repoFullName } = {}) => {
    api
      .get(`/ai/weekly-report/${repoId}/history`)
      .then((res) => {
        setHistory(res.data);
        if (autoView && res.data.length > 0) {
          const [latest] = res.data;
          setReport({ report: latest.content, generatedAt: latest.createdAt, repoFullName });
        }
      })
      .catch(() => setHistory([]));
  };

  useEffect(() => {
    api.get('/repos').then((res) => {
      setRepos(res.data);
      if (res.data.length === 0) return;

      const linkedId = searchParams.get('repo');
      const initial = res.data.find((r) => r.id === linkedId) ?? res.data[0];
      setSelectedId(initial.id);
      loadHistory(initial.id, { autoView: initial.id === linkedId, repoFullName: initial.fullName });
    });
  }, []);

  const selectRepo = (repoId) => {
    setSelectedId(repoId);
    setReport(null);
    loadHistory(repoId);
  };

  const handleGenerate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    setError('');
    setReport(null);
    try {
      const res = await api.post(`/ai/weekly-report/${selectedId}`);
      setReport(res.data);
      loadHistory(selectedId);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const repoFullName = repos.find((r) => r.id === selectedId)?.fullName ?? '';

  const viewPastReport = (past) => {
    setReport({
      report: past.content,
      generatedAt: past.createdAt,
      repoFullName,
    });
  };

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h1 className="reports-title">Reports</h1>
          <p className="reports-subtitle">
            AI-generated weekly engineering digests. Auto-generated every Monday for repos with weekly
            reports enabled in <a href="/settings">Settings</a> — you&apos;ll get a notification when a new one is ready.
          </p>
        </div>
      </div>

      {repos.length === 0 ? (
        <div className="reports-empty">
          No repositories connected. Go to <a href="/repos">Repositories</a> to connect one first.
        </div>
      ) : (
        <>
          <div className="reports-controls">
            <select
              className="reports-select"
              value={selectedId}
              onChange={(e) => selectRepo(e.target.value)}
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>{r.fullName}</option>
              ))}
            </select>
            <button
              className="reports-generate-btn"
              onClick={handleGenerate}
              disabled={generating || !selectedId}
            >
              {generating ? 'Generating…' : '✦ Generate weekly report'}
            </button>
          </div>

          {error && <div className="reports-error">{error}</div>}

          {generating && (
            <div className="reports-generating">
              <div className="generating-spinner" />
              Asking GPT-4o-mini to summarise the last 7 days…
            </div>
          )}

          {report && (
            <div className="report-card">
              <div className="report-meta">
                <span className="report-repo">{report.repoFullName}</span>
                <span className="report-date">
                  Generated {new Date(report.generatedAt).toLocaleString()}
                </span>
              </div>
              <div className="report-body">
                {report.report.split('\n\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>
          )}

          {!report && !generating && (
            <div className="reports-placeholder">
              <div className="placeholder-icon">◈</div>
              <p>Select a repository and click <strong>Generate weekly report</strong> to get an AI digest of the last 7 days of activity.</p>
            </div>
          )}

          {history.length > 0 && (
            <div className="reports-history">
              <h2 className="reports-history-title">Past reports</h2>
              <div className="reports-history-list">
                {history.map((past) => (
                  <button
                    key={past.id}
                    className="reports-history-item"
                    onClick={() => viewPastReport(past)}
                  >
                    <span>{new Date(past.periodStart).toLocaleDateString()} – {new Date(past.periodEnd).toLocaleDateString()}</span>
                    <span className="reports-history-date">{new Date(past.createdAt).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ReportsPage;
