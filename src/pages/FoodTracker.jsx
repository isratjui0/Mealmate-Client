import { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight, AlertCircle, Info, Download, ArrowLeft, ArrowRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppLayout from '../layouts/AppLayout.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  getFoods, createFood, updateFood, deleteFood, reorderFoods,
  getMonthlyTracking, updateTrackingCell, clearTrackingCell,
} from '../services/foodService.js';
import { downloadFoodTrackingExport } from '../services/exportService.js';
import { getErrorMessage } from '../services/api.js';

// Status cycle: blank → consumed → not_consumed → blank
const STATUS = { consumed: 'consumed', not_consumed: 'not_consumed' };
const DISPLAY = {
  consumed: { label: '✓', title: 'Consumed', cls: 'consumed' },
  not_consumed: { label: '✗', title: 'Not consumed', cls: 'not_consumed' },
  '': { label: '', title: 'Unrecorded — click to set status', cls: '' },
};

const foodSchema = z.object({
  name: z.string().min(1, 'Food name is required').max(100),
  category: z.string().optional(),
  description: z.string().max(300).optional(),
});

export default function FoodTrackerPage() {
  const toast = useToast();
  const [foods, setFoods] = useState([]);
  const [trackingMatrix, setTrackingMatrix] = useState({}); // { 'YYYY-MM-DD': { foodId: 'consumed'|'not_consumed' } }
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [savingCells, setSavingCells] = useState({}); // { 'YYYY-MM-DD_foodId': true }
  const [modalState, setModalState] = useState(null); // { type, food? }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [cellModalState, setCellModalState] = useState(null); // { date, foodId, currentStatus, notes }

  const monthKey = format(currentMonth, 'yyyy-MM');

  const load = useCallback(async (month) => {
    setLoading(true);
    setError('');
    const targetMonthStr = format(month || currentMonth, 'yyyy-MM');
    try {
      const [foodList, trackingData] = await Promise.all([
        getFoods(false),
        getMonthlyTracking(targetMonthStr),
      ]);

      // Normalize food list preferring trackingData.foods if present
      const rawFoods = (trackingData?.foods?.length ? trackingData.foods : foodList) || [];
      const activeFoods = rawFoods.filter((f) => f.active !== false);
      // Sort by columnOrder if present
      activeFoods.sort((a, b) => (a.columnOrder ?? 0) - (b.columnOrder ?? 0));
      setFoods(activeFoods);

      // Build matrix from trackingData
      const matrix = {};
      if (Array.isArray(trackingData?.days)) {
        for (const day of trackingData.days) {
          if (day.entries) {
            matrix[day.date] = { ...day.entries };
          }
        }
      } else if (trackingData?.trackingMatrix) {
        Object.assign(matrix, trackingData.trackingMatrix);
      } else if (Array.isArray(trackingData?.records)) {
        for (const rec of trackingData.records) {
          const d = rec.trackingDate || rec.date;
          if (!matrix[d]) matrix[d] = {};
          matrix[d][rec.foodId] = rec.status;
        }
      }
      setTrackingMatrix(matrix);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    load(currentMonth);
  }, [load, currentMonth]);

  // Generate all days in the current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  function getCellStatus(dateStr, foodId) {
    const val = trackingMatrix[dateStr]?.[foodId];
    return val === null || val === undefined ? '' : val;
  }

  async function handleCellAction(dateStr, foodId, newStatus, notes = '') {
    const key = `${dateStr}_${foodId}`;
    setSavingCells((p) => ({ ...p, [key]: true }));

    // Optimistic update
    const prev = trackingMatrix[dateStr]?.[foodId] ?? '';
    setTrackingMatrix((m) => ({
      ...m,
      [dateStr]: { ...(m[dateStr] || {}), [foodId]: newStatus || null },
    }));

    try {
      if (newStatus === '') {
        // Clear cell to unrecorded
        await clearTrackingCell(dateStr, foodId);
        setTrackingMatrix((m) => {
          const day = { ...(m[dateStr] || {}) };
          delete day[foodId];
          return { ...m, [dateStr]: day };
        });
      } else {
        await updateTrackingCell(dateStr, foodId, newStatus, notes);
      }
    } catch (err) {
      // Rollback
      toast.error(getErrorMessage(err));
      setTrackingMatrix((m) => ({
        ...m,
        [dateStr]: { ...(m[dateStr] || {}), [foodId]: prev },
      }));
    } finally {
      setSavingCells((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
    }
    setCellModalState(null);
  }

  function openCellModal(dateStr, foodId) {
    const cur = getCellStatus(dateStr, foodId);
    setCellModalState({ date: dateStr, foodId, currentStatus: cur });
  }

  async function handleDeleteFood(id) {
    try {
      const res = await deleteFood(id);
      if (res?.archived) {
        toast.success('Food archived to preserve your past logs.');
      } else {
        toast.success('Food removed successfully.');
      }
      setConfirmDelete(null);
      load(currentMonth);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function handleMoveColumn(index, direction) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= foods.length) return;

    const newFoods = [...foods];
    const [moved] = newFoods.splice(index, 1);
    newFoods.splice(targetIdx, 0, moved);
    setFoods(newFoods);

    const foodIds = newFoods.map((f) => f.id || f._id);
    try {
      await reorderFoods({ foodIds });
      toast.success('Food column order updated');
    } catch (err) {
      toast.error(getErrorMessage(err));
      load(currentMonth);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const startStr = format(monthStart, 'yyyy-MM-dd');
      const endStr = format(monthEnd, 'yyyy-MM-dd');
      const filename = await downloadFoodTrackingExport({ startDate: startStr, endDate: endStr });
      toast.success(`Exported ${filename}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Food Tracker</h1>
            <p className="page-subtitle">Track your daily food consumption</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={handleExport}
              disabled={exporting || loading}
              title="Download month tracking as CSV"
            >
              {exporting ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Download size={15} />}
              Export CSV
            </button>
            <button className="btn btn-primary" onClick={() => setModalState({ type: 'create' })}>
              <Plus size={15} /> Add Food
            </button>
          </div>
        </div>

        {error && (
          <div className="error-box mb-4" role="alert">
            <AlertCircle size={16} className="error-box-icon" />
            <div>
              <span>{error}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => load(currentMonth)} style={{ marginLeft: 8, padding: '2px 8px' }}>Retry</button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Info size={12} /> Legend:
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-consumed)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <strong>✓</strong> Consumed
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-not-consumed)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <strong>✗</strong> Not consumed
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <strong style={{ fontSize: 14, lineHeight: 1 }}>·</strong> Unrecorded
          </span>
        </div>

        {/* Month navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setCurrentMonth((m) => subMonths(m, 1))} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <div style={{ fontWeight: 600, fontSize: 15, minWidth: 130, textAlign: 'center' }}>
            {format(currentMonth, 'MMMM yyyy')}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={() => setCurrentMonth((m) => addMonths(m, 1))} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
          {monthKey !== format(new Date(), 'yyyy-MM') && (
            <button className="btn btn-secondary btn-sm" onClick={() => setCurrentMonth(new Date())}>Current Month</button>
          )}
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : foods.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ fontSize: 40 }}>🥗</div>
            <p className="empty-state-title">No foods added yet</p>
            <p className="empty-state-desc">Add your first food to start tracking your daily consumption</p>
            <button className="btn btn-primary" onClick={() => setModalState({ type: 'create' })}>
              <Plus size={14} /> Add Food
            </button>
          </div>
        ) : (
          <TrackerTable
            foods={foods}
            days={days}
            getCellStatus={getCellStatus}
            savingCells={savingCells}
            onCellClick={openCellModal}
            onEditFood={(food) => setModalState({ type: 'edit', food })}
            onDeleteFood={(food) => setConfirmDelete(food)}
            onMoveColumn={handleMoveColumn}
          />
        )}
      </div>

      {/* Food form modal */}
      {(modalState?.type === 'create' || modalState?.type === 'edit') && (
        <FoodFormModal
          food={modalState.food}
          onClose={() => setModalState(null)}
          onSaved={() => { load(currentMonth); setModalState(null); }}
          toast={toast}
        />
      )}

      {/* Cell status modal */}
      {cellModalState && (
        <CellStatusModal
          date={cellModalState.date}
          foodId={cellModalState.foodId}
          currentStatus={cellModalState.currentStatus}
          foodName={foods.find((f) => (f.id || f._id) === cellModalState.foodId)?.name || 'Food'}
          onSet={(status, notes) => handleCellAction(cellModalState.date, cellModalState.foodId, status, notes)}
          onClose={() => setCellModalState(null)}
        />
      )}

      {/* Confirm delete food */}
      {confirmDelete && (
        <ConfirmDeleteFoodModal
          foodName={confirmDelete.name}
          onConfirm={() => handleDeleteFood(confirmDelete.id || confirmDelete._id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </AppLayout>
  );
}

// ---- Spreadsheet table ----
function TrackerTable({ foods, days, getCellStatus, savingCells, onCellClick, onEditFood, onDeleteFood, onMoveColumn }) {
  return (
    <div className="tracker-scroll">
      <table className="tracker-table" aria-label="Food tracking spreadsheet">
        <thead>
          <tr>
            <th className="date-col" scope="col">Date</th>
            {foods.map((food, idx) => {
              const foodId = food.id || food._id;
              return (
                <th key={foodId} scope="col">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      {idx > 0 && (
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ padding: '1px', width: 16, height: 16, minWidth: 'unset' }}
                          onClick={() => onMoveColumn(idx, -1)}
                          title="Move left"
                          aria-label={`Move ${food.name} left`}
                        >
                          <ArrowLeft size={10} />
                        </button>
                      )}
                      <span style={{ fontWeight: 600 }}>{food.name}</span>
                      {idx < foods.length - 1 && (
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ padding: '1px', width: 16, height: 16, minWidth: 'unset' }}
                          onClick={() => onMoveColumn(idx, 1)}
                          title="Move right"
                          aria-label={`Move ${food.name} right`}
                        >
                          <ArrowRight size={10} />
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '2px', width: 18, height: 18, minWidth: 'unset' }}
                        onClick={() => onEditFood(food)}
                        title={`Edit ${food.name}`}
                        aria-label={`Edit ${food.name}`}
                      >
                        <Edit2 size={10} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ padding: '2px', width: 18, height: 18, minWidth: 'unset', color: 'var(--color-missed)' }}
                        onClick={() => onDeleteFood(food)}
                        title={`Remove ${food.name}`}
                        aria-label={`Remove ${food.name}`}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
            return (
              <tr key={dateStr} style={isToday ? { background: 'var(--color-primary-50)' } : {}}>
                <td className="date-cell" style={isToday ? { background: 'var(--color-primary-50)', color: 'var(--color-primary)', fontWeight: 700 } : {}}>
                  <span style={{ fontSize: 11, color: 'inherit' }}>{format(day, 'EEE')}</span><br />
                  <span>{format(day, 'MMM d')}</span>
                </td>
                {foods.map((food) => {
                  const foodId = food.id || food._id;
                  const status = getCellStatus(dateStr, foodId);
                  const cellKey = `${dateStr}_${foodId}`;
                  const isSaving = !!savingCells[cellKey];
                  const disp = DISPLAY[status] || DISPLAY[''];

                  return (
                    <td key={foodId} style={{ textAlign: 'center' }}>
                      <button
                        className={`tracker-cell-btn${status ? ` ${status}` : ''}${isSaving ? ' saving' : ''}`}
                        onClick={() => !isSaving && onCellClick(dateStr, foodId)}
                        disabled={isSaving}
                        title={disp.title}
                        aria-label={`${food.name} on ${dateStr}: ${disp.title}`}
                        aria-pressed={status === STATUS.consumed}
                      >
                        {isSaving ? (
                          <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                        ) : (
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{disp.label}</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- Cell status modal ----
function CellStatusModal({ date, foodId, currentStatus, foodName, onSet, onClose }) {
  const [notes, setNotes] = useState('');

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cell-modal-title">
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 id="cell-modal-title" className="modal-title">Record — {foodName}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6 }}>
          {date} — Select status:
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button
            className={`btn btn-lg${currentStatus === 'consumed' ? ' btn-primary' : ' btn-secondary'}`}
            style={{ flex: 1, color: currentStatus === 'consumed' ? 'white' : 'var(--color-consumed)', borderColor: 'var(--color-consumed)', background: currentStatus === 'consumed' ? 'var(--color-consumed)' : 'var(--color-consumed-bg)' }}
            onClick={() => onSet(currentStatus === 'consumed' ? '' : 'consumed', notes)}
          >
            ✓ Consumed
          </button>
          <button
            className={`btn btn-lg${currentStatus === 'not_consumed' ? ' btn-danger' : ' btn-secondary'}`}
            style={{ flex: 1, color: currentStatus === 'not_consumed' ? 'white' : 'var(--color-not-consumed)', borderColor: 'var(--color-not-consumed)', background: currentStatus === 'not_consumed' ? 'var(--color-not-consumed)' : 'var(--color-not-consumed-bg)' }}
            onClick={() => onSet(currentStatus === 'not_consumed' ? '' : 'not_consumed', notes)}
          >
            ✗ Not consumed
          </button>
        </div>
        <div className="form-group" style={{ marginTop: 16 }}>
          <label htmlFor="cell-notes" className="form-label" style={{ fontSize: 12 }}>Optional notes</label>
          <input
            id="cell-notes"
            type="text"
            className="form-input form-input-sm"
            placeholder="e.g. 2 slices, with dinner"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {currentStatus && (
          <div style={{ marginTop: 8, textAlign: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onSet('', '')}>
              Clear (set unrecorded)
            </button>
          </div>
        )}
        <div className="modal-footer" style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---- Food form modal ----
function FoodFormModal({ food, onClose, onSaved, toast }) {
  const isEdit = !!food;
  const foodId = food?.id || food?._id;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(foodSchema),
    defaultValues: { name: food?.name || '', category: food?.category || '', description: food?.description || '' },
  });

  async function onSubmit(data) {
    try {
      if (isEdit) await updateFood(foodId, data);
      else await createFood(data);
      toast.success(isEdit ? 'Food updated' : 'Food added');
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="food-modal-title">
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 id="food-modal-title" className="modal-title">{isEdit ? 'Edit Food' : 'Add Food'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label htmlFor="food-name" className="form-label">Food name <span className="required">*</span></label>
            <input id="food-name" className={`form-input${errors.name ? ' error' : ''}`} placeholder="e.g. Rice, Egg, Fish" {...register('name')} />
            {errors.name && <span className="form-error">{errors.name.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="food-category" className="form-label">Category</label>
            <input id="food-category" className="form-input" placeholder="e.g. Grain, Protein, Fruit" {...register('category')} />
          </div>
          <div className="form-group">
            <label htmlFor="food-desc" className="form-label">Notes</label>
            <textarea id="food-desc" className="form-textarea" placeholder="Optional notes" {...register('description')} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : null}
              {isEdit ? 'Save changes' : 'Add food'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDeleteFoodModal({ foodName, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="del-food-title">
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 id="del-food-title" className="modal-title">Remove food</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginBottom: 20 }}>
          Remove <strong>{foodName}</strong> from your tracker? Historical tracking records are preserved in the database.
        </p>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}><Trash2 size={14} /> Remove</button>
        </div>
      </div>
    </div>
  );
}
