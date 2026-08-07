import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export function PrStatusBadge({ state, mergedAt }) {
  if (mergedAt) return <span className="pr-badge pr-badge--merged">Merged</span>;
  if (state === 'open') return <span className="pr-badge pr-badge--open">Open</span>;
  return <span className="pr-badge pr-badge--closed">Closed</span>;
}

export function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <button className="page-btn" onClick={() => onPage(page - 1)} disabled={page <= 1}>←</button>
      <span className="page-info">Page {page} of {pages}</span>
      <button className="page-btn" onClick={() => onPage(page + 1)} disabled={page >= pages}>→</button>
    </div>
  );
}

function AuthorCell({ repoId, login, linked }) {
  if (!login) return '—';
  if (!linked) return login;
  return (
    <Link className="author-link" to={`/repos/${repoId}/contributors/${encodeURIComponent(login)}`}>
      {login}
    </Link>
  );
}

function PrRow({ pr, repoId, showAuthor }) {
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
        {showAuthor && (
          <td className="col-author">
            <AuthorCell repoId={repoId} login={pr.authorLogin} linked />
          </td>
        )}
        <td><PrStatusBadge state={pr.state} mergedAt={pr.mergedAt} /></td>
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
          <td colSpan={showAuthor ? 7 : 6}>
            <div className="pr-summary">{summary}</div>
          </td>
        </tr>
      )}
    </>
  );
}

const PR_STATES = ['all', 'open', 'merged', 'closed'];

export function PrTable({ repoId, author }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState('all');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const showAuthor = !author;

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const fetchPage = useCallback((p, state, query) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, limit: 25 });
    if (state !== 'all') params.set('state', state);
    if (author) params.set('author', author);
    if (query) params.set('q', query);
    api.get(`/analytics/${repoId}/prs?${params}`)
      .then((res) => { setData(res.data); setPage(p); })
      .finally(() => setLoading(false));
  }, [repoId, author]);

  useEffect(() => { fetchPage(1, stateFilter, qDebounced); }, [fetchPage, stateFilter, qDebounced]);

  const handleStateChange = (s) => { setStateFilter(s); fetchPage(1, s, qDebounced); };

  if (loading && !data) return <div className="table-loading">Loading…</div>;

  return (
    <>
      <div className="table-toolbar">
        <div className="pr-filter-tabs">
          {PR_STATES.map((s) => (
            <button
              key={s}
              className={`pr-filter-tab ${stateFilter === s ? 'active' : ''}`}
              onClick={() => handleStateChange(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="text"
          className="table-search"
          placeholder="Search PR titles…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {!data?.total ? (
        <div className="table-empty">
          No pull requests found
          {stateFilter !== 'all' ? ` with state "${stateFilter}"` : ''}
          {qDebounced ? ` matching "${qDebounced}"` : ''}.
        </div>
      ) : null}

      {data?.total > 0 && <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              {showAuthor && <th>Author</th>}
              <th>State</th>
              <th>+/-</th>
              <th>Created</th>
              <th>AI</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((pr) => (
              <PrRow key={pr.id} pr={pr} repoId={repoId} showAuthor={showAuthor} />
            ))}
          </tbody>
        </table>
      </div>}
      {data?.total > 0 && <Pagination page={page} pages={data.pages} onPage={(p) => fetchPage(p, stateFilter, qDebounced)} />}
    </>
  );
}

export function CommitTable({ repoId, author }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const showAuthor = !author;

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const fetchPage = useCallback((p, query) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, limit: 25 });
    if (author) params.set('author', author);
    if (query) params.set('q', query);
    api.get(`/analytics/${repoId}/commits?${params}`)
      .then((res) => { setData(res.data); setPage(p); })
      .finally(() => setLoading(false));
  }, [repoId, author]);

  useEffect(() => { fetchPage(1, qDebounced); }, [fetchPage, qDebounced]);

  if (loading && !data) return <div className="table-loading">Loading…</div>;

  return (
    <>
      <div className="table-toolbar table-toolbar--end">
        <input
          type="text"
          className="table-search"
          placeholder="Search commit messages…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {!data?.total ? (
        <div className="table-empty">
          No commits found{qDebounced ? ` matching "${qDebounced}"` : '. Run a sync first.'}
        </div>
      ) : null}

      {data?.total > 0 && <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>SHA</th>
              <th>Message</th>
              {showAuthor && <th>Author</th>}
              <th>+/-</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((c) => (
              <tr key={c.id}>
                <td className="col-sha">{c.sha.slice(0, 7)}</td>
                <td className="col-title">{c.message.split('\n')[0].slice(0, 72)}</td>
                {showAuthor && (
                  <td className="col-author">
                    <AuthorCell repoId={repoId} login={c.authorLogin} linked />
                  </td>
                )}
                <td className="col-diff">
                  <span className="add">+{c.additions}</span>{' '}
                  <span className="del">-{c.deletions}</span>
                </td>
                <td className="col-date">{new Date(c.committedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
      {data?.total > 0 && (
        <Pagination page={page} pages={data.pages} onPage={(p) => fetchPage(p, qDebounced)} />
      )}
    </>
  );
}
