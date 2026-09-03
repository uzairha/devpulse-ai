import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityHeatmap } from './ActivityHeatmap.jsx';

// A full 7x24 grid, quiet except for one busy cell (Wed 18:00).
const grid = [];
for (let day = 0; day < 7; day++) {
  for (let hour = 0; hour < 24; hour++) {
    grid.push({ day, hour, count: day === 3 && hour === 18 ? 9 : 0 });
  }
}

describe('ActivityHeatmap', () => {
  it('renders nothing when data is missing or entirely zero', () => {
    expect(render(<ActivityHeatmap data={null} />).container).toBeEmptyDOMElement();
    expect(
      render(<ActivityHeatmap data={[{ day: 0, hour: 0, count: 0 }]} />).container
    ).toBeEmptyDOMElement();
  });

  it('renders a labelled row for each weekday', () => {
    render(<ActivityHeatmap data={grid} />);
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d) => {
      expect(screen.getByText(d)).toBeInTheDocument();
    });
  });

  it('tints only the cells with activity and titles them with the local hour and count', () => {
    const { container } = render(<ActivityHeatmap data={grid} />);
    const tinted = [...container.querySelectorAll('.heatmap-cell')].filter((c) => c.style.background);
    expect(tinted).toHaveLength(1);
    expect(tinted[0]).toHaveAttribute('title', expect.stringContaining('Wed 18:00'));
    expect(tinted[0]).toHaveAttribute('title', expect.stringContaining('9 events'));
  });
});
