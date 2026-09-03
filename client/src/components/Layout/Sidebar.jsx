import { NavLink } from 'react-router-dom';
import './Layout.css';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/repos', label: 'Repositories' },
  { to: '/compare', label: 'Compare' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">DevPulse AI</div>
      <nav className="sidebar-nav">
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
