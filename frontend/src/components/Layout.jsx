import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LangSwitcher from './LangSwitcher';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };
  const initials = user?.employee_name
    ? user.employee_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.username?.[0]?.toUpperCase() || '?';

  const NAV = [
    { to: '/',           icon: '▪', label: t('nav.dashboard'),  roles: ['admin','hr','manager'] },
    { to: '/employees',  icon: '▪', label: t('nav.employees'),  roles: ['admin','hr','manager'] },
    { to: '/positions',  icon: '▪', label: t('nav.positions'),  roles: ['admin'] },
    { to: '/attendance', icon: '▪', label: t('nav.attendance'), roles: ['admin','hr','manager','employee'] },
    { to: '/payroll',    icon: '▪', label: t('nav.payroll'),    roles: ['admin','hr','manager','employee'] },
    { to: '/audit-logs', icon: '▪', label: t('nav.auditLogs'),  roles: ['admin','hr'] },
  ];

  const visibleNav = NAV.filter(n => n.roles.includes(user?.role));

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img
            src="/assets/logo.png"
            alt="Devinflow"
            className="sidebar-brand-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling.style.display = 'block';
            }}
          />
          <div className="sidebar-brand-fallback">
            <span className="sidebar-brand-name">Devinflow</span>
          </div>
          <span className="sidebar-brand-sub">HR Management System</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">{t('nav.navigation')}</div>
          {visibleNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <LangSwitcher variant="sidebar" />
          <div className="sidebar-user">
            <div className="avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="name">{user?.employee_name || user?.username}</div>
              <div className="role">{user?.role}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
