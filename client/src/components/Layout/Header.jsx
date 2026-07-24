import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import './Layout.css';

function Avatar({ user }) {
  if (user.githubAvatarUrl) {
    return <img src={user.githubAvatarUrl} alt={user.githubUsername} className="avatar-img" />;
  }
  const initials = (user.email || 'U')[0].toUpperCase();
  return <div className="avatar-initials">{initials}</div>;
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
