import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import api from '../../services/api';
import './Layout.css';

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
