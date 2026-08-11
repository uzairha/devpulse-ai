import { useState } from 'react';

const DAYS_OPTIONS = [7, 30, 90];

export const DEFAULT_RANGE = { days: 30, startDate: null, endDate: null };

export function buildRangeQuery({ days, startDate, endDate }) {
  if (startDate && endDate) return `startDate=${startDate}&endDate=${endDate}`;
  return `days=${days}`;
}

export function DateRangePicker({ range, onChange }) {
  const isCustom = !!(range.startDate && range.endDate);
  const [customOpen, setCustomOpen] = useState(isCustom);
  // Draft values track each input independently so picking a start date doesn't
  // get wiped out while the end date is still unset (and vice versa).
  const [draftStart, setDraftStart] = useState(range.startDate || '');
  const [draftEnd, setDraftEnd] = useState(range.endDate || '');
  const todayStr = new Date().toISOString().slice(0, 10);

  const applyPreset = (days) => {
    setCustomOpen(false);
    setDraftStart('');
    setDraftEnd('');
    onChange({ days, startDate: null, endDate: null });
  };

  const commitCustom = (startDate, endDate) => {
    if (!startDate || !endDate || startDate > endDate) return;
    onChange({ days: null, startDate, endDate });
  };

  const handleStartChange = (value) => {
    setDraftStart(value);
    commitCustom(value, draftEnd);
  };

  const handleEndChange = (value) => {
    setDraftEnd(value);
    commitCustom(draftStart, value);
  };

  return (
    <div className="date-range-picker">
      <div className="days-tabs">
        {DAYS_OPTIONS.map((d) => (
          <button
            key={d}
            className={`days-tab ${!isCustom && range.days === d ? 'active' : ''}`}
            onClick={() => applyPreset(d)}
          >
            {d}d
          </button>
        ))}
        <button
          className={`days-tab ${isCustom ? 'active' : ''}`}
          onClick={() => setCustomOpen((v) => !v)}
        >
          Custom
        </button>
      </div>
      {(customOpen || isCustom) && (
        <div className="custom-range-inputs">
          <input
            type="date"
            className="date-input"
            max={draftEnd || todayStr}
            value={draftStart}
            onChange={(e) => handleStartChange(e.target.value)}
          />
          <span className="date-range-sep">–</span>
          <input
            type="date"
            className="date-input"
            min={draftStart || undefined}
            max={todayStr}
            value={draftEnd}
            onChange={(e) => handleEndChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
