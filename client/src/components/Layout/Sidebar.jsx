import { NavLink } from 'react-router-dom';
import './Layout.css';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/repos', label: 'Repositories', icon: '⌥' },
  { to: '/reports', label: 'Reports', icon: '◈' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">DevPulse AI</div>
      <nav className="sidebar-nav">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
