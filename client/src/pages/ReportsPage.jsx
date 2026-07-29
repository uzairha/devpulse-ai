import './ReportsPage.css';

function ReportsPage() {
  return (
    <div className="reports-page">
      <div className="reports-header">
        <h1 className="reports-title">Reports</h1>
        <p className="reports-subtitle">AI-generated weekly engineering reports — coming in Week 3.</p>
      </div>

      <div className="reports-coming-soon">
        <div className="coming-soon-icon">◈</div>
        <h2 className="coming-soon-title">AI Reports</h2>
        <p className="coming-soon-desc">
          Weekly summaries, PR health scores, and natural-language insights about your team's
          engineering velocity will appear here once your repositories are synced.
        </p>
        <div className="coming-soon-features">
          <div className="coming-soon-feature">Weekly engineering digest</div>
          <div className="coming-soon-feature">PR health score (0–100)</div>
          <div className="coming-soon-feature">Contributor spotlight</div>
          <div className="coming-soon-feature">Trend analysis</div>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
