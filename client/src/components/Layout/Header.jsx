import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import api from '../../services/api';
import './Layout.css';

function RepoSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState([]);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    api.get('/repos').then((res) => setRepos(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (repos.length === 0) return null;

  const match = location.pathname.match(/^\/repos\/([^/]+)/);
  const current = match && repos.find((r) => r.id === match[1]);
  const filtered = repos.filter((r) => r.fullName.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (repo) => {
    setOpen(false);
    setSearch('');
    navigate(`/repos/${repo.id}`);
  };

  return (
    <div className="repo-switcher" ref={ref}>
      <button className="repo-switcher-trigger" onClick={() => setOpen((v) => !v)}>
        <span className="repo-switcher-label">{current ? current.fullName : 'Jump to repo'}</span>
        <span className="repo-switcher-caret">▾</span>
      </button>
      {open && (
        <div className="repo-switcher-dropdown">
          <input
            className="repo-switcher-search"
            type="text"
            placeholder="Search repositories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="repo-switcher-list">
            {filtered.length === 0 ? (
              <div className="repo-switcher-empty">No repositories match.</div>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  className={`repo-switcher-item ${current?.id === r.id ? 'repo-switcher-item--active' : ''}`}
                  onClick={() => handleSelect(r)}
                >
                  {r.fullName}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ user }) {
  if (user.githubAvatarUrl) {
    return <img src={user.githubAvatarUrl} alt={user.githubUsername} className="avatar-img" />;
  }
  const initials = (user.email || 'U')[0].toUpperCase();
  return <div className="avatar-initials">{initials}</div>;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const fetchNotifications = () => {
    api.get('/notifications').then((res) => {
      setNotifications(res.data.notifications);
      setUnread(res.data.unreadCount);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpen = () => {
    setOpen((v) => !v);
  };

  const handleMarkAllRead = async () => {
    await api.patch('/notifications/read-all');
    setUnread(0);
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
  };

  const handleMarkRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((n) => n.map((x) => x.id === id ? { ...x, read: true } : x));
    setUnread((c) => Math.max(0, c - 1));
  };

  const typeIcon = (type) => type === 'sync_failed' ? '✕' : '✓';

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="notif-bell" onClick={handleOpen} aria-label="Notifications">
        🔔
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-title">Notifications</span>
            {unread > 0 && (
              <button className="notif-mark-all" onClick={handleMarkAllRead}>Mark all read</button>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">No notifications yet.</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${n.read ? '' : 'notif-item--unread'}`}
                  onClick={() => !n.read && handleMarkRead(n.id)}
                >
                  <span className={`notif-icon ${n.type === 'sync_failed' ? 'notif-icon--fail' : 'notif-icon--ok'}`}>
                    {typeIcon(n.type)}
                  </span>
                  <div className="notif-content">
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-body">{n.body}</div>
                    <div className="notif-item-time">{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header-left">
        <RepoSwitcher />
      </div>
      <div className="header-right">
        <NotificationBell />
        <div className="avatar-wrapper" onClick={() => setMenuOpen(!menuOpen)}>
          <Avatar user={user} />
          <span className="avatar-name">{user.githubUsername || user.email}</span>
        </div>
        {menuOpen && (
          <div className="avatar-dropdown">
            <button onClick={handleLogout}>Logout</button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
