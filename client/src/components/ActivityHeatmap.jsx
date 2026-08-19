const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_MARKS = [0, 6, 12, 18];

export function ActivityHeatmap({ data }) {
  if (!data || data.every((d) => d.count === 0)) return null;
  const max = Math.max(...data.map((d) => d.count), 1);

  const byDay = Array.from({ length: 7 }, (_, day) =>
    data.filter((d) => d.day === day).sort((a, b) => a.hour - b.hour),
  );

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-grid">
        {byDay.map((row, day) => (
          <div key={day} className="heatmap-row">
            <span className="heatmap-day-label">{DAY_LABELS[day]}</span>
            <div className="heatmap-cells">
              {row.map((cell) => (
                <div
                  key={cell.hour}
                  className="heatmap-cell"
                  style={
                    cell.count > 0
                      ? { background: `color-mix(in srgb, var(--accent) ${Math.round((cell.count / max) * 90) + 10}%, var(--bg-hover))` }
                      : undefined
                  }
                  title={`${DAY_LABELS[day]} ${String(cell.hour).padStart(2, '0')}:00 — ${cell.count} event${cell.count === 1 ? '' : 's'}`}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="heatmap-hour-axis">
          <span className="heatmap-day-label" />
          <div className="heatmap-cells">
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} className="heatmap-hour-label">
                {HOUR_MARKS.includes(hour) ? `${hour}h` : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
