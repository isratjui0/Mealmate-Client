import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Grid3X3,
  Pill,
  BarChart3,
  Settings,
  LogOut,
  Utensils,
  Menu,
  Bell,
  Check,
  CheckCheck,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getNotifications, markNotificationRead } from '../services/notificationService.js';
import { formatDistanceToNow } from 'date-fns';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/meals', icon: CalendarDays, label: 'Meal Schedule' },
  { to: '/food-tracker', icon: Grid3X3, label: 'Food Tracker' },
  { to: '/doses', icon: Pill, label: 'Dose Tracker' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('mealmate_desktop_sidebar_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [desktopCollapsedNotifOpen, setDesktopCollapsedNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const collapsedNotifRef = useRef(null);

  const fetchNotifs = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getNotifications(false);
      const items = Array.isArray(data) ? data : data?.notifications || [];
      setNotifications(items);
      const unread = items.filter((n) => !n.read && !n.isRead).length;
      setUnreadCount(unread);
    } catch {
      // silently fail if backend is restarting
    }
  }, [user]);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000); // 30s poll
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  useEffect(() => {
    try {
      localStorage.setItem('mealmate_desktop_sidebar_open', String(desktopSidebarOpen));
    } catch {
      // ignore
    }
  }, [desktopSidebarOpen]);

  // Click outside to close notifications
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (collapsedNotifRef.current && !collapsedNotifRef.current.contains(e.target)) {
        setDesktopCollapsedNotifOpen(false);
      }
    }
    if (notifOpen || desktopCollapsedNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen, desktopCollapsedNotifOpen]);

  async function handleMarkRead(id) {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => ((n.id || n._id) === id ? { ...n, read: true, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  }

  async function handleMarkAllRead() {
    const unread = notifications.filter((n) => !n.read && !n.isRead);
    for (const n of unread) {
      const id = n.id || n._id;
      if (id) {
        markNotificationRead(id).catch(() => {});
      }
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true, isRead: true })));
    setUnreadCount(0);
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className={`app-layout${desktopSidebarOpen ? '' : ' sidebar-collapsed'}`}>
      {/* Sidebar backdrop (mobile) */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} aria-label="Main navigation">
        {/* Logo and Controls */}
        <div className="sidebar-logo" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="sidebar-logo-icon" aria-hidden="true">
              <Utensils size={18} />
            </div>
            <span className="sidebar-logo-text">MealMate</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Notification bell on desktop */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setNotifOpen(!notifOpen)}
                title="Notifications"
                aria-label={`Notifications, ${unreadCount} unread`}
                style={{ position: 'relative' }}
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="badge-notification-count">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {notifOpen && (
                <NotificationDropdown
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onMarkRead={handleMarkRead}
                  onMarkAllRead={handleMarkAllRead}
                  onClose={() => setNotifOpen(false)}
                />
              )}
            </div>

            {/* Close sidebar button */}
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => {
                setSidebarOpen(false);
                setDesktopSidebarOpen(false);
              }}
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="nav-section" style={{ flex: 1 }}>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="nav-icon" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer: user + logout */}
        <div className="sidebar-footer">
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', marginBottom: 4 }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--color-primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </div>
            </div>
          </div>
          <button className="nav-item" onClick={handleLogout} style={{ color: 'var(--color-missed)' }}>
            <LogOut className="nav-icon" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        {/* Desktop Collapsed Header (shown when sidebar is closed on desktop) */}
        {!desktopSidebarOpen && (
          <header className="desktop-collapsed-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setDesktopSidebarOpen(true)}
                title="Open sidebar"
                aria-label="Open sidebar"
                style={{ gap: 8, padding: '6px 12px' }}
              >
                <PanelLeftOpen size={18} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Open sidebar</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    background: 'var(--color-primary)',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                  }}
                  aria-hidden="true"
                >
                  <Utensils size={13} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 15 }}>MealMate</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Notification bell on collapsed header */}
              <div style={{ position: 'relative' }} ref={collapsedNotifRef}>
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => setDesktopCollapsedNotifOpen(!desktopCollapsedNotifOpen)}
                  title="Notifications"
                  aria-label={`Notifications, ${unreadCount} unread`}
                  style={{ position: 'relative' }}
                >
                  <Bell size={16} />
                  {unreadCount > 0 && (
                    <span className="badge-notification-count">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {desktopCollapsedNotifOpen && (
                  <NotificationDropdown
                    notifications={notifications}
                    unreadCount={unreadCount}
                    onMarkRead={handleMarkRead}
                    onMarkAllRead={handleMarkAllRead}
                    onClose={() => setDesktopCollapsedNotifOpen(false)}
                  />
                )}
              </div>

              {/* User avatar and profile link */}
              <NavLink
                to="/settings"
                className="btn btn-ghost btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}
                title="Account Settings"
                aria-label="Account Settings"
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                  {user?.name?.split(' ')[0] || 'User'}
                </span>
              </NavLink>
            </div>
          </header>
        )}

        {/* Mobile header */}
        <header className="mobile-header">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: 'var(--color-primary)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Utensils size={14} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>MealMate</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setNotifOpen(!notifOpen)}
              aria-label="Notifications"
              style={{ position: 'relative' }}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    background: 'var(--color-missed, #dc2626)',
                    color: 'white',
                    fontSize: 9,
                    fontWeight: 700,
                    borderRadius: '50%',
                    width: 14,
                    height: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <NavLink to="/settings" className="btn btn-ghost btn-icon" aria-label="Settings">
              <Settings size={18} />
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function NotificationDropdown({ notifications, unreadCount, onMarkRead, onMarkAllRead, onClose }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        width: 320,
        maxHeight: 400,
        background: 'var(--color-bg-card, #ffffff)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        borderRadius: 12,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        marginTop: 6,
      }}
      role="dialog"
      aria-label="Notifications panel"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface-2)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>Notifications ({unreadCount} unread)</span>
        {unreadCount > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onMarkAllRead}
            style={{ fontSize: 11, padding: '2px 6px', height: 'auto' }}
          >
            <CheckCheck size={12} /> Mark all read
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 320 }}>
        {!notifications.length ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            No notifications yet
          </div>
        ) : (
          notifications.map((n) => {
            const id = n.id || n._id;
            const isRead = n.read || n.isRead;
            const timeAgo = n.createdAt ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }) : '';

            return (
              <div
                key={id}
                onClick={() => !isRead && onMarkRead(id)}
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  background: isRead ? 'transparent' : 'var(--color-primary-50, #f4f4f5)',
                  cursor: isRead ? 'default' : 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: isRead ? 500 : 700, fontSize: 13, color: 'var(--color-text)' }}>
                    {n.title || n.message || 'Reminder'}
                  </div>
                  {!isRead && (
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkRead(id);
                      }}
                      title="Mark as read"
                      style={{ padding: 2, width: 18, height: 18, minWidth: 'unset' }}
                    >
                      <Check size={11} />
                    </button>
                  )}
                </div>
                {n.body && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 2 }}>
                    {n.body}
                  </div>
                )}
                {timeAgo && (
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {timeAgo}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
