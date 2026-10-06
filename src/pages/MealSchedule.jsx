import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Plus, Edit2, Trash2, Pause, Play, Clock, CheckCircle2,
  SkipForward, RotateCcw, AlarmClock, AlertCircle, ChevronLeft, ChevronRight, Download, MessageSquare,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppLayout from '../layouts/AppLayout.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  getMeals, createMeal, updateMeal, deleteMeal, toggleMealPause,
  getOccurrences, completeOccurrence, skipOccurrence, postponeOccurrence, snoozeOccurrence,
} from '../services/mealService.js';
import { downloadMealHistoryExport } from '../services/exportService.js';
import { getErrorMessage } from '../services/api.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SNOOZE_OPTIONS = [5, 10, 15];

// ---- Validation ----
const isHHmm = (v) => /^\d{2}:\d{2}$/.test(v);

const mealSchema = z.object({
  name: z.string().min(1, 'Meal name is required').max(100),
  time: z.string().refine(isHHmm, 'Time must be in HH:mm format (24h)'),
  weekdays: z.array(z.number()).min(1, 'Select at least one day'),
  category: z.string().optional(),
  reminderEnabled: z.boolean().optional(),
  followUpEnabled: z.boolean().optional(),
});

const postponeSchema = z.object({
  minutes: z.coerce.number().int().min(5).max(1440),
});

export default function MealSchedulePage() {
  const toast = useToast();
  const [meals, setMeals] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [occLoading, setOccLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('schedule'); // 'schedule' | 'schedules'
  const [dateOffset, setDateOffset] = useState(0); // days from today
  const [modalState, setModalState] = useState(null); // { type, meal?, occId?, action? }
  const [actionLoading, setActionLoading] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() + dateOffset);
  const dateKey = format(currentDate, 'yyyy-MM-dd');

  const loadMeals = useCallback(async () => {
    try {
      const m = await getMeals();
      setMeals(m || []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  const loadOccurrences = useCallback(async (dk) => {
    setOccLoading(true);
    try {
      const o = await getOccurrences({ date: dk });
      setOccurrences(o || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setOccLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadMeals();
      await loadOccurrences(dateKey);
      setLoading(false);
    })();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!loading) loadOccurrences(dateKey);
  }, [dateKey]); // eslint-disable-line

  async function handleMealAction(occId, action, body) {
    setActionLoading((p) => ({ ...p, [occId]: action }));
    try {
      if (action === 'complete') await completeOccurrence(occId, body?.notes);
      else if (action === 'skip') await skipOccurrence(occId, body?.notes);
      else if (action === 'snooze') await snoozeOccurrence(occId, body?.durationMinutes || 10);
      else if (action === 'postpone') await postponeOccurrence(occId, { minutes: body?.minutes });
      toast.success(
        action === 'complete' ? 'Meal completed!' :
        action === 'skip' ? 'Meal skipped' :
        action === 'snooze' ? 'Snoozed' : 'Postponed'
      );
      setModalState(null);
      loadOccurrences(dateKey);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[occId]; return n; });
    }
  }

  async function handleDeleteMeal(id) {
    try {
      await deleteMeal(id);
      toast.success('Meal schedule deleted');
      setConfirmDelete(null);
      loadMeals();
      loadOccurrences(dateKey);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleTogglePause(id) {
    try {
      const updated = await toggleMealPause(id);
      setMeals((prev) => prev.map((m) => ((m.id || m._id) === id ? updated : m)));
      toast.success(updated.active ? 'Meal schedule resumed' : 'Meal schedule paused');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const filename = await downloadMealHistoryExport();
      toast.success(`Exported ${filename}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const sortedOcc = [...occurrences].sort((a, b) =>
    new Date(a.scheduledAt) - new Date(b.scheduledAt)
  );

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Meal Schedule</h1>
            <p className="page-subtitle">Manage your recurring meal routines</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={handleExport}
              disabled={exporting || loading}
              title="Download full meal history as CSV"
            >
              {exporting ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Download size={15} />}
              Export CSV
            </button>
            <button className="btn btn-primary" onClick={() => setModalState({ type: 'create' })}>
              <Plus size={15} /> Add Meal
            </button>
          </div>
        </div>

        {error && (
          <div className="error-box mb-4" role="alert">
            <AlertCircle size={16} className="error-box-icon" />
            <div>
              <span>{error}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { loadMeals(); loadOccurrences(dateKey); }} style={{ marginLeft: 8, padding: '2px 8px' }}>Retry</button>
            </div>
          </div>
        )}

        {/* View toggle */}
        <div className="tabs mb-4">
          <button
            className={`tab${view === 'schedule' ? ' active' : ''}`}
            onClick={() => setView('schedule')}
          >
            Today's Timeline
          </button>
          <button
            className={`tab${view === 'schedules' ? ' active' : ''}`}
            onClick={() => setView('schedules')}
          >
            All Meal Schedules ({meals.length})
          </button>
        </div>

        {view === 'schedule' ? (
          <DailyView
            dateKey={dateKey}
            currentDate={currentDate}
            dateOffset={dateOffset}
            setDateOffset={setDateOffset}
            occurrences={sortedOcc}
            loading={occLoading}
            onAction={handleMealAction}
            onOpenPostpone={(occId) => setModalState({ type: 'postpone', occId })}
            onOpenSnooze={(occId) => setModalState({ type: 'snooze', occId })}
            onOpenNotesAction={(occId, action) => setModalState({ type: 'notesAction', occId, action })}
            actionLoading={actionLoading}
          />
        ) : (
          <SchedulesView
            meals={meals}
            loading={loading}
            onEdit={(meal) => setModalState({ type: 'edit', meal })}
            onDelete={(meal) => setConfirmDelete(meal)}
            onTogglePause={handleTogglePause}
          />
        )}
      </div>

      {/* Meal Form modal */}
      {(modalState?.type === 'create' || modalState?.type === 'edit') && (
        <MealFormModal
          meal={modalState.meal}
          onClose={() => setModalState(null)}
          onSaved={() => {
            loadMeals();
            loadOccurrences(dateKey);
            setModalState(null);
          }}
          toast={toast}
        />
      )}

      {/* Postpone modal */}
      {modalState?.type === 'postpone' && (
        <PostponeModal
          occId={modalState.occId}
          onClose={() => setModalState(null)}
          onPostpone={(occId, body) => handleMealAction(occId, 'postpone', body)}
          loading={!!actionLoading[modalState.occId]}
        />
      )}

      {/* Snooze modal */}
      {modalState?.type === 'snooze' && (
        <SnoozeModal
          occId={modalState.occId}
          onClose={() => setModalState(null)}
          onSnooze={(occId, mins) => handleMealAction(occId, 'snooze', { durationMinutes: mins })}
          loading={!!actionLoading[modalState.occId]}
        />
      )}

      {/* Notes modal for complete/skip */}
      {modalState?.type === 'notesAction' && (
        <NotesActionModal
          occId={modalState.occId}
          action={modalState.action}
          onClose={() => setModalState(null)}
          onSubmit={(occId, notes) => handleMealAction(occId, modalState.action, { notes })}
          loading={!!actionLoading[modalState.occId]}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmDeleteModal
          mealName={confirmDelete.name}
          onConfirm={() => handleDeleteMeal(confirmDelete.id || confirmDelete._id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </AppLayout>
  );
}

// ---- Daily view ----
function DailyView({ dateKey, currentDate, dateOffset, setDateOffset, occurrences, loading, onAction, onOpenPostpone, onOpenSnooze, onOpenNotesAction, actionLoading }) {
  return (
    <div>
      {/* Date navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => setDateOffset((d) => d - 1)} aria-label="Previous day">
          <ChevronLeft size={18} />
        </button>
        <div style={{ fontWeight: 600, fontSize: 15, minWidth: 180, textAlign: 'center' }}>
          {dateOffset === 0 ? 'Today — ' : dateOffset === 1 ? 'Tomorrow — ' : dateOffset === -1 ? 'Yesterday — ' : ''}
          {format(currentDate, 'EEEE, MMM d')}
        </div>
        <button className="btn btn-ghost btn-icon" onClick={() => setDateOffset((d) => d + 1)} aria-label="Next day">
          <ChevronRight size={18} />
        </button>
        {dateOffset !== 0 && (
          <button className="btn btn-secondary btn-sm" onClick={() => setDateOffset(0)}>Today</button>
        )}
      </div>

      {loading ? (
        <div className="loading-center">
          <div className="spinner" />
        </div>
      ) : occurrences.length === 0 ? (
        <div className="empty-state">
          <Clock size={40} className="empty-state-icon" />
          <p className="empty-state-title">No meals scheduled for this day</p>
          <p className="empty-state-desc">Add a meal schedule to see occurrences here</p>
        </div>
      ) : (
        <div className="occurrence-list">
          {occurrences.map((occ) => {
            const occId = occ.id || occ._id;
            return (
              <OccurrenceCard
                key={occId}
                occ={occ}
                onAction={onAction}
                onOpenPostpone={onOpenPostpone}
                onOpenSnooze={onOpenSnooze}
                onOpenNotesAction={onOpenNotesAction}
                actionLoading={actionLoading}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function OccurrenceCard({ occ, onAction, onOpenPostpone, onOpenSnooze, onOpenNotesAction, actionLoading }) {
  const id = occ.id || occ._id;
  const name = occ.mealId?.name || 'Meal';
  const time = occ.scheduledAt ? format(new Date(occ.scheduledAt), 'h:mm a') : '';
  const postponedTime = occ.postponedUntil ? format(new Date(occ.postponedUntil), 'h:mm a') : null;
  const isPending = occ.status === 'pending' || occ.status === 'postponed';
  const isMissed = occ.status === 'missed';
  const busy = !!actionLoading[id];

  return (
    <div className="card card-sm" style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{name}</span>
            <span className={`badge badge-${occ.status}`}>{occ.status}</span>
            {occ.mealId?.category && occ.mealId.category !== 'custom' && (
              <span className="badge badge-active">{occ.mealId.category}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={11} /> {time}
            </span>
            {postponedTime && (
              <span style={{ fontSize: 12, color: 'var(--color-postponed)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <AlarmClock size={11} /> Postponed to {postponedTime}
              </span>
            )}
            {occ.notes && (
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                Note: {occ.notes}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isPending && (
            <>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => onAction(id, 'complete')}
                disabled={busy}
                title="Mark as completed"
              >
                {busy && actionLoading[id] === 'complete' ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <CheckCircle2 size={13} />}
                <span>Done</span>
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => onOpenNotesAction(id, 'complete')}
                disabled={busy}
                title="Complete with notes"
              >
                <MessageSquare size={13} />
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => onOpenSnooze(id)} disabled={busy} title="Snooze">
                <RotateCcw size={13} />
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => onOpenPostpone(id)} disabled={busy} title="Postpone">
                <AlarmClock size={13} />
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => onAction(id, 'skip')} disabled={busy} title="Skip">
                <SkipForward size={13} />
              </button>
            </>
          )}
          {isMissed && (
            <button className="btn btn-sm btn-secondary" onClick={() => onAction(id, 'complete')} disabled={busy} title="Record late">
              <CheckCircle2 size={13} /> Record
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Schedules view ----
function SchedulesView({ meals, loading, onEdit, onDelete, onTogglePause }) {
  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (meals.length === 0) {
    return (
      <div className="empty-state">
        <Clock size={40} className="empty-state-icon" />
        <p className="empty-state-title">No meal schedules yet</p>
        <p className="empty-state-desc">Add your first meal schedule to get started</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {meals.map((meal) => {
        const mealId = meal.id || meal._id;
        return (
          <div key={mealId} className="card card-sm" style={{ opacity: meal.active ? 1 : 0.65 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{meal.name}</span>
                  <span className={`badge badge-${meal.active ? 'active' : 'inactive'}`}>
                    {meal.active ? 'Active' : 'Paused'}
                  </span>
                  {meal.category && meal.category !== 'custom' && (
                    <span className="badge badge-active">{meal.category}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span><Clock size={11} style={{ display: 'inline', marginRight: 3 }} />{meal.time}</span>
                  <span>{DAYS.filter((_, i) => meal.weekdays.includes(i)).join(', ')}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onEdit(meal)} title="Edit" aria-label={`Edit ${meal.name}`}>
                  <Edit2 size={14} />
                </button>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onTogglePause(mealId)} title={meal.active ? 'Pause' : 'Resume'} aria-label={`${meal.active ? 'Pause' : 'Resume'} ${meal.name}`}>
                  {meal.active ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-missed)' }} onClick={() => onDelete(meal)} title="Delete" aria-label={`Delete ${meal.name}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Meal Form Modal ----
function MealFormModal({ meal, onClose, onSaved, toast }) {
  const isEdit = !!meal;
  const mealId = meal?.id || meal?._id;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(mealSchema),
    defaultValues: {
      name: meal?.name || '',
      time: meal?.time || '08:00',
      weekdays: meal?.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
      category: meal?.category || '',
      reminderEnabled: meal?.reminderEnabled ?? true,
      followUpEnabled: meal?.followUpEnabled ?? true,
    },
  });

  const selectedDays = watch('weekdays');

  function toggleDay(day) {
    const cur = selectedDays || [];
    setValue('weekdays', cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day]);
  }

  async function onSubmit(data) {
    try {
      if (isEdit) await updateMeal(mealId, data);
      else await createMeal(data);
      toast.success(isEdit ? 'Meal schedule updated' : 'Meal schedule created');
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="meal-modal-title">
      <div className="modal">
        <div className="modal-header">
          <h2 id="meal-modal-title" className="modal-title">{isEdit ? 'Edit Meal' : 'Add Meal Schedule'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label htmlFor="meal-name" className="form-label">Meal name <span className="required">*</span></label>
            <input id="meal-name" className={`form-input${errors.name ? ' error' : ''}`} placeholder="e.g. Breakfast, Lunch, Post-workout Snack" {...register('name')} />
            {errors.name && <span className="form-error">{errors.name.message}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label htmlFor="meal-time" className="form-label">Time (24h HH:mm) <span className="required">*</span></label>
              <input id="meal-time" type="time" className={`form-input${errors.time ? ' error' : ''}`} {...register('time')} />
              {errors.time && <span className="form-error">{errors.time.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="meal-category" className="form-label">Category</label>
              <select id="meal-category" className="form-select" {...register('category')}>
                <option value="">Select category...</option>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Repeat on days <span className="required">*</span></label>
            <div className="weekday-grid">
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  className={`weekday-btn${selectedDays?.includes(i) ? ' selected' : ''}`}
                  onClick={() => toggleDay(i)}
                  aria-pressed={selectedDays?.includes(i)}
                  aria-label={d}
                >
                  {d[0]}
                </button>
              ))}
            </div>
            {errors.weekdays && <span className="form-error">{errors.weekdays.message}</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--color-text-2)' }}>
              <input type="checkbox" {...register('reminderEnabled')} />
              Enable reminder before meal
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--color-text-2)' }}>
              <input type="checkbox" {...register('followUpEnabled')} />
              Enable follow-up prompt
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : null}
              {isEdit ? 'Save changes' : 'Add meal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Postpone Modal ----
function PostponeModal({ occId, onClose, onPostpone, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(postponeSchema),
    defaultValues: { minutes: 30 },
  });

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="postpone-title">
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 id="postpone-title" className="modal-title">Postpone meal</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Postpone this meal occurrence by minutes.
        </p>
        <form onSubmit={handleSubmit((d) => onPostpone(occId, d))} noValidate>
          <div className="form-group">
            <label htmlFor="postpone-mins" className="form-label">Minutes <span className="required">*</span></label>
            <input id="postpone-mins" type="number" min={5} max={1440} className={`form-input${errors.minutes ? ' error' : ''}`} {...register('minutes')} />
            {errors.minutes && <span className="form-error">{errors.minutes.message}</span>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <AlarmClock size={14} />}
              Postpone
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Snooze Modal ----
function SnoozeModal({ occId, onClose, onSnooze, loading }) {
  const [selected, setSelected] = useState(10);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="snooze-title">
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 id="snooze-title" className="modal-title">Snooze meal</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Remind me again in:
        </p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {SNOOZE_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              className={`btn${selected === m ? ' btn-primary' : ' btn-secondary'}`}
              onClick={() => setSelected(m)}
              aria-pressed={selected === m}
            >
              {m} min
            </button>
          ))}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={loading} onClick={() => onSnooze(occId, selected)}>
            {loading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <RotateCcw size={14} />}
            Snooze {selected} min
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Notes action modal ----
function NotesActionModal({ occId, action, onClose, onSubmit, loading }) {
  const [notes, setNotes] = useState('');

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 className="modal-title">{action === 'complete' ? 'Complete Meal' : 'Skip Meal'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          Add optional notes (e.g. what you ate, why you skipped):
        </p>
        <div className="form-group">
          <textarea
            className="form-textarea"
            placeholder="e.g. Had oatmeal with berries"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading}
            onClick={() => onSubmit(occId, notes)}
          >
            {loading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <CheckCircle2 size={14} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Confirm delete modal ----
function ConfirmDeleteModal({ mealName, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 id="delete-title" className="modal-title">Delete meal schedule</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginBottom: 20 }}>
          Are you sure you want to delete <strong>{mealName}</strong>? Historical occurrence records will be preserved in your database.
        </p>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
