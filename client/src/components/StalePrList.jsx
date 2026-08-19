export function StalePrList({ data, repoFullName }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="stale-prs">
      {data.map((pr) => (
        <a
          key={pr.number}
          href={`https://github.com/${repoFullName}/pull/${pr.number}`}
          target="_blank"
          rel="noreferrer"
          className="stale-pr-row"
        >
          <span className="stale-pr-number">#{pr.number}</span>
          <span className="stale-pr-title">{pr.title}</span>
          <span className="stale-pr-author">{pr.authorLogin}</span>
          <span className="stale-pr-age">{pr.ageDays}d open</span>
        </a>
      ))}
    </div>
  );
}
