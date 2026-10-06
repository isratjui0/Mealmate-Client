import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Plus, Edit2, Trash2, Pause, Play, Clock, CheckCircle2,
  SkipForward, AlarmClock, AlertCircle, ChevronLeft, ChevronRight, Pill, Download, MessageSquare,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppLayout from '../layouts/AppLayout.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  getDoses, createDose, updateDose, deleteDose, toggleDosePause,
  getDoseOccurrences, markDoseTaken, markDoseSkipped, postponeDose,
} from '../services/doseService.js';
import { downloadDoseHistoryExport } from '../services/exportService.js';
import { getErrorMessage } from '../services/api.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const isHHmm = (v) => /^\d{2}:\d{2}$/.test(v);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);

const doseSchema = z.object({
  itemName: z.string().min(1, 'Item name is required').max(100),
  dosageDescription: z.string().min(1, 'Dosage description is required').max(200),
  times: z.string().min(1, 'At least one time is required'),
  weekdays: z.array(z.number()).min(1, 'Select at least one day'),
  startDate: z.string().refine(isDate, 'Enter a valid date (YYYY-MM-DD)'),
  endDate: z.string().optional(),
  reminderEnabled: z.boolean().optional(),
});

const postponeSchema = z.object({
  minutes: z.coerce.number().int().min(5).max(1440),
  notes: z.string().optional(),
});

export default function DoseTrackerPage() {
  const toast = useToast();
  const [doses, setDoses] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [occLoading, setOccLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('schedule');
  const [dateOffset, setDateOffset] = useState(0);
  const [modalState, setModalState] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [postponeModal, setPostponeModal] = useState(null);

  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() + dateOffset);
  const dateKey = format(currentDate, 'yyyy-MM-dd');

  const loadDoses = useCallback(async () => {
    try {
      const d = await getDoses();
      setDoses(d || []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  const loadOccurrences = useCallback(async (dk) => {
    setOccLoading(true);
    try {
      const o = await getDoseOccurrences({ date: dk });
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
      await loadDoses();
      await loadOccurrences(dateKey);
      setLoading(false);
    })();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!loading) loadOccurrences(dateKey);
  }, [dateKey]); // eslint-disable-line

  async function handleOccAction(occId, action, body) {
    setActionLoading((p) => ({ ...p, [occId]: action }));
    try {
      if (action === 'taken') await markDoseTaken(occId, body?.notes);
      else if (action === 'skip') await markDoseSkipped(occId, body?.notes);
      else if (action === 'postpone') await postponeDose(occId, { minutes: body?.minutes, notes: body?.notes });
      toast.success(
        action === 'taken' ? 'Dose marked as taken' :
        action === 'skip' ? 'Dose skipped' : 'Dose postponed'
      );
      setPostponeModal(null);
      setModalState(null);
      loadOccurrences(dateKey);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[occId]; return n; });
    }
  }

  async function handleDeleteDose(id) {
    try {
      await deleteDose(id);
      toast.success('Dose schedule deleted');
      setConfirmDelete(null);
      loadDoses();
      loadOccurrences(dateKey);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleTogglePause(id) {
    try {
      const updated = await toggleDosePause(id);
      setDoses((prev) => prev.map((d) => ((d.id || d._id) === id ? updated : d)));
      toast.success(updated.active ? 'Dose schedule resumed' : 'Dose schedule paused');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const filename = await downloadDoseHistoryExport();
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
            <h1 className="page-title">Dose Tracker</h1>
            <p className="page-subtitle">Track your medications and supplements</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={handleExport}
              disabled={exporting || loading}
              title="Download dose history as CSV"
            >
              {exporting ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Download size={15} />}
              Export CSV
            </button>
            <button className="btn btn-primary" onClick={() => setModalState({ type: 'create' })}>
              <Plus size={15} /> Add Dose
            </button>
          </div>
        </div>

        {error && (
          <div className="error-box mb-4" role="alert">
            <AlertCircle size={16} className="error-box-icon" />
            <div>
              <span>{error}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { loadDoses(); loadOccurrences(dateKey); }} style={{ marginLeft: 8, padding: '2px 8px' }}>Retry</button>
            </div>
          </div>
        )}

        <div className="tabs mb-4">
          <button className={`tab${view === 'schedule' ? ' active' : ''}`} onClick={() => setView('schedule')}>
            Today's Doses
          </button>
          <button className={`tab${view === 'schedules' ? ' active' : ''}`} onClick={() => setView('schedules')}>
            All Schedules ({doses.length})
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
            onAction={handleOccAction}
            onOpenPostpone={(occId) => setPostponeModal(occId)}
            onOpenNotesAction={(occId, action) => setModalState({ type: 'notesAction', occId, action })}
            actionLoading={actionLoading}
          />
        ) : (
          <SchedulesView
            doses={doses}
            loading={loading}
            onEdit={(dose) => setModalState({ type: 'edit', dose })}
            onDelete={(dose) => setConfirmDelete(dose)}
            onTogglePause={handleTogglePause}
          />
        )}
      </div>

      {(modalState?.type === 'create' || modalState?.type === 'edit') && (
        <DoseFormModal
          dose={modalState.dose}
          onClose={() => setModalState(null)}
          onSaved={() => {
            loadDoses();
            loadOccurrences(dateKey);
            setModalState(null);
          }}
          toast={toast}
        />
      )}

      {modalState?.type === 'notesAction' && (
        <DoseNotesModal
          occId={modalState.occId}
          action={modalState.action}
          onClose={() => setModalState(null)}
          onSubmit={(occId, notes) => handleOccAction(occId, modalState.action, { notes })}
          loading={!!actionLoading[modalState.occId]}
        />
      )}

      {postponeModal && (
        <PostponeModal
          occId={postponeModal}
          onClose={() => setPostponeModal(null)}
          onPostpone={(occId, body) => handleOccAction(occId, 'postpone', body)}
          loading={!!actionLoading[postponeModal]}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          itemName={confirmDelete.itemName}
          onConfirm={() => handleDeleteDose(confirmDelete.id || confirmDelete._id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </AppLayout>
  );
}

function DailyView({ dateKey, currentDate, dateOffset, setDateOffset, occurrences, loading, onAction, onOpenPostpone, onOpenNotesAction, actionLoading }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => setDateOffset((d) => d - 1)} aria-label="Previous day"><ChevronLeft size={18} /></button>
        <div style={{ fontWeight: 600, fontSize: 15, minWidth: 180, textAlign: 'center' }}>
          {dateOffset === 0 ? 'Today — ' : dateOffset === 1 ? 'Tomorrow — ' : dateOffset === -1 ? 'Yesterday — ' : ''}
          {format(currentDate, 'EEEE, MMM d')}
        </div>
        <button className="btn btn-ghost btn-icon" onClick={() => setDateOffset((d) => d + 1)} aria-label="Next day"><ChevronRight size={18} /></button>
        {dateOffset !== 0 && (
          <button className="btn btn-secondary btn-sm" onClick={() => setDateOffset(0)}>Today</button>
        )}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : occurrences.length === 0 ? (
        <div className="empty-state">
          <Pill size={40} className="empty-state-icon" />
          <p className="empty-state-title">No doses scheduled for this day</p>
          <p className="empty-state-desc">Add a medication schedule to track doses here</p>
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

function OccurrenceCard({ occ, onAction, onOpenPostpone, onOpenNotesAction, actionLoading }) {
  const id = occ.id || occ._id;
  const itemName = occ.doseScheduleId?.itemName || 'Dose';
  const dosage = occ.doseScheduleId?.dosageDescription || '';
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
            <Pill size={15} color="var(--color-postponed)" />
            <span style={{ fontWeight: 600, fontSize: 15 }}>{itemName}</span>
            {dosage && <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>({dosage})</span>}
            <span className={`badge badge-${occ.status === 'taken' ? 'completed' : occ.status}`}>{occ.status}</span>
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
                onClick={() => onAction(id, 'taken')}
                disabled={busy}
                title="Mark as taken"
              >
                {busy && actionLoading[id] === 'taken' ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <CheckCircle2 size={13} />}
                <span>Taken</span>
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => onOpenNotesAction(id, 'taken')}
                disabled={busy}
                title="Take with notes"
              >
                <MessageSquare size={13} />
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
            <button className="btn btn-sm btn-secondary" onClick={() => onAction(id, 'taken')} disabled={busy} title="Record late">
              <CheckCircle2 size={13} /> Record
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SchedulesView({ doses, loading, onEdit, onDelete, onTogglePause }) {
  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (doses.length === 0) {
    return (
      <div className="empty-state">
        <Pill size={40} className="empty-state-icon" />
        <p className="empty-state-title">No dose schedules yet</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {doses.map((dose) => {
        const doseId = dose.id || dose._id;
        return (
          <div key={doseId} className="card card-sm" style={{ opacity: dose.active ? 1 : 0.65 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Pill size={14} color="var(--color-postponed)" />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{dose.itemName}</span>
                  <span className={`badge badge-${dose.active ? 'active' : 'inactive'}`}>{dose.active ? 'Active' : 'Paused'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{dose.dosageDescription}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span><Clock size={11} style={{ display: 'inline', marginRight: 3 }} />{dose.times?.join(', ')}</span>
                  <span>{DAYS.filter((_, i) => dose.weekdays.includes(i)).join(', ')}</span>
                  {dose.startDate && <span>From: {dose.startDate}</span>}
                  {dose.endDate && <span>To: {dose.endDate}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onEdit(dose)} title="Edit" aria-label={`Edit ${dose.itemName}`}><Edit2 size={14} /></button>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onTogglePause(doseId)} title={dose.active ? 'Pause' : 'Resume'} aria-label={`${dose.active ? 'Pause' : 'Resume'} ${dose.itemName}`}>
                  {dose.active ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-missed)' }} onClick={() => onDelete(dose)} title="Delete" aria-label={`Delete ${dose.itemName}`}><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DoseFormModal({ dose, onClose, onSaved, toast }) {
  const isEdit = !!dose;
  const doseId = dose?.id || dose?._id;
  const today = format(new Date(), 'yyyy-MM-dd');

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(doseSchema),
    defaultValues: {
      itemName: dose?.itemName || '',
      dosageDescription: dose?.dosageDescription || '',
      times: dose?.times?.join(', ') || '08:00',
      weekdays: dose?.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
      startDate: dose?.startDate || today,
      endDate: dose?.endDate || '',
      reminderEnabled: dose?.reminderEnabled ?? true,
    },
  });

  const selectedDays = watch('weekdays');
  function toggleDay(day) {
    const cur = selectedDays || [];
    setValue('weekdays', cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day]);
  }

  async function onSubmit(data) {
    const times = data.times.split(',').map((t) => t.trim()).filter(Boolean);
    if (!times.every(isHHmm)) {
      toast.error('Times must be in HH:mm format (e.g. 08:00, 14:00)');
      return;
    }
    const payload = { ...data, times };
    if (!payload.endDate) delete payload.endDate;
    try {
      if (isEdit) await updateDose(doseId, payload);
      else await createDose(payload);
      toast.success(isEdit ? 'Dose schedule updated' : 'Dose schedule created');
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dose-modal-title">
      <div className="modal">
        <div className="modal-header">
          <h2 id="dose-modal-title" className="modal-title">{isEdit ? 'Edit Dose Schedule' : 'Add Dose Schedule'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label htmlFor="dose-name" className="form-label">Item name <span className="required">*</span></label>
            <input id="dose-name" className={`form-input${errors.itemName ? ' error' : ''}`} placeholder="e.g. Vitamin D, Metformin" {...register('itemName')} />
            {errors.itemName && <span className="form-error">{errors.itemName.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="dose-dosage" className="form-label">Dosage description <span className="required">*</span></label>
            <input id="dose-dosage" className={`form-input${errors.dosageDescription ? ' error' : ''}`} placeholder="e.g. 500mg, 1 tablet, 2 capsules" {...register('dosageDescription')} />
            {errors.dosageDescription && <span className="form-error">{errors.dosageDescription.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="dose-times" className="form-label">Times (HH:mm, comma-separated) <span className="required">*</span></label>
            <input id="dose-times" className={`form-input${errors.times ? ' error' : ''}`} placeholder="e.g. 08:00, 14:00, 20:00" {...register('times')} />
            <span className="form-hint">Use 24-hour format. Multiple times separated by commas.</span>
            {errors.times && <span className="form-error">{errors.times.message}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Repeat on days <span className="required">*</span></label>
            <div className="weekday-grid">
              {DAYS.map((d, i) => (
                <button key={i} type="button" className={`weekday-btn${selectedDays?.includes(i) ? ' selected' : ''}`} onClick={() => toggleDay(i)} aria-pressed={selectedDays?.includes(i)} aria-label={d}>
                  {d[0]}
                </button>
              ))}
            </div>
            {errors.weekdays && <span className="form-error">{errors.weekdays.message}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label htmlFor="dose-start" className="form-label">Start date <span className="required">*</span></label>
              <input id="dose-start" type="date" className={`form-input${errors.startDate ? ' error' : ''}`} {...register('startDate')} />
              {errors.startDate && <span className="form-error">{errors.startDate.message}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="dose-end" className="form-label">End date</label>
              <input id="dose-end" type="date" className="form-input" {...register('endDate')} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--color-text-2)', marginBottom: 16 }}>
            <input type="checkbox" {...register('reminderEnabled')} />
            Enable reminders
          </label>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : null}
              {isEdit ? 'Save changes' : 'Add dose'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PostponeModal({ occId, onClose, onPostpone, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(postponeSchema),
    defaultValues: { minutes: 30, notes: '' },
  });

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dose-postpone-title">
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 id="dose-postpone-title" className="modal-title">Postpone dose</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit((d) => onPostpone(occId, d))} noValidate>
          <div className="form-group">
            <label htmlFor="dose-postpone-mins" className="form-label">Minutes <span className="required">*</span></label>
            <input id="dose-postpone-mins" type="number" min={5} max={1440} className={`form-input${errors.minutes ? ' error' : ''}`} {...register('minutes')} />
            {errors.minutes && <span className="form-error">{errors.minutes.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="dose-postpone-notes" className="form-label">Optional notes</label>
            <input id="dose-postpone-notes" type="text" className="form-input" placeholder="e.g. Delaying until after lunch" {...register('notes')} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <AlarmClock size={14} />} Postpone
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DoseNotesModal({ occId, action, onClose, onSubmit, loading }) {
  const [notes, setNotes] = useState('');

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 className="modal-title">{action === 'taken' ? 'Record Dose' : 'Skip Dose'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          Add optional notes (e.g. taken with water, doctor advice):
        </p>
        <div className="form-group">
          <textarea
            className="form-textarea"
            placeholder="e.g. Taken with breakfast"
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

function ConfirmDeleteModal({ itemName, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 id="delete-title" className="modal-title">Delete dose schedule</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginBottom: 20 }}>
          Are you sure you want to delete <strong>{itemName}</strong>? Historical logs will be preserved in your database.
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
