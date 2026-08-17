import { Link } from 'react-router-dom';

const MEDALS = ['🥇', '🥈', '🥉'];

export function ContributorLeaderboard({ data, repoId }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="leaderboard">
      {data.map((c, i) => (
        <Link
          key={c.login}
          to={`/repos/${repoId}/contributors/${encodeURIComponent(c.login)}`}
          className="leaderboard-row"
        >
          <span className="leaderboard-rank">{MEDALS[i] || `#${i + 1}`}</span>
          <span className="leaderboard-login">{c.login}</span>
          <span className="leaderboard-stat">{c.prCount} PRs</span>
          <span className="leaderboard-stat">{c.commitCount} commits</span>
          <span className="leaderboard-stat leaderboard-lines">
            +{c.additions} / -{c.deletions}
          </span>
        </Link>
      ))}
    </div>
  );
}
