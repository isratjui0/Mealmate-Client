import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  CalendarDays, Grid3X3, Pill, CheckCircle2, Clock, XCircle,
  AlertCircle, SkipForward, RotateCcw, Plus, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getDashboard } from '../services/analyticsService.js';
import {
  completeOccurrence,
  skipOccurrence,
  snoozeOccurrence,
} from '../services/mealService.js';
import { markDoseTaken, markDoseSkipped } from '../services/doseService.js';
import { getErrorMessage } from '../services/api.js';
import AppLayout from '../layouts/AppLayout.jsx';

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  const load = useCallback(async () => {
    try {
      setError('');
      const d = await getDashboard();
      setData(d);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMealAction(occId, action) {
    setActionLoading((p) => ({ ...p, [occId]: action }));
    try {
      if (action === 'complete') await completeOccurrence(occId);
      else if (action === 'skip') await skipOccurrence(occId);
      else if (action === 'snooze') await snoozeOccurrence(occId);
      toast.success(
        action === 'complete' ? 'Meal marked as completed' :
        action === 'skip' ? 'Meal skipped' : 'Meal snoozed'
      );
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[occId]; return n; });
    }
  }

  async function handleDoseAction(occId, action) {
    setActionLoading((p) => ({ ...p, [occId]: action }));
    try {
      if (action === 'taken') await markDoseTaken(occId);
      else await markDoseSkipped(occId);
      toast.success(action === 'taken' ? 'Dose marked as taken' : 'Dose skipped');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[occId]; return n; });
    }
  }

  return (
    <AppLayout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {getGreeting()}, {user?.name?.split(' ')[0] || 'there'} 👋
            </h1>
            <p className="page-subtitle">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <Link to="/meals" className="btn btn-primary">
            <Plus size={15} />
            Add Meal
          </Link>
        </div>

        {error && (
          <div className="error-box mb-4" role="alert">
            <AlertCircle size={16} className="error-box-icon" />
            <div>
              <div>{error}</div>
              <button className="btn btn-ghost btn-sm" onClick={load} style={{ marginTop: 6, padding: 0 }}>
                Retry
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : data ? (
          <DashboardContent
            data={data}
            onMealAction={handleMealAction}
            onDoseAction={handleDoseAction}
            actionLoading={actionLoading}
          />
        ) : null}
      </div>
    </AppLayout>
  );
}

function DashboardContent({ data, onMealAction, onDoseAction, actionLoading }) {
  const meals = data?.meals || { total: 0, completed: 0, completionRate: 0, items: [] };
  const doses = data?.doses || { total: 0, taken: 0, adherenceRate: 0, items: [] };
  const foodTracking = data?.foodTracking || { totalFoods: 0, recordedCells: 0, consumed: 0, notConsumed: 0, unrecorded: 0 };
  const mealItems = meals.items || [];
  const doseItems = doses.items || [];

  return (
    <>
      {/* Progress stats */}
      <div className="stat-grid mb-6">
        <StatCard
          icon={<CalendarDays size={18} color="var(--color-primary)" />}
          label="Meals Today"
          value={meals.total}
          sub={`${meals.completed} completed`}
          color="var(--color-primary-50)"
        />
        <StatCard
          icon={<CheckCircle2 size={18} color="var(--color-completed)" />}
          label="Meal Rate"
          value={`${meals.completionRate}%`}
          sub="completion"
          color="var(--color-completed-bg)"
        />
        <StatCard
          icon={<Pill size={18} color="var(--color-postponed)" />}
          label="Doses Today"
          value={doses.total}
          sub={`${doses.taken} taken`}
          color="var(--color-postponed-bg)"
        />
        <StatCard
          icon={<TrendingUp size={18} color="var(--color-primary)" />}
          label="Dose Adherence"
          value={`${doses.adherenceRate}%`}
          sub="adherence"
          color="var(--color-primary-50)"
        />
      </div>

      <div className="dashboard-grid">
        {/* Today's meals */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={17} color="var(--color-primary)" />
              Today's Meals
            </span>
            <Link to="/meals" className="btn btn-ghost btn-sm">View all</Link>
          </div>

          {mealItems.length === 0 ? (
            <EmptyCard icon={<CalendarDays size={32} />} message="No meals scheduled today" cta="Add a meal" to="/meals" />
          ) : (
            <div className="occurrence-list">
              {mealItems.map((occ) => (
                <MealOccurrenceItem
                  key={occ.id || occ._id}
                  occ={occ}
                  onAction={onMealAction}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          )}
        </div>

        {/* Today's doses */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pill size={17} color="var(--color-postponed)" />
              Today's Doses
            </span>
            <Link to="/doses" className="btn btn-ghost btn-sm">View all</Link>
          </div>

          {doseItems.length === 0 ? (
            <EmptyCard icon={<Pill size={32} />} message="No doses scheduled today" cta="Add a dose" to="/doses" />
          ) : (
            <div className="occurrence-list">
              {doseItems.map((occ) => (
                <DoseOccurrenceItem
                  key={occ.id || occ._id}
                  occ={occ}
                  onAction={onDoseAction}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          )}
        </div>

        {/* Food tracker summary */}
        <div className="card full-width">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Grid3X3 size={17} color="var(--color-primary)" />
              Food Tracker — Today
            </span>
            <Link to="/food-tracker" className="btn btn-ghost btn-sm">Open tracker</Link>
          </div>

          {foodTracking.totalFoods === 0 ? (
            <EmptyCard icon={<Grid3X3 size={32} />} message="No foods added yet" cta="Open Food Tracker" to="/food-tracker" />
          ) : (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <FoodStat label="Total Foods" value={foodTracking.totalFoods} />
              <FoodStat label="Consumed" value={foodTracking.consumed} color="var(--color-consumed)" />
              <FoodStat label="Not Consumed" value={foodTracking.notConsumed} color="var(--color-not-consumed)" />
              <FoodStat label="Unrecorded" value={foodTracking.unrecorded} color="var(--color-text-muted)" />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                  Recorded: {foodTracking.recordedCells} / {foodTracking.totalFoods}
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${foodTracking.totalFoods > 0 ? (foodTracking.recordedCells / foodTracking.totalFoods) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ padding: '6px', background: color, borderRadius: 8, display: 'flex' }}>
          {icon}
        </div>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-sublabel">{sub}</div>
    </div>
  );
}

function FoodStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || 'var(--color-text)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function MealOccurrenceItem({ occ, onAction, actionLoading }) {
  const id = occ.id || occ._id;
  const mealName = occ.mealId?.name || 'Meal';
  const time = occ.scheduledAt ? format(new Date(occ.scheduledAt), 'h:mm a') : '';
  const isPending = occ.status === 'pending' || occ.status === 'postponed';
  const busy = !!actionLoading[id];

  return (
    <div className="occurrence-item">
      <div className="occurrence-info">
        <span className="occurrence-name">{mealName}</span>
        {time && <span className="occurrence-time"><Clock size={11} style={{ display: 'inline', marginRight: 3 }} />{time}</span>}
      </div>
      <div className="occurrence-actions">
        <StatusBadge status={occ.status} />
        {isPending && (
          <>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => onAction(id, 'complete')}
              disabled={busy}
              title="Mark as completed"
              aria-label={`Mark ${mealName} as completed`}
            >
              {busy && actionLoading[id] === 'complete' ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <CheckCircle2 size={13} />}
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => onAction(id, 'snooze')}
              disabled={busy}
              title="Snooze 10 min"
              aria-label={`Snooze ${mealName}`}
            >
              <RotateCcw size={13} />
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => onAction(id, 'skip')}
              disabled={busy}
              title="Skip"
              aria-label={`Skip ${mealName}`}
            >
              <SkipForward size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function DoseOccurrenceItem({ occ, onAction, actionLoading }) {
  const id = occ.id || occ._id;
  const itemName = occ.doseScheduleId?.itemName || 'Dose';
  const time = occ.scheduledAt ? format(new Date(occ.scheduledAt), 'h:mm a') : '';
  const isPending = occ.status === 'pending' || occ.status === 'postponed';
  const busy = !!actionLoading[id];

  return (
    <div className="occurrence-item">
      <div className="occurrence-info">
        <span className="occurrence-name">{itemName}</span>
        {occ.doseScheduleId?.dosageDescription && (
          <span className="occurrence-time text-muted" style={{ fontSize: 11 }}>
            {occ.doseScheduleId.dosageDescription}
          </span>
        )}
        {time && <span className="occurrence-time"><Clock size={11} style={{ display: 'inline', marginRight: 3 }} />{time}</span>}
      </div>
      <div className="occurrence-actions">
        <StatusBadge status={occ.status === 'taken' ? 'completed' : occ.status} />
        {isPending && (
          <>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => onAction(id, 'taken')}
              disabled={busy}
              title="Mark as taken"
              aria-label={`Mark ${itemName} as taken`}
            >
              {busy && actionLoading[id] === 'taken' ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <CheckCircle2 size={13} />}
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => onAction(id, 'skip')}
              disabled={busy}
              title="Skip"
              aria-label={`Skip ${itemName}`}
            >
              <SkipForward size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyCard({ icon, message, cta, to }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <p className="empty-state-title">{message}</p>
      {cta && (
        <Link to={to} className="btn btn-secondary btn-sm">
          <Plus size={13} /> {cta}
        </Link>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="stat-grid mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 8, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: '60%', height: 28, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: '80%', height: 14 }} />
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`card${i === 2 ? ' full-width' : ''}`}>
            <div className="skeleton" style={{ width: '40%', height: 20, marginBottom: 16 }} />
            {[...Array(3)].map((_, j) => (
              <div key={j} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                <div className="skeleton" style={{ flex: 1, height: 44, borderRadius: 8 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
