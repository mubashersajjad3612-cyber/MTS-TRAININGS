import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  FileBarChart2,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import {
  AcademyDatabase,
  NavSection,
  PeriodFilter,
  UserAccount,
  UserRole,
} from '../types/academy';
import {
  computeBatchMetrics,
  computeFeeBalance,
  computeFeeStatus,
  formatCurrency,
  getPeriodBounds,
  isDateInRange,
} from '../utils/calculations';
import {
  canSeeFinancialMetrics,
  getTrainerDisplayName,
  getTrainerScopedBatches,
  getTrainerScopedStudents,
} from '../utils/permissions';

interface DashboardHomeProps {
  db: AcademyDatabase;
  userRole: UserRole;
  currentUser?: UserAccount | null;
  allowedSections: NavSection[];
  onNavigate: (section: NavSection) => void;
}

const PERIOD_OPTIONS: PeriodFilter[] = [
  'This Month',
  'Last Month',
  'This Year',
  'All Time',
  'Custom',
];

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  db,
  userRole,
  currentUser,
  allowedSections,
  onNavigate,
}) => {
  const showFinancials = canSeeFinancialMetrics(userRole);
  const isTrainer = userRole === 'Trainer';
  const trainerDisplayName = getTrainerDisplayName(currentUser);
  const [period, setPeriod] = useState<PeriodFilter>('This Year');
  const [customFrom, setCustomFrom] = useState('2026-01-01');
  const [customTo, setCustomTo] = useState('2026-12-31');
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  const bounds = useMemo(
    () => getPeriodBounds(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const visibleBatches = useMemo(
    () => getTrainerScopedBatches(db.batches, userRole, currentUser),
    [db.batches, userRole, currentUser]
  );

  const visibleStudents = useMemo(
    () => getTrainerScopedStudents(db.students, db.batches, userRole, currentUser),
    [db.students, db.batches, userRole, currentUser]
  );

  const visibleAttendance = useMemo(() => {
    if (!isTrainer) return db.attendance;
    const batchIds = new Set(visibleBatches.map((b) => b.id));
    const studentIds = new Set(visibleStudents.map((s) => s.id));
    return db.attendance.filter(
      (a) => batchIds.has(a.batchId) || studentIds.has(a.studentId)
    );
  }, [db.attendance, isTrainer, visibleBatches, visibleStudents]);

  const metrics = useMemo(() => {
    const currency = db.settings.currency || 'PKR';
    const totalStudents = visibleStudents.length;
    const activeStudents = visibleStudents.filter((s) => s.status === 'Active').length;
    const leftStudents = visibleStudents.filter((s) => s.status === 'Left').length;

    const periodStudents = visibleStudents.filter((s) =>
      isDateInRange(s.admissionDate, bounds.from, bounds.to)
    );

    const periodFees = db.fees.filter((f) => {
      const refDate = f.paymentDate || f.dueDate;
      return isDateInRange(refDate, bounds.from, bounds.to);
    });

    const totalFeeBilled = periodFees.reduce(
      (sum, f) => sum + Math.max(0, f.feeAmount - f.discount),
      0
    );
    const totalCollected = periodFees.reduce((sum, f) => sum + f.amountPaid, 0);
    const collectionRatePct =
      totalFeeBilled > 0
        ? Math.min(100, Math.round((totalCollected / totalFeeBilled) * 100))
        : 0;
    const outstandingFees = db.fees.reduce((sum, f) => sum + computeFeeBalance(f), 0);
    const overdueRecords = db.fees.filter((f) => computeFeeStatus(f) === 'Overdue').length;

    const periodExpenses = db.expenses.filter((e) =>
      isDateInRange(e.date, bounds.from, bounds.to)
    );
    const totalExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalCollected - totalExpenses;

    const periodAttendance = visibleAttendance.filter((a) =>
      isDateInRange(a.date, bounds.from, bounds.to)
    );
    const attSource = periodAttendance.length > 0 ? periodAttendance : visibleAttendance;
    const attPresent = attSource.filter(
      (a) => a.status === 'Present' || a.status === 'Late'
    ).length;
    const attendancePct =
      attSource.length > 0 ? Math.round((attPresent / attSource.length) * 100) : 100;

    const periodInquiries = db.inquiries.filter((i) =>
      isDateInRange(i.date, bounds.from, bounds.to)
    );

    return {
      currency,
      totalStudents,
      activeStudents,
      leftStudents,
      newAdmissionsInPeriod: periodStudents.length,
      totalFeeBilled,
      totalCollected,
      collectionRatePct,
      outstandingFees,
      overdueRecords,
      totalExpenses,
      netProfit,
      attendancePct,
      activeBatches: visibleBatches.length,
      totalInquiries: periodInquiries.length,
    };
  }, [db, bounds, visibleStudents, visibleBatches, visibleAttendance]);

  // Build monthly Fee Collection vs Expenses chart data (last 6 active months)
  const monthlySeries = useMemo(() => {
    const map = new Map<string, { label: string; collected: number; expenses: number }>();

    const ensureKey = (ym: string) => {
      if (!map.has(ym)) {
        const [y, m] = ym.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const idx = Math.max(0, Math.min(11, Number(m) - 1));
        map.set(ym, { label: `${monthNames[idx]} ${y.slice(2)}`, collected: 0, expenses: 0 });
      }
      return map.get(ym)!;
    };

    for (const f of db.fees) {
      const dt = f.paymentDate || f.dueDate;
      if (dt && dt.length >= 7) {
        const item = ensureKey(dt.slice(0, 7));
        item.collected += f.amountPaid;
      }
    }
    for (const e of db.expenses) {
      if (e.date && e.date.length >= 7) {
        const item = ensureKey(e.date.slice(0, 7));
        item.expenses += e.amount;
      }
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, val]) => ({ key, ...val }));
  }, [db.fees, db.expenses]);

  const maxChartVal = Math.max(
    10000,
    ...monthlySeries.flatMap((m) => [m.collected, m.expenses])
  );

  const overdueFeesList = useMemo(() => {
    return db.fees
      .filter((f) => computeFeeBalance(f) > 0)
      .sort((a, b) => computeFeeBalance(b) - computeFeeBalance(a))
      .slice(0, 5);
  }, [db.fees]);

  const recentInquiries = useMemo(() => {
    return [...db.inquiries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [db.inquiries]);

  const activeRetentionPct =
    metrics.totalStudents > 0
      ? Math.round((metrics.activeStudents / metrics.totalStudents) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Executive Welcome & Period Control Header */}
      <div className="os-card px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{userRole} Workspace</span>
              <span aria-hidden="true">·</span>
              <span>{db.settings.academyName}</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Welcome back, {currentUser?.name || trainerDisplayName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isTrainer && allowedSections.includes('attendance') && (
              <button
                type="button"
                onClick={() => onNavigate('attendance')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-sky-800 whitespace-nowrap shrink-0"
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                Mark Daily Attendance
              </button>
            )}
            {allowedSections.includes('inquiries') && (
              <button
                type="button"
                onClick={() => onNavigate('inquiries')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <UserPlus className="h-3.5 w-3.5 text-slate-500" />
                New Inquiry
              </button>
            )}
            {allowedSections.includes('fees') && (
              <button
                type="button"
                onClick={() => onNavigate('fees')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-sky-800 whitespace-nowrap shrink-0"
              >
                <Wallet className="h-3.5 w-3.5" />
                Collect Fee
              </button>
            )}
          </div>
        </div>

        {/* Period Filter Row */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span>Reporting Period</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100/90 p-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setPeriod(opt)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  period === opt
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {period === 'Custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 outline-none focus:border-sky-600"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 outline-none focus:border-sky-600"
              />
            </div>
          )}
        </div>
      </div>

      {/* Primary Hero Metric Cards */}
      <div
        className={`grid gap-4 sm:grid-cols-2 ${
          showFinancials ? 'xl:grid-cols-4' : 'xl:grid-cols-3'
        }`}
      >
        {/* Enrollment Card */}
        <div className="os-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Enrollment</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {metrics.totalStudents}
            </span>
            <span className="text-xs font-medium text-emerald-700 tabular-nums">
              +{metrics.newAdmissionsInPeriod} new in period
            </span>
          </div>
          <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-sky-600 transition-all"
              style={{ width: `${activeRetentionPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
            <span>{metrics.activeStudents} active</span>
            <span>{metrics.leftStudents} exited</span>
          </div>
        </div>

        {/* Fee Collection Card (Financial Roles) */}
        {showFinancials && (
          <div className="os-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Fee Collected</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <TrendingUp className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between gap-2">
              <span className="font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
                {formatCurrency(metrics.totalCollected, metrics.currency)}
              </span>
            </div>
            <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{ width: `${metrics.collectionRatePct}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
              <span>{metrics.collectionRatePct}% of billed collected</span>
              <span>{period}</span>
            </div>
          </div>
        )}

        {/* Outstanding Recovery Card (Financial Roles) */}
        {showFinancials && (
          <div className="os-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Outstanding Recovery</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <AlertCircle className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between gap-2">
              <span className="font-mono text-2xl font-semibold text-amber-700 tabular-nums">
                {formatCurrency(metrics.outstandingFees, metrics.currency)}
              </span>
            </div>
            <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
              <span className="font-medium text-red-700 tabular-nums">
                {metrics.overdueRecords} overdue invoices
              </span>
              {allowedSections.includes('reports') && (
                <button
                  type="button"
                  onClick={() => onNavigate('reports')}
                  className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
                >
                  Defaulters
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Attendance Rate Card */}
        <div className="os-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Attendance Rate</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {metrics.attendancePct}%
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {metrics.activeBatches} {isTrainer ? 'my batches' : 'active batches'}
            </span>
          </div>
          <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#071526] transition-all"
              style={{ width: `${metrics.attendancePct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Present &amp; late average</span>
            <span>
              {isTrainer ? trainerDisplayName : `${db.teachers.length} instructors`}
            </span>
          </div>
        </div>

        {/* Non-financial extra card for Trainers / Coordinators */}
        {!showFinancials && (
          <div className="os-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                {isTrainer ? 'My Assigned Batches' : 'Admission Pipeline'}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <CalendarCheck className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {isTrainer ? metrics.activeBatches : metrics.totalInquiries}
            </div>
            <p className="mt-3.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
              {isTrainer
                ? `Batches listed under ${trainerDisplayName}`
                : `Inquiries logged during ${period}`}
            </p>
          </div>
        )}
      </div>

      {/* Unified Secondary Operational Strip */}
      <div className="os-card overflow-hidden">
        <div
          className={`grid grid-cols-2 divide-y divide-slate-100 sm:divide-y-0 sm:divide-x ${
            showFinancials ? 'lg:grid-cols-5' : 'lg:grid-cols-3'
          }`}
        >
          {showFinancials && (
            <>
              <div className="px-5 py-4">
                <p className="text-xs text-slate-500">Fee Billed ({period})</p>
                <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(metrics.totalFeeBilled, metrics.currency)}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs text-slate-500">Total Expenses</p>
                <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(metrics.totalExpenses, metrics.currency)}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs text-slate-500">Net Profit / Loss</p>
                <p
                  className={`mt-1 font-mono text-base font-semibold tabular-nums ${
                    metrics.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {formatCurrency(metrics.netProfit, metrics.currency)}
                </p>
              </div>
            </>
          )}
          <div className="px-5 py-4">
            <p className="text-xs text-slate-500">
              {isTrainer ? 'Assigned Batches' : 'Active Batches'}
            </p>
            <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
              {metrics.activeBatches}
            </p>
          </div>
          {allowedSections.includes('inquiries') ? (
            <div className="px-5 py-4">
              <p className="text-xs text-slate-500">Admission Inquiries</p>
              <p className="mt-1 font-mono text-base font-semibold text-sky-700 tabular-nums">
                {metrics.totalInquiries}
              </p>
            </div>
          ) : (
            <div className="px-5 py-4">
              <p className="text-xs text-slate-500">Active Faculty</p>
              <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
                {db.teachers.length}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Monthly Fee Collection vs Expenses Bar Chart */}
        {showFinancials && (
          <div className="os-card p-6 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Fee Collection vs. Expenses
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Monthly cashflow comparison in {metrics.currency}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#071526]" />
                  Collected
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-sky-300" />
                  Expenses
                </span>
              </div>
            </div>

            {monthlySeries.length === 0 ? (
              <div className="flex h-60 items-center justify-center text-sm text-slate-500">
                No fee or expense records yet.
              </div>
            ) : (
              <div className="mt-6">
                <div className="relative">
                  {/* Subtle horizontal reference lines */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-2 pt-6"
                  >
                    <div className="border-t border-dashed border-slate-200/80" />
                    <div className="border-t border-dashed border-slate-200/80" />
                    <div className="border-t border-dashed border-slate-200/80" />
                  </div>

                  <div
                    className="relative grid h-60 items-end gap-4 border-b border-slate-200 pb-2 pt-6"
                    style={{
                      gridTemplateColumns: `repeat(${monthlySeries.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {monthlySeries.map((item) => {
                      const colH = Math.max(4, Math.round((item.collected / maxChartVal) * 180));
                      const expH = Math.max(4, Math.round((item.expenses / maxChartVal) * 180));
                      const isHovered = hoveredMonth === item.key;

                      return (
                        <div
                          key={item.key}
                          onMouseEnter={() => setHoveredMonth(item.key)}
                          onMouseLeave={() => setHoveredMonth(null)}
                          className="relative flex flex-col items-center justify-end"
                        >
                          {isHovered && (
                            <div className="absolute -top-11 z-10 whitespace-nowrap rounded-lg border border-slate-700 bg-[#071526] px-2.5 py-1.5 text-[11px] text-white shadow-lg">
                              <div className="font-mono tabular-nums">
                                In: {formatCurrency(item.collected, metrics.currency)}
                              </div>
                              <div className="font-mono text-sky-300 tabular-nums">
                                Out: {formatCurrency(item.expenses, metrics.currency)}
                              </div>
                            </div>
                          )}
                          <div className="flex items-end gap-1.5">
                            <div
                              className="w-5 rounded-t-md bg-[#071526] transition-opacity hover:opacity-85 sm:w-7"
                              style={{ height: `${colH}px` }}
                              title={`Collected: ${formatCurrency(item.collected, metrics.currency)}`}
                            />
                            <div
                              className="w-5 rounded-t-md bg-sky-300 transition-opacity hover:opacity-85 sm:w-7"
                              style={{ height: `${expH}px` }}
                              title={`Expenses: ${formatCurrency(item.expenses, metrics.currency)}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div
                  className="mt-2.5 grid gap-4 text-center"
                  style={{
                    gridTemplateColumns: `repeat(${monthlySeries.length}, minmax(0, 1fr))`,
                  }}
                >
                  {monthlySeries.map((item) => (
                    <span key={item.key} className="font-mono text-xs text-slate-500">
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Batch Occupancy Progress Bars */}
        <div
          className={`os-card p-6 ${
            showFinancials ? 'lg:col-span-5' : 'lg:col-span-12'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {isTrainer ? 'My Assigned Batches' : 'Batch Occupancy'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {isTrainer
                  ? `Showing only batches listed under ${trainerDisplayName}`
                  : 'Active enrollments against seat capacity'}
              </p>
            </div>
            {allowedSections.includes('batches') && (
              <button
                type="button"
                onClick={() => onNavigate('batches')}
                className="text-xs font-medium text-sky-700 hover:underline whitespace-nowrap"
              >
                {isTrainer ? 'View My Batches' : 'Manage Batches'}
              </button>
            )}
          </div>

          <div className="mt-5 space-y-4">
            {visibleBatches.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
                No batches are currently assigned to {trainerDisplayName}.
              </div>
            ) : (
              visibleBatches.map((b) => {
                const m = computeBatchMetrics(b, db);
                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="truncate pr-2">
                        <span className="font-mono font-medium text-slate-500">{b.id}</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="font-medium text-slate-900">{b.batchName}</span>
                      </div>
                      <span className="shrink-0 font-mono text-slate-700 tabular-nums">
                        {m.activeCount}/{b.maxCapacity} ({m.occupancyPct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          m.occupancyPct >= 90 ? 'bg-amber-500' : 'bg-sky-600'
                        }`}
                        style={{ width: `${m.occupancyPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {b.assignedTeacher} · {b.time}
                      </span>
                      <span className="tabular-nums">{m.seatsLeft} seats available</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Tables Row */}
      {(showFinancials || allowedSections.includes('inquiries')) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pending Fee Recovery */}
          {showFinancials && (
            <div className="os-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Top Pending Recoveries</h2>
                  <p className="text-xs text-slate-500">Students with open balances</p>
                </div>
                {allowedSections.includes('reports') && (
                  <button
                    type="button"
                    onClick={() => onNavigate('reports')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline whitespace-nowrap"
                  >
                    <FileBarChart2 className="h-3.5 w-3.5" />
                    Defaulters Report
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/90 text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5">Student</th>
                      <th className="px-4 py-2.5">Month</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-5 py-2.5 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overdueFeesList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-6 text-center text-xs text-slate-500">
                          All fee balances are cleared.
                        </td>
                      </tr>
                    ) : (
                      overdueFeesList.map((f) => {
                        const status = computeFeeStatus(f);
                        const balance = computeFeeBalance(f);
                        return (
                          <tr key={f.id} className="transition-colors hover:bg-slate-50/80">
                            <td className="px-5 py-2.5">
                              <div className="font-medium text-slate-900">{f.studentName}</div>
                              <div className="font-mono text-xs text-slate-500">{f.studentId}</div>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{f.month}</td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`text-xs font-medium ${
                                  status === 'Overdue' ? 'text-red-700' : 'text-amber-700'
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="px-5 py-2.5 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                              {formatCurrency(balance, metrics.currency)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Admission Inquiries */}
          {allowedSections.includes('inquiries') && (
            <div className="os-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Recent Inquiries</h2>
                  <p className="text-xs text-slate-500">Latest prospective students</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('inquiries')}
                  className="text-xs font-medium text-sky-700 hover:underline whitespace-nowrap"
                >
                  Open Pipeline
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/90 text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5">Prospect</th>
                      <th className="px-4 py-2.5">Course</th>
                      <th className="px-4 py-2.5">Follow-up</th>
                      <th className="px-5 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentInquiries.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-6 text-center text-xs text-slate-500">
                          No admission inquiries logged yet.
                        </td>
                      </tr>
                    ) : (
                      recentInquiries.map((inq) => (
                        <tr key={inq.id} className="transition-colors hover:bg-slate-50/80">
                          <td className="px-5 py-2.5">
                            <div className="font-medium text-slate-900">{inq.fullName}</div>
                            <div className="font-mono text-xs text-slate-500">{inq.phone}</div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-700">
                            {inq.interestedCourse}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                            {inq.followUpDate || '—'}
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <span
                              className={`text-xs font-medium ${
                                inq.status === 'Converted'
                                  ? 'text-emerald-700'
                                  : inq.status === 'Closed'
                                    ? 'text-slate-500'
                                    : 'text-sky-700'
                              }`}
                            >
                              {inq.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
