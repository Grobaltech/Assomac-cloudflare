import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type AppShellProps = {
  children: ReactNode;
};

type Profile = {
  common_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  status: string | null;
};

type UserRole = {
  role_code: string;
  role_name: string;
};

function Icon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );

    case 'users':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );

    case 'companies':
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M5 21V5l7-3 7 3v16" />
          <path d="M9 9h1" />
          <path d="M14 9h1" />
          <path d="M9 13h1" />
          <path d="M14 13h1" />
          <path d="M10 21v-4h4v4" />
        </svg>
      );

    case 'transfer':
      return (
        <svg {...common}>
          <path d="M7 7h11l-3-3" />
          <path d="M18 7l-3 3" />
          <path d="M17 17H6l3 3" />
          <path d="M6 17l3-3" />
        </svg>
      );

    case 'history':
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case 'admin':
      return (
        <svg {...common}>
          <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );

    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
      );

    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );

    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.42 1.42-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.42-1.42.06-.06A1.7 1.7 0 0 0 9.4 15a1.7 1.7 0 0 0-1.56-1.03H7v-2h.84A1.7 1.7 0 0 0 9.4 11a1.7 1.7 0 0 0-.34-1.88L9 9.06l1.42-1.42.06.06A1.7 1.7 0 0 0 12.36 8.04 1.7 1.7 0 0 0 13.39 6.48V6h2v.48a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.42 1.42-.06.06A1.7 1.7 0 0 0 19.4 11c.2.6.77 1 1.4 1H21v2h-.2c-.63 0-1.2.4-1.4 1z" />
        </svg>
      );

    case 'security':
      return (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      );

    case 'logout':
      return (
        <svg {...common}>
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
        </svg>
      );

    case 'menu':
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </svg>
      );

    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </svg>
      );

    case 'chevron':
      return (
        <svg {...common}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );

    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
      );

    default:
      return null;
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) return 'AS';

  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatRole(role: string) {
  if (!role) return 'User';

  return role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('common_name, full_name, avatar_url, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData);
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles (
          code,
          name
        )
      `)
      .eq('user_id', user.id)
      .is('ended_at', null)
      .limit(1)
      .maybeSingle();

    if (roleData?.roles) {
      const roleInfo = Array.isArray(roleData.roles)
        ? roleData.roles[0]
        : roleData.roles;

      if (roleInfo) {
        setRole({
          role_code: roleInfo.code,
          role_name: roleInfo.name,
        });
      }
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  const displayName =
    profile?.common_name ||
    profile?.full_name ||
    'ASOMAC User';

  const fullName =
    profile?.full_name ||
    displayName;

  const roleName =
    role?.role_name ||
    formatRole(role?.role_code || '');

  const avatarLetters = initials(displayName);

  const navigation = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: 'dashboard',
    },
    {
      label: 'Users',
      path: '/users',
      icon: 'users',
    },
    {
      label: 'Companies',
      path: '/companies',
      icon: 'companies',
    },
    {
      label: 'Transfers',
      path: '/transfers',
      icon: 'transfer',
    },
    {
      label: 'Historical Data',
      path: '/historical',
      icon: 'history',
    },
  ];

  const administration = {
    label: 'Administration',
    path: '/admin',
    icon: 'admin',
  };

  return (
    <div className="asomac-app-shell">
      <aside className={`asomac-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <Link to="/dashboard" className="asomac-brand">
            <div className="brand-mark">
              <span>A</span>
            </div>

            <div className="brand-text">
              <strong>ASOMAC</strong>
              <small>Management Platform</small>
            </div>
          </Link>

          <button
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="sidebar-section-title">
          WORKSPACE
        </div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const active =
              location.pathname === item.path ||
              location.pathname.startsWith(`${item.path}/`);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-link ${active ? 'active' : ''}`}
              >
                <span className="sidebar-icon">
                  <Icon name={item.icon} size={19} />
                </span>

                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-section-title administration-title">
          SYSTEM
        </div>

        <Link
          to={administration.path}
          className={`sidebar-link ${
            location.pathname.startsWith('/admin') ? 'active' : ''
          }`}
        >
          <span className="sidebar-icon">
            <Icon name={administration.icon} size={19} />
          </span>

          <span>{administration.label}</span>
        </Link>

        <div className="sidebar-bottom">
          <div className="sidebar-status-card">
            <div className="status-orb" />

            <div>
              <strong>System Online</strong>
              <span>ASOMAC services active</span>
            </div>
          </div>

          <div className="sidebar-footer">
            <span>ASOMAC Platform</span>
            <span>v1.0</span>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="asomac-main">
        <header className="asomac-topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Icon name="menu" size={22} />
            </button>

            <div className="breadcrumb-area">
              <span className="breadcrumb-main">
                ASOMAC
              </span>

              <span className="breadcrumb-divider">
                /
              </span>

              <span className="breadcrumb-current">
                {location.pathname === '/dashboard'
                  ? 'Dashboard'
                  : location.pathname === '/users'
                  ? 'Users'
                  : location.pathname === '/companies'
                  ? 'Companies'
                  : location.pathname === '/transfers'
                  ? 'Transfers'
                  : location.pathname === '/historical'
                  ? 'Historical Data'
                  : 'Administration'}
              </span>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              className="notification-button"
              title="Notifications"
            >
              <Icon name="bell" size={20} />
              <span className="notification-dot" />
            </button>

            <div className="topbar-divider" />

            <div className="profile-container" ref={profileRef}>
              <button
                className={`profile-trigger ${
                  profileOpen ? 'open' : ''
                }`}
                onClick={() => setProfileOpen((value) => !value)}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="profile-avatar"
                  />
                ) : (
                  <div className="profile-avatar avatar-fallback">
                    {avatarLetters}
                  </div>
                )}

                <div className="profile-summary">
                  <strong>{displayName}</strong>
                  <span>{roleName}</span>
                </div>

                <span className="profile-chevron">
                  <Icon name="chevron" size={17} />
                </span>
              </button>

              {profileOpen && (
                <div className="profile-menu">
                  <div className="profile-menu-header">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={displayName}
                        className="profile-menu-avatar"
                      />
                    ) : (
                      <div className="profile-menu-avatar avatar-fallback large">
                        {avatarLetters}
                      </div>
                    )}

                    <div>
                      <strong>{displayName}</strong>
                      <span>{fullName}</span>
                      <small>{roleName}</small>
                    </div>
                  </div>

                  <div className="profile-menu-divider" />

                  <button
                    onClick={() => navigate('/profile')}
                    className="profile-menu-item"
                  >
                    <Icon name="user" size={18} />
                    <span>My Profile</span>
                  </button>

                  <button
                    onClick={() => navigate('/settings')}
                    className="profile-menu-item"
                  >
                    <Icon name="settings" size={18} />
                    <span>Account Settings</span>
                  </button>

                  <button
                    onClick={() => navigate('/security')}
                    className="profile-menu-item"
                  >
                    <Icon name="security" size={18} />
                    <span>Security</span>
                  </button>

                  <div className="profile-menu-divider" />

                  <button
                    onClick={logout}
                    className="profile-menu-item danger"
                  >
                    <Icon name="logout" size={18} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="asomac-content">
          {children}
        </main>
      </div>
    </div>
  );
}
