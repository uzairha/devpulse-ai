import { useState } from 'react';
import useAuth from '../hooks/useAuth';
import api from '../services/api';
import './SettingsPage.css';

function SettingsPage() {
  const { user, logout } = useAuth();
  const [weeklyReport, setWeeklyReport] = useState(user?.weeklyReportEmail ?? true);
  const [syncNotifs, setSyncNotifs] = useState(user?.syncNotifications ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.patch('/auth/settings', {
        weeklyReportEmail: weeklyReport,
        syncNotifications: syncNotifs,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
      </div>

      <section className="settings-section">
        <h2 className="settings-section-title">Account</h2>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Email</div>
              <div className="settings-row-value">{user?.email ?? '—'}</div>
            </div>
          </div>
          <div className="settings-divider" />
          <div className="settings-row">
            <div>
              <div className="settings-row-label">GitHub Account</div>
              <div className="settings-row-value">
                {user?.githubUsername ? (
                  <span className="github-connected">@{user.githubUsername} connected</span>
                ) : (
                  <span className="github-disconnected">Not connected</span>
                )}
              </div>
            </div>
            {!user?.githubUsername && (
              <a href="/api/auth/github" className="settings-btn settings-btn--secondary">
                Connect GitHub
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Notifications</h2>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Weekly report emails</div>
              <div className="settings-row-hint">Receive a weekly summary of your team's activity</div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={weeklyReport}
                onChange={(e) => setWeeklyReport(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="settings-divider" />
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Sync notifications</div>
              <div className="settings-row-hint">Get notified when a sync completes or fails</div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={syncNotifs}
                onChange={(e) => setSyncNotifs(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {error && <div className="settings-error">{error}</div>}
        {saved && <div className="settings-success">Preferences saved.</div>}

        <button
          className="settings-btn settings-btn--primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Danger zone</h2>
        <div className="settings-card settings-card--danger">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Sign out</div>
              <div className="settings-row-hint">Sign out of your account on this device</div>
            </div>
            <button className="settings-btn settings-btn--danger" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default SettingsPage;
