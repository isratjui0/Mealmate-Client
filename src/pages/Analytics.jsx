import { useState, useEffect, useCallback } from 'react';
import { format, subDays, subMonths, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { AlertCircle, TrendingUp, CalendarDays, Pill, Grid3X3, Download, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import AppLayout from '../layouts/AppLayout.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  getMealAnalytics, getDoseAnalytics, getFoodAnalytics, getDashboard, getCalendarAnalytics,
} from '../services/analyticsService.js';
import {
  downloadMealHistoryExport, downloadDoseHistoryExport, downloadFoodTrackingExport,
} from '../services/exportService.js';
import { getErrorMessage } from '../services/api.js';

const COLORS = {
  completed: '#2d7d46',
  skipped: '#6b7280',
  missed: '#dc2626',
  pending: '#b45309',
  taken: '#2d7d46',
  consumed: '#2d7d46',
  not_consumed: '#dc2626',
};

const PIE_COLORS = ['#2d7d46', '#6b7280', '#dc2626', '#b45309', '#7c3aed'];

const RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

function getDateRange(days) {
  const end = new Date();
  const start = subDays(end, days - 1);
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  };
}

export default function AnalyticsPage() {
  const toast = useToast();
  const [tab, setTab] = useState('meals');
  const [range, setRange] = useState(14);
  const [mealData, setMealData] = useState(null);
  const [doseData, setDoseData] = useState(null);
  const [foodData, setFoodData] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarData, setCalendarData] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const { startDate, endDate } = getDateRange(range);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [m, d, f, db] = await Promise.all([
        getMealAnalytics({ startDate, endDate }),
        getDoseAnalytics({ startDate, endDate }),
        getFoodAnalytics({ startDate, endDate }),
        getDashboard(),
      ]);
      setMealData(m);
      setDoseData(d);
      setFoodData(f);
      setDashboard(db);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const loadCalendar = useCallback(async (monthDate) => {
    try {
      const monthStr = format(monthDate, 'yyyy-MM');
      const res = await getCalendarAnalytics(monthStr);
      setCalendarData(res);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'calendar') {
      loadCalendar(calendarMonth);
    }
  }, [tab, calendarMonth, loadCalendar]);

  async function handleExport() {
    setExporting(true);
    try {
      let filename = '';
      if (tab === 'meals') {
        filename = await downloadMealHistoryExport({ startDate, endDate });
      } else if (tab === 'doses') {
        filename = await downloadDoseHistoryExport({ startDate, endDate });
      } else if (tab === 'foods') {
        filename = await downloadFoodTrackingExport({ startDate, endDate });
      } else {
        filename = await downloadMealHistoryExport({ startDate, endDate });
      }
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
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">Review your routine trends & adherence</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {tab !== 'calendar' && (
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: 150 }}
                value={range}
                onChange={(e) => setRange(Number(e.target.value))}
                aria-label="Select date range"
              >
                {RANGES.map((r) => (
                  <option key={r.days} value={r.days}>{r.label}</option>
                ))}
              </select>
            )}
            <button
              className="btn btn-secondary"
              onClick={handleExport}
              disabled={exporting || loading}
              title={`Export ${tab} CSV`}
            >
              {exporting ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Download size={15} />}
              Export CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="error-box mb-4" role="alert">
            <AlertCircle size={16} className="error-box-icon" />
            <div>
              <span>{error}</span>
              <button className="btn btn-ghost btn-sm" onClick={load} style={{ marginLeft: 8, padding: '2px 8px' }}>Retry</button>
            </div>
          </div>
        )}

        {/* Today snapshot */}
        {dashboard && (
          <div className="stat-grid mb-6">
            <div className="stat-card">
              <div className="stat-label">Today — Meal Rate</div>
              <div className="stat-value" style={{ color: 'var(--color-primary)' }}>{dashboard.meals?.completionRate ?? 0}%</div>
              <div className="stat-sublabel">{dashboard.meals?.completed ?? 0}/{dashboard.meals?.total ?? 0} completed</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Today — Dose Rate</div>
              <div className="stat-value" style={{ color: 'var(--color-postponed)' }}>{dashboard.doses?.adherenceRate ?? 0}%</div>
              <div className="stat-sublabel">{dashboard.doses?.taken ?? 0}/{dashboard.doses?.total ?? 0} taken</div>
            </div>
            {mealData && (
              <div className="stat-card">
                <div className="stat-label">Period — Meal Rate</div>
                <div className="stat-value" style={{ color: 'var(--color-completed)' }}>{mealData.completionRate ?? 0}%</div>
                <div className="stat-sublabel">{mealData.completed ?? 0}/{mealData.totalOccurrences ?? 0}</div>
              </div>
            )}
            {doseData && (
              <div className="stat-card">
                <div className="stat-label">Period — Dose Rate</div>
                <div className="stat-value" style={{ color: 'var(--color-postponed)' }}>{doseData.adherenceRate ?? 0}%</div>
                <div className="stat-sublabel">{doseData.taken ?? 0}/{doseData.totalOccurrences ?? 0}</div>
              </div>
            )}
          </div>
        )}

        <div className="tabs mb-4">
          <button className={`tab${tab === 'meals' ? ' active' : ''}`} onClick={() => setTab('meals')}>
            <CalendarDays size={13} style={{ display: 'inline', marginRight: 4 }} />Meals
          </button>
          <button className={`tab${tab === 'doses' ? ' active' : ''}`} onClick={() => setTab('doses')}>
            <Pill size={13} style={{ display: 'inline', marginRight: 4 }} />Doses
          </button>
          <button className={`tab${tab === 'foods' ? ' active' : ''}`} onClick={() => setTab('foods')}>
            <Grid3X3 size={13} style={{ display: 'inline', marginRight: 4 }} />Foods
          </button>
          <button className={`tab${tab === 'calendar' ? ' active' : ''}`} onClick={() => setTab('calendar')}>
            <CalendarIcon size={13} style={{ display: 'inline', marginRight: 4 }} />Calendar Routine Heatmap
          </button>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner spinner-lg" /></div>
        ) : (
          <>
            {tab === 'meals' && mealData && <MealsAnalytics data={mealData} />}
            {tab === 'doses' && doseData && <DosesAnalytics data={doseData} />}
            {tab === 'foods' && foodData && <FoodsAnalytics data={foodData} />}
            {tab === 'calendar' && (
              <CalendarHeatmapView
                month={calendarMonth}
                setMonth={setCalendarMonth}
                data={calendarData}
              />
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

// ---- Meals analytics ----
function MealsAnalytics({ data }) {
  const dailyData = data.dailyBreakdown || [];
  const pieData = [
    { name: 'Completed', value: data.completed },
    { name: 'Skipped', value: data.skipped },
    { name: 'Missed', value: data.missed },
    { name: 'Pending', value: data.pending },
  ].filter((d) => d.value > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {data.totalOccurrences === 0 ? (
        <div className="empty-state">
          <TrendingUp size={40} className="empty-state-icon" />
          <p className="empty-state-title">No meal data for this period</p>
        </div>
      ) : (
        <>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 16 }}>Daily Meal Completion</h3>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => format(new Date(v + 'T00:00'), 'MMM d')} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(val, name) => [val, name]}
                    labelFormatter={(v) => format(new Date(v + 'T00:00'), 'EEEE, MMM d')}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="completed" fill={COLORS.completed} name="Completed" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="skipped" fill={COLORS.skipped} name="Skipped" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="missed" fill={COLORS.missed} name="Missed" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="text-muted text-sm" style={{ textAlign: 'center', padding: 20 }}>No daily data</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16 }}>Status Breakdown</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16 }}>Summary</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SummaryRow label="Total scheduled" value={data.totalOccurrences} />
                <SummaryRow label="Completed" value={data.completed} color={COLORS.completed} />
                <SummaryRow label="Skipped" value={data.skipped} color={COLORS.skipped} />
                <SummaryRow label="Missed" value={data.missed} color={COLORS.missed} />
                <SummaryRow label="Completion rate" value={`${data.completionRate}%`} color={COLORS.completed} bold />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Doses analytics ----
function DosesAnalytics({ data }) {
  const itemData = data.itemBreakdown || [];
  const pieData = [
    { name: 'Taken', value: data.taken },
    { name: 'Skipped', value: data.skipped },
    { name: 'Missed', value: data.missed },
  ].filter((d) => d.value > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {data.totalOccurrences === 0 ? (
        <div className="empty-state">
          <Pill size={40} className="empty-state-icon" />
          <p className="empty-state-title">No dose data for this period</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16 }}>Status Breakdown</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16 }}>Summary</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SummaryRow label="Total scheduled" value={data.totalOccurrences} />
                <SummaryRow label="Taken" value={data.taken} color={COLORS.taken} />
                <SummaryRow label="Skipped" value={data.skipped} color={COLORS.skipped} />
                <SummaryRow label="Missed" value={data.missed} color={COLORS.missed} />
                <SummaryRow label="Adherence rate" value={`${data.adherenceRate}%`} color={COLORS.taken} bold />
              </div>
            </div>
          </div>
          {itemData.length > 0 && (
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16 }}>By Item</h3>
              <ResponsiveContainer width="100%" height={Math.max(160, itemData.length * 50)}>
                <BarChart data={itemData} layout="vertical" margin={{ top: 4, right: 16, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="itemName" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="taken" fill={COLORS.taken} name="Taken" />
                  <Bar dataKey="skipped" fill={COLORS.skipped} name="Skipped" />
                  <Bar dataKey="missed" fill={COLORS.missed} name="Missed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---- Foods analytics ----
function FoodsAnalytics({ data }) {
  const items = data?.foods || data?.items || data?.summary || [];
  if (!items.length) {
    return (
      <div className="empty-state">
        <Grid3X3 size={40} className="empty-state-icon" />
        <p className="empty-state-title">No food tracking data for this period</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 16 }}>Food Consumption Frequency</h3>
      <ResponsiveContainer width="100%" height={Math.max(200, items.length * 40)}>
        <BarChart data={items} layout="vertical" margin={{ top: 4, right: 16, left: 80, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="consumed" fill={COLORS.consumed} name="Consumed" />
          <Bar dataKey="notConsumed" fill={COLORS.not_consumed} name="Not consumed" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---- Calendar Heatmap View ----
function CalendarHeatmapView({ month, setMonth, data }) {
  const days = data?.days || data?.calendar || [];

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarIcon size={18} color="var(--color-primary)" />
          Monthly Routine Matrix
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{format(month, 'MMMM yyyy')}</span>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {!days.length ? (
        <div className="empty-state">
          <CalendarIcon size={32} className="empty-state-icon" />
          <p className="empty-state-title">No routine events recorded for {format(month, 'MMMM yyyy')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
          {days.map((day) => {
            const dateStr = day.date || day.day;
            const mealRate = day.meals?.completionRate ?? (day.meals?.completed && day.meals?.total ? Math.round((day.meals.completed / day.meals.total) * 100) : null);
            const doseRate = day.doses?.adherenceRate ?? (day.doses?.taken && day.doses?.total ? Math.round((day.doses.taken / day.doses.total) * 100) : null);
            const foodLogged = day.foodTracking?.consumed ?? day.foodsConsumed ?? null;

            return (
              <div
                key={dateStr}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  background: 'var(--color-bg-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
                  {format(new Date(dateStr + 'T00:00'), 'MMM d, EEE')}
                </div>
                {mealRate !== null ? (
                  <div style={{ fontSize: 11, color: 'var(--color-primary)' }}>
                    🍽 Meals: <strong>{mealRate}%</strong>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>🍽 Meals: —</div>
                )}
                {doseRate !== null ? (
                  <div style={{ fontSize: 11, color: 'var(--color-postponed)' }}>
                    💊 Doses: <strong>{doseRate}%</strong>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>💊 Doses: —</div>
                )}
                {foodLogged !== null && (
                  <div style={{ fontSize: 11, color: 'var(--color-completed)' }}>
                    🥗 Consumed: <strong>{foodLogged}</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: color || 'var(--color-text)' }}>{value}</span>
    </div>
  );
}
