import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User, Bell, Shield, Trash2, Save, AlertCircle, CheckCircle2,
  ChevronRight, Database, Download, Activity, ExternalLink, RefreshCw,
} from 'lucide-react';
import AppLayout from '../layouts/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { updateProfile, deleteAccount } from '../services/userService.js';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  registerPushSubscription,
  unregisterPushSubscription,
} from '../services/notificationService.js';
import {
  downloadFoodTrackingExport,
  downloadMealHistoryExport,
  downloadDoseHistoryExport,
} from '../services/exportService.js';
import { getHealth } from '../services/systemService.js';
import { getErrorMessage } from '../services/api.js';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Dhaka', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Pacific/Auckland',
];

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  timezone: z.string(),
});

export default function SettingsPage() {
  const [section, setSection] = useState('profile');

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Manage your account, preferences, and data</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>
          {/* Sidebar nav */}
          <div className="card" style={{ padding: '8px', alignSelf: 'start' }}>
            {[
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'data', label: 'Data & Database', icon: Database },
              { id: 'account', label: 'Account', icon: Shield },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-item${section === id ? ' active' : ''}`}
                onClick={() => setSection(id)}
                style={{ width: '100%', marginBottom: 2 }}
              >
                <Icon size={15} />
                {label}
                {section === id && <ChevronRight size={13} style={{ marginLeft: 'auto' }} />}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div>
            {section === 'profile' && <ProfileSection />}
            {section === 'notifications' && <NotificationsSection />}
            {section === 'data' && <DataExportSection />}
            {section === 'account' && <AccountSection />}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ---- Profile section ----
function ProfileSection() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || '', timezone: user?.timezone || 'UTC' },
  });

  async function onSubmit(data) {
    try {
      const updated = await updateProfile(data);
      updateUser(updated);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Profile Information</h2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '16px', background: 'var(--color-surface-2)', borderRadius: 10 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--color-primary)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700,
        }}>
          {user?.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{user?.name}</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{user?.email}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-group">
          <label htmlFor="settings-name" className="form-label">
            Display name <span className="required">*</span>
          </label>
          <input
            id="settings-name"
            className={`form-input${errors.name ? ' error' : ''}`}
            {...register('name')}
          />
          {errors.name && <span className="form-error">{errors.name.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="settings-email" className="form-label">Email address</label>
          <input
            id="settings-email"
            className="form-input"
            value={user?.email || ''}
            disabled
            style={{ opacity: 0.6, cursor: 'not-allowed' }}
          />
          <span className="form-hint">Email cannot be changed</span>
        </div>

        <div className="form-group">
          <label htmlFor="settings-timezone" className="form-label">Time zone</label>
          <select id="settings-timezone" className="form-select" {...register('timezone')}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Save size={14} />}
          Save changes
        </button>
      </form>
    </div>
  );
}

// ---- Notifications section ----
function NotificationsSection() {
  const { user } = useAuth();
  const toast = useToast();
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState('unknown');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) setPushStatus('not-supported');
    else setPushStatus(Notification.permission);

    getNotificationPreferences()
      .then(setPrefs)
      .catch(() => {
        setPrefs(user?.preferences || {});
      })
      .finally(() => setLoading(false));
  }, [user]);

  async function handleRequestPermission() {
    if (!('Notification' in window)) {
      toast.error('Browser notifications are not supported in this browser.');
      return;
    }
    const permission = await Notification.requestPermission();
    setPushStatus(permission);
    if (permission === 'granted') {
      const sub = await registerPushSubscription();
      if (sub) {
        setPushStatus('subscribed');
        toast.success('Push notifications enabled!');
      } else {
        toast.info('Notifications enabled (VAPID key not set).');
      }
    } else {
      toast.warning('Notification permission denied. Enable it in your browser settings.');
    }
  }

  async function handleUnsubscribe() {
    await unregisterPushSubscription();
    setPushStatus('granted');
    toast.success('Push subscription removed');
  }

  async function savePref(key, value) {
    if (!prefs) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSaving(true);
    try {
      await updateNotificationPreferences({ [key]: value });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  }

  async function saveChannelPref(channel, value) {
    if (!prefs) return;
    const updated = { ...prefs, notificationChannels: { ...prefs.notificationChannels, [channel]: value } };
    setPrefs(updated);
    setSaving(true);
    try {
      await updateNotificationPreferences({ notificationChannels: { [channel]: value } });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const pushStatusMsg = {
    'not-supported': { text: 'Browser notifications are not supported', color: 'var(--color-text-muted)', action: null },
    'denied': { text: 'Notification permission denied — enable in browser settings', color: 'var(--color-missed)', action: null },
    'default': { text: 'Notifications not yet enabled', color: 'var(--color-pending)', action: 'enable' },
    'granted': { text: 'Notification permission granted', color: 'var(--color-completed)', action: 'subscribe' },
    'subscribed': { text: 'Web push subscribed ✓', color: 'var(--color-completed)', action: 'unsubscribe' },
    'unknown': { text: 'Checking notification status…', color: 'var(--color-text-muted)', action: null },
  }[pushStatus] || { text: pushStatus, color: 'var(--color-text-muted)', action: null };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Browser notifications status */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: 16 }}>Browser Notifications</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>Push notifications</div>
            <div style={{ fontSize: 12, color: pushStatusMsg.color, marginTop: 2 }}>{pushStatusMsg.text}</div>
          </div>
          {pushStatusMsg.action === 'enable' && (
            <button className="btn btn-primary btn-sm" onClick={handleRequestPermission}>Enable</button>
          )}
          {pushStatusMsg.action === 'subscribe' && (
            <button className="btn btn-secondary btn-sm" onClick={handleRequestPermission}>Subscribe</button>
          )}
          {pushStatusMsg.action === 'unsubscribe' && (
            <button className="btn btn-ghost btn-sm" onClick={handleUnsubscribe}>Unsubscribe</button>
          )}
        </div>
      </div>

      {/* Reminder preferences */}
      {prefs && (
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: 16 }}>Reminder Preferences</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ToggleRow
              label="Meal reminders"
              description="Receive reminders for scheduled meals"
              value={prefs.mealRemindersEnabled ?? true}
              onChange={(v) => savePref('mealRemindersEnabled', v)}
              disabled={saving}
            />
            <ToggleRow
              label="Dose reminders"
              description="Receive reminders for scheduled doses"
              value={prefs.doseRemindersEnabled ?? true}
              onChange={(v) => savePref('doseRemindersEnabled', v)}
              disabled={saving}
            />

            <div className="divider" />

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="lead-time" className="form-label">Reminder lead time (minutes before)</label>
              <select
                id="lead-time"
                className="form-select"
                style={{ maxWidth: 200 }}
                value={prefs.reminderLeadTimeMinutes ?? 0}
                onChange={(e) => savePref('reminderLeadTimeMinutes', Number(e.target.value))}
                disabled={saving}
              >
                {[0, 5, 10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>{m === 0 ? 'At scheduled time' : `${m} min before`}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="grace-period" className="form-label">Grace period before marking missed</label>
              <select
                id="grace-period"
                className="form-select"
                style={{ maxWidth: 200 }}
                value={prefs.gracePeriodMinutes ?? 30}
                onChange={(e) => savePref('gracePeriodMinutes', Number(e.target.value))}
                disabled={saving}
              >
                {[5, 15, 30, 60, 120, 180].map((m) => (
                  <option key={m} value={m}>{m} minutes</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="snooze-duration" className="form-label">Default snooze duration</label>
              <select
                id="snooze-duration"
                className="form-select"
                style={{ maxWidth: 200 }}
                value={prefs.snoozeDurationMinutes ?? 10}
                onChange={(e) => savePref('snoozeDurationMinutes', Number(e.target.value))}
                disabled={saving}
              >
                {[5, 10, 15].map((m) => (
                  <option key={m} value={m}>{m} minutes</option>
                ))}
              </select>
            </div>

            <div className="divider" />

            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Notification Channels</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <ToggleRow
                  label="In-App notifications"
                  description="Show alerts and badges within MealMate"
                  value={prefs.notificationChannels?.inApp ?? true}
                  onChange={(v) => saveChannelPref('inApp', v)}
                  disabled={saving}
                />
                <ToggleRow
                  label="Browser notifications"
                  description="System popup notifications"
                  value={prefs.notificationChannels?.browser ?? true}
                  onChange={(v) => saveChannelPref('browser', v)}
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Data & Exports section ----
function DataExportSection() {
  const toast = useToast();
  const [exporting, setExporting] = useState({});
  const [healthStatus, setHealthStatus] = useState(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const checkHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const res = await getHealth();
      setHealthStatus(res);
      toast.success('Backend server & database connected!');
    } catch (err) {
      setHealthStatus({ status: 'unreachable', error: getErrorMessage(err) });
      toast.error(getErrorMessage(err));
    } finally {
      setCheckingHealth(false);
    }
  }, [toast]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  async function handleExport(type) {
    setExporting((p) => ({ ...p, [type]: true }));
    try {
      let filename = '';
      if (type === 'food') filename = await downloadFoodTrackingExport();
      else if (type === 'meals') filename = await downloadMealHistoryExport();
      else if (type === 'doses') filename = await downloadDoseHistoryExport();
      toast.success(`Exported ${filename}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting((p) => ({ ...p, [type]: false }));
    }
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Backend & Database Health status */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} color="var(--color-primary)" />
            Backend API & Real Database Status
          </h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={checkHealth}
            disabled={checkingHealth}
          >
            <RefreshCw size={13} className={checkingHealth ? 'spinner' : ''} />
            Check Health
          </button>
        </div>

        <div style={{ padding: '14px', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Target API Base URL:</span>
            <code style={{ fontSize: 12 }}>{baseUrl}</code>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Connection Status:</span>
            {healthStatus?.status === 'ok' || healthStatus?.success ? (
              <span className="badge badge-active" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={11} /> Connected to Database
              </span>
            ) : healthStatus?.status === 'unreachable' ? (
              <span className="badge badge-inactive" style={{ color: 'var(--color-missed)' }}>
                Offline / Unreachable
              </span>
            ) : (
              <span className="badge badge-pending">Checking...</span>
            )}
          </div>
          {healthStatus?.uptime !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Server Uptime:</span>
              <span>{Math.round(healthStatus.uptime)}s</span>
            </div>
          )}
          {healthStatus?.error && (
            <div style={{ marginTop: 8, color: 'var(--color-missed)', fontSize: 12 }}>
              {healthStatus.error}
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a
            href="http://localhost:5000/api/docs"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
          >
            <ExternalLink size={13} />
            Swagger API Docs
          </a>
          <a
            href="http://localhost:5000/api/docs.json"
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm"
          >
            OpenAPI Spec JSON
          </a>
        </div>
      </div>

      {/* CSV Data Exports */}
      <div className="card">
        <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Download size={18} color="var(--color-primary)" />
          Export Data to CSV
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
          Download comprehensive CSV datasets directly from your database records:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ padding: 14, border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Food Tracking CSV</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Full historical food intake matrix</div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('food')}
              disabled={exporting.food}
              style={{ marginTop: 'auto' }}
            >
              {exporting.food ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <Download size={13} />}
              Download Food CSV
            </button>
          </div>

          <div style={{ padding: 14, border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Meal History CSV</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Completed, skipped, and postponed meals</div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('meals')}
              disabled={exporting.meals}
              style={{ marginTop: 'auto' }}
            >
              {exporting.meals ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <Download size={13} />}
              Download Meal CSV
            </button>
          </div>

          <div style={{ padding: 14, border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Dose History CSV</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Taken, skipped, and postponed medications</div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('doses')}
              disabled={exporting.doses}
              style={{ marginTop: 'auto' }}
            >
              {exporting.doses ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <Download size={13} />}
              Download Dose CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Account section ----
function AccountSection() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    if (deleteInput !== 'DELETE') {
      toast.error('Type DELETE (in caps) to confirm');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount();
      toast.success('Account deleted');
      await logout();
      navigate('/login');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: 16 }}>Account Details</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Name</span>
            <span style={{ fontWeight: 500 }}>{user?.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Email</span>
            <span style={{ fontWeight: 500 }}>{user?.email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Time zone</span>
            <span style={{ fontWeight: 500 }}>{user?.timezone || 'UTC'}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ borderColor: '#fecaca' }}>
        <h2 className="card-title" style={{ marginBottom: 8, color: 'var(--color-missed)' }}>
          <Trash2 size={16} style={{ display: 'inline', marginRight: 6 }} />
          Delete account
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Permanently delete your account and cascade-wipe all associated database records. This action cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            className="btn btn-danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete my account
          </button>
        ) : (
          <div style={{ background: 'var(--color-missed-bg)', border: '1px solid #fecaca', borderRadius: 8, padding: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--color-missed)', marginBottom: 12, fontWeight: 500 }}>
              Type <strong>DELETE</strong> to confirm account deletion:
            </p>
            <input
              type="text"
              className="form-input"
              placeholder="Type DELETE"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              style={{ marginBottom: 12 }}
              aria-label="Type DELETE to confirm"
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteInput !== 'DELETE'}
              >
                {deleting ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Trash2 size={14} />}
                Permanently delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ label, description, value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{description}</div>}
      </div>
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span className="toggle-slider" />
      </label>
    </div>
  );
}
