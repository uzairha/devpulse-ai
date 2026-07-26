import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import './ReposPage.css';

function RepoCard({ repo, action, onAction, loading }) {
  return (
    <div className="repo-card">
      <div className="repo-card-info">
        <div className="repo-card-header">
          <span className="repo-name">{repo.fullName || repo.name}</span>
          {repo.private && <span className="repo-badge">Private</span>}
          {repo.language && <span className="repo-lang">{repo.language}</span>}
        </div>
        {repo.description && <p className="repo-desc">{repo.description}</p>}
      </div>
      <button
        className={`repo-btn ${action === 'disconnect' ? 'repo-btn--danger' : 'repo-btn--primary'}`}
        onClick={() => onAction(repo)}
        disabled={loading}
      >
        {action === 'connect' ? 'Connect' : 'Disconnect'}
      </button>
    </div>
  );
}

function ReposPage() {
  const [connected, setConnected] = useState([]);
  const [available, setAvailable] = useState([]);
  const [loadingConnected, setLoadingConnected] = useState(true);
  const [loadingAvailable, setLoadingAvailable] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchConnected = useCallback(async () => {
    setLoadingConnected(true);
    try {
      const res = await api.get('/repos');
      setConnected(res.data);
    } catch {
      setError('Failed to load connected repositories.');
    } finally {
      setLoadingConnected(false);
    }
  }, []);

  const fetchAvailable = useCallback(async () => {
    setLoadingAvailable(true);
    try {
      const res = await api.get('/repos/available');
      setAvailable(res.data);
    } catch {
      // Non-fatal — user may not have GitHub connected
      setAvailable([]);
    } finally {
      setLoadingAvailable(false);
    }
  }, []);

  useEffect(() => {
    fetchConnected();
    fetchAvailable();
  }, [fetchConnected, fetchAvailable]);

  const handleConnect = async (repo) => {
    setActionId(repo.githubId);
    setError('');
    try {
      await api.post('/repos', { githubRepoId: repo.githubId });
      await Promise.all([fetchConnected(), fetchAvailable()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  };

  const handleDisconnect = async (repo) => {
    setActionId(repo.id);
    setError('');
    try {
      await api.delete(`/repos/${repo.id}`);
      await Promise.all([fetchConnected(), fetchAvailable()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  };

  const filteredAvailable = available.filter(
    (r) =>
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="repos-page">
      <div className="repos-header">
        <div>
          <h1 className="repos-title">Repositories</h1>
          <p className="repos-subtitle">Connect GitHub repositories to start tracking analytics.</p>
        </div>
      </div>

      {error && <div className="repos-error">{error}</div>}

      <section className="repos-section">
        <h2 className="repos-section-title">
          Connected <span className="repos-count">{connected.length}</span>
        </h2>
        {loadingConnected ? (
          <div className="repos-loading">Loading…</div>
        ) : connected.length === 0 ? (
          <div className="repos-empty">No repositories connected yet.</div>
        ) : (
          <div className="repos-list">
            {connected.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={{ ...repo, fullName: repo.fullName }}
                action="disconnect"
                onAction={handleDisconnect}
                loading={actionId === repo.id}
              />
            ))}
          </div>
        )}
      </section>

      <section className="repos-section">
        <h2 className="repos-section-title">Add from GitHub</h2>
        {loadingAvailable ? (
          <div className="repos-loading">Loading your GitHub repositories…</div>
        ) : available.length === 0 ? (
          <div className="repos-empty">
            {connected.length > 0
              ? 'All your repositories are connected.'
              : 'No GitHub repositories found. Make sure you signed in with GitHub.'}
          </div>
        ) : (
          <>
            <input
              className="repos-search"
              type="text"
              placeholder="Search repositories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="repos-list">
              {filteredAvailable.length === 0 ? (
                <div className="repos-empty">No repositories match your search.</div>
              ) : (
                filteredAvailable.map((repo) => (
                  <RepoCard
                    key={repo.githubId}
                    repo={repo}
                    action="connect"
                    onAction={handleConnect}
                    loading={actionId === repo.githubId}
                  />
                ))
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default ReposPage;
