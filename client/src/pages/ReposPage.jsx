import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../services/api';
import './ReposPage.css';

function SyncStatus({ status, lastSyncAt }) {
  if (status === 'running') return <span className="sync-badge sync-badge--running">Syncing…</span>;
  if (status === 'failed') return <span className="sync-badge sync-badge--failed">Sync failed</span>;
  if (lastSyncAt) {
    const d = new Date(lastSyncAt);
    return (
      <span className="sync-badge sync-badge--ok">
        Synced {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  }
  return <span className="sync-badge sync-badge--none">Never synced</span>;
}

function ConnectedRepoCard({ repo, onDisconnect, onSync, disconnecting, syncing }) {
  return (
    <div className="repo-card">
      <div className="repo-card-info">
        <div className="repo-card-header">
          <span className="repo-name">{repo.fullName}</span>
          {repo.private && <span className="repo-badge">Private</span>}
          {repo.language && <span className="repo-lang">{repo.language}</span>}
        </div>
        {repo.description && <p className="repo-desc">{repo.description}</p>}
        <SyncStatus status={repo.syncStatus} lastSyncAt={repo.lastSyncAt} />
      </div>
      <div className="repo-card-actions">
        <button
          className="repo-btn repo-btn--secondary"
          onClick={() => onSync(repo)}
          disabled={syncing || repo.syncStatus === 'running'}
          title="Sync now"
        >
          {syncing || repo.syncStatus === 'running' ? '…' : '↻'}
        </button>
        <button
          className="repo-btn repo-btn--danger"
          onClick={() => onDisconnect(repo)}
          disabled={disconnecting}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

function AvailableRepoCard({ repo, onConnect, connecting }) {
  return (
    <div className="repo-card">
      <div className="repo-card-info">
        <div className="repo-card-header">
          <span className="repo-name">{repo.fullName}</span>
          {repo.private && <span className="repo-badge">Private</span>}
          {repo.language && <span className="repo-lang">{repo.language}</span>}
        </div>
        {repo.description && <p className="repo-desc">{repo.description}</p>}
      </div>
      <button
        className="repo-btn repo-btn--primary"
        onClick={() => onConnect(repo)}
        disabled={connecting}
      >
        Connect
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
  const [syncingId, setSyncingId] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const pollRef = useRef(null);

  const fetchConnected = useCallback(async () => {
    setLoadingConnected(true);
    try {
      const res = await api.get('/repos');
      setConnected(res.data.map((r) => ({ ...r, syncStatus: null })));
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
      setAvailable([]);
    } finally {
      setLoadingAvailable(false);
    }
  }, []);

  useEffect(() => {
    fetchConnected();
    fetchAvailable();
    return () => clearInterval(pollRef.current);
  }, [fetchConnected, fetchAvailable]);

  const updateRepoSyncStatus = (repoId, patch) => {
    setConnected((prev) =>
      prev.map((r) => (r.id === repoId ? { ...r, ...patch } : r)),
    );
  };

  const pollSyncStatus = (repoId) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/repos/${repoId}/sync-status`);
        const { latestJob, lastSyncAt } = res.data;
        if (!latestJob || latestJob.status !== 'running') {
          clearInterval(pollRef.current);
          setSyncingId(null);
          updateRepoSyncStatus(repoId, {
            syncStatus: latestJob?.status ?? null,
            lastSyncAt,
          });
        }
      } catch {
        clearInterval(pollRef.current);
        setSyncingId(null);
      }
    }, 3000);
  };

  const handleSync = async (repo) => {
    setSyncingId(repo.id);
    setError('');
    updateRepoSyncStatus(repo.id, { syncStatus: 'running' });
    try {
      await api.post(`/repos/${repo.id}/sync`);
      pollSyncStatus(repo.id);
    } catch (err) {
      setError(err.message);
      updateRepoSyncStatus(repo.id, { syncStatus: null });
      setSyncingId(null);
    }
  };

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
              <ConnectedRepoCard
                key={repo.id}
                repo={repo}
                onDisconnect={handleDisconnect}
                onSync={handleSync}
                disconnecting={actionId === repo.id}
                syncing={syncingId === repo.id}
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
                  <AvailableRepoCard
                    key={repo.githubId}
                    repo={repo}
                    onConnect={handleConnect}
                    connecting={actionId === repo.githubId}
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
