import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  MessageCircle,
  Printer,
  Search,
} from 'lucide-react';
import {
  AcademyDatabase,
  ExpenseCategory,
  PaymentMethod,
  PayrollStatus,
  ReportTab,
  StaffStatus,
  UserAccount,
  UserRole,
} from '../types/academy';
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  computeBatchMetrics,
  computeDurationLabel,
  computeFeeBalance,
  computeFeeStatus,
  computeStudentAttendancePct,
  computeStudentOutstanding,
  exportToCsv,
  formatCurrency,
  isDateInRange,
  TODAY_ISO,
  triggerA4Print,
} from '../utils/calculations';
import {
  getAllowedReportTabs,
  getTrainerScopedBatches,
  getTrainerScopedStudents,
} from '../utils/permissions';
import { MTSLogo } from './MTSLogo';

interface ReportsCenterProps {
  db: AcademyDatabase;
  userRole: UserRole;
  currentUser?: UserAccount | null;
  onLogWhatsApp: (entry: {
    studentId: string;
    studentName: string;
    phone: string;
    messageType: 'Overdue Fee';
  }) => void;
}

const REPORT_TABS: { id: ReportTab; label: string }[] = [
  { id: 'admissions', label: '1. Total Admissions' },
  { id: 'batch-wise', label: '2. Batch-Wise' },
  { id: 'dropouts', label: '3. Dropouts' },
  { id: 'fee-collection', label: '4. Fees Collection' },
  { id: 'defaulters', label: '5. Defaulters' },
  { id: 'expenses-heads', label: '6. Expenses (All Heads)' },
  { id: 'salaries-payroll', label: '7. Salaries & Payroll' },
  { id: 'staff-performance', label: '8. Staff Performance' },
  { id: 'students-performance', label: '9. Students Performance' },
];

const EXPENSE_HEADS: ExpenseCategory[] = [
  'Rent',
  'Salary',
  'Electricity',
  'Internet',
  'Marketing',
  'Equipment',
  'Misc',
];

type PerformanceBand = 'High Performer' | 'On Track' | 'Needs Review';
type StudentStanding = 'Excellent' | 'Good' | 'At Risk' | 'New' | 'Exited';

export const ReportsCenter: React.FC<ReportsCenterProps> = ({
  db,
  userRole,
  currentUser = null,
  onLogWhatsApp,
}) => {
  const allowedTabIds = useMemo(() => getAllowedReportTabs(userRole), [userRole]);
  const visibleTabs = useMemo(
    () => REPORT_TABS.filter((t) => allowedTabIds.includes(t.id)),
    [allowedTabIds]
  );

  const [activeTab, setActiveTab] = useState<ReportTab>(
    visibleTabs[0]?.id || 'admissions'
  );
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-12-31');
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [genderFilter, setGenderFilter] = useState('All');
  const [batchFilter, setBatchFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState<'All' | PaymentMethod>('All');

  // New report filters
  const [expenseHeadFilter, setExpenseHeadFilter] = useState<'All' | ExpenseCategory>('All');
  const [payrollMonthFilter, setPayrollMonthFilter] = useState('All');
  const [payrollDeptFilter, setPayrollDeptFilter] = useState('All');
  const [payrollStatusFilter, setPayrollStatusFilter] = useState<'All' | PayrollStatus>('All');
  const [staffDeptFilter, setStaffDeptFilter] = useState('All');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'All' | StaffStatus>('All');
  const [studentStandingFilter, setStudentStandingFilter] = useState<'All' | StudentStanding>('All');

  // Keep activeTab strictly within role-permitted tabs
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  const isTrainer = userRole === 'Trainer';
  const currency = db.settings.currency || 'PKR';
  const lowAttThreshold = db.settings.lowAttendanceAlertPct || 75;

  const scopedBatches = useMemo(
    () => getTrainerScopedBatches(db.batches, userRole, currentUser),
    [db.batches, userRole, currentUser]
  );
  const scopedStudents = useMemo(
    () => getTrainerScopedStudents(db.students, db.batches, userRole, currentUser),
    [db.students, db.batches, userRole, currentUser]
  );

  const distinctCourses = useMemo(
    () => Array.from(new Set(scopedStudents.map((s) => s.course))).filter(Boolean),
    [scopedStudents]
  );
  const distinctPayrollMonths = useMemo(
    () => Array.from(new Set(db.payroll.map((p) => p.month))).filter(Boolean),
    [db.payroll]
  );
  const distinctDepartments = useMemo(
    () =>
      Array.from(
        new Set([
          ...db.hrStaff.map((s) => s.department),
          ...db.payroll.map((p) => p.department),
        ])
      ).filter(Boolean),
    [db.hrStaff, db.payroll]
  );

  // 1. Total Admission Report data
  const admissionsData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.students
      .filter((s) => isDateInRange(s.admissionDate, dateFrom, dateTo))
      .filter((s) => (courseFilter === 'All' ? true : s.course === courseFilter))
      .filter((s) => (genderFilter === 'All' ? true : s.gender === genderFilter))
      .filter((s) =>
        !q
          ? true
          : s.id.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            s.course.toLowerCase().includes(q)
      )
      .sort((a, b) => b.admissionDate.localeCompare(a.admissionDate));
  }, [db.students, dateFrom, dateTo, courseFilter, genderFilter, search]);

  // 2. Batch-Wise Admission Report
  const batchWiseData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedBatches
      .filter((b) =>
        !q
          ? true
          : b.id.toLowerCase().includes(q) ||
            b.batchName.toLowerCase().includes(q) ||
            b.assignedTeacher.toLowerCase().includes(q)
      )
      .map((b) => ({
        batch: b,
        metrics: computeBatchMetrics(b, db),
      }));
  }, [scopedBatches, db, search]);

  // 3. Left / Dropout Students Report
  const dropoutData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.students
      .filter((s) => s.status === 'Left')
      .filter((s) => {
        if (!s.leftDate) return true;
        return isDateInRange(s.leftDate, dateFrom, dateTo);
      })
      .filter((s) =>
        !q
          ? true
          : s.id.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            s.course.toLowerCase().includes(q)
      )
      .map((s) => ({
        student: s,
        duration: computeDurationLabel(s.admissionDate, s.leftDate),
        unpaidBalance: computeStudentOutstanding(s.id, db.fees),
      }));
  }, [db.students, db.fees, dateFrom, dateTo, search]);

  // 4. Fees Collection Report
  const feeCollectionData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.fees
      .filter((f) => {
        const dt = f.paymentDate || f.dueDate;
        return isDateInRange(dt, dateFrom, dateTo);
      })
      .filter((f) => (batchFilter === 'All' ? true : f.batchId === batchFilter))
      .filter((f) => (methodFilter === 'All' ? true : f.paymentMethod === methodFilter))
      .filter((f) =>
        !q
          ? true
          : f.id.toLowerCase().includes(q) ||
            f.studentName.toLowerCase().includes(q) ||
            f.studentId.toLowerCase().includes(q) ||
            f.month.toLowerCase().includes(q)
      );
  }, [db.fees, dateFrom, dateTo, batchFilter, methodFilter, search]);

  // 5. Fee Recovery / Defaulters Report
  const defaultersData = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byStudent = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        parentPhone: string;
        course: string;
        monthsPending: string[];
        totalDue: number;
      }
    >();

    for (const f of db.fees) {
      const bal = computeFeeBalance(f);
      if (bal <= 0) continue;
      const student = db.students.find((s) => s.id === f.studentId);
      const existing = byStudent.get(f.studentId);
      if (existing) {
        existing.monthsPending.push(f.month);
        existing.totalDue += bal;
      } else {
        byStudent.set(f.studentId, {
          studentId: f.studentId,
          studentName: f.studentName,
          parentPhone: student?.parentPhone || student?.studentPhone || '',
          course: student?.course || '',
          monthsPending: [f.month],
          totalDue: bal,
        });
      }
    }

    return Array.from(byStudent.values())
      .filter((d) =>
        !q
          ? true
          : d.studentId.toLowerCase().includes(q) ||
            d.studentName.toLowerCase().includes(q) ||
            d.parentPhone.includes(q)
      )
      .sort((a, b) => b.totalDue - a.totalDue);
  }, [db.fees, db.students, search]);

  // 6. Accounts: Expenses with All Heads
  const periodExpensesAllHeads = useMemo(
    () => db.expenses.filter((e) => isDateInRange(e.date, dateFrom, dateTo)),
    [db.expenses, dateFrom, dateTo]
  );

  const expenseHeadSummary = useMemo(() => {
    const totalAll = periodExpensesAllHeads.reduce((sum, e) => sum + e.amount, 0);
    return EXPENSE_HEADS.map((head) => {
      const items = periodExpensesAllHeads.filter((e) => e.category === head);
      const total = items.reduce((sum, e) => sum + e.amount, 0);
      const sharePct = totalAll > 0 ? Math.round((total / totalAll) * 100) : 0;
      return {
        head,
        count: items.length,
        total,
        sharePct,
      };
    });
  }, [periodExpensesAllHeads]);

  const filteredExpenseEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periodExpensesAllHeads
      .filter((e) => (expenseHeadFilter === 'All' ? true : e.category === expenseHeadFilter))
      .filter((e) =>
        !q
          ? true
          : e.id.toLowerCase().includes(q) ||
            e.category.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q) ||
            e.paidBy.toLowerCase().includes(q)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [periodExpensesAllHeads, expenseHeadFilter, search]);

  // 7. Accounts: Salaries & Payroll Report
  const salariesData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.payroll
      .filter((p) => (payrollMonthFilter === 'All' ? true : p.month === payrollMonthFilter))
      .filter((p) => (payrollDeptFilter === 'All' ? true : p.department === payrollDeptFilter))
      .filter((p) => (payrollStatusFilter === 'All' ? true : p.status === payrollStatusFilter))
      .filter((p) =>
        !q
          ? true
          : p.id.toLowerCase().includes(q) ||
            p.staffId.toLowerCase().includes(q) ||
            p.staffName.toLowerCase().includes(q) ||
            p.designation.toLowerCase().includes(q) ||
            p.department.toLowerCase().includes(q)
      );
  }, [db.payroll, payrollMonthFilter, payrollDeptFilter, payrollStatusFilter, search]);

  // 8. Staff Performance Report
  const staffPerformanceData = useMemo(() => {
    const q = search.trim().toLowerCase();
    const totalInquiries = db.inquiries.length;
    const convertedInquiries = db.inquiries.filter((i) => i.status === 'Converted').length;

    const rows = db.hrStaff.map((staff) => {
      const payrollEntries = db.payroll.filter((p) => p.staffId === staff.id);
      const totalWorkingDays = payrollEntries.reduce((s, p) => s + (p.workingDays || 0), 0);
      const totalPresentDays = payrollEntries.reduce((s, p) => s + (p.presentDays || 0), 0);
      const attendancePct =
        totalWorkingDays > 0 ? Math.round((totalPresentDays / totalWorkingDays) * 100) : null;
      const totalBonuses = payrollEntries.reduce((s, p) => s + (p.bonuses || 0), 0);
      const totalPaidSlips = payrollEntries.filter((p) => p.status === 'Paid').length;

      // Match batches/students if staff is faculty/trainer
      const staffNameLower = staff.name.trim().toLowerCase();
      const assignedBatches = db.batches.filter(
        (b) => b.assignedTeacher.trim().toLowerCase() === staffNameLower
      );
      const batchIds = new Set(assignedBatches.map((b) => b.id));
      const taughtStudents = db.students.filter(
        (st) =>
          batchIds.has(st.batchId) || st.teacher.trim().toLowerCase() === staffNameLower
      );
      const activeTaught = taughtStudents.filter((st) => st.status === 'Active').length;
      const retentionPct =
        taughtStudents.length > 0
          ? Math.round((activeTaught / taughtStudents.length) * 100)
          : null;

      const batchAttendanceRecords = db.attendance.filter((a) => batchIds.has(a.batchId));
      const classPresent = batchAttendanceRecords.filter(
        (a) => a.status === 'Present' || a.status === 'Late'
      ).length;
      const classAttendancePct =
        batchAttendanceRecords.length > 0
          ? Math.round((classPresent / batchAttendanceRecords.length) * 100)
          : null;

      let kpiHighlight = 'Operations & Attendance';
      if (assignedBatches.length > 0) {
        kpiHighlight = `${assignedBatches.length} batch(es) · ${activeTaught} active students`;
      } else if (staff.department === 'Admissions') {
        kpiHighlight = `${convertedInquiries}/${totalInquiries} inquiries converted`;
      } else if (staff.department === 'Finance') {
        kpiHighlight = `${db.fees.filter((f) => f.amountPaid > 0).length} fee collections · ${db.expenses.length} expenses`;
      } else if (staff.department === 'Administration') {
        kpiHighlight = `${db.batches.length} batches · ${db.students.filter((s) => s.status === 'Active').length} active students`;
      }

      // Compute overall weighted score (0-100)
      const scoreParts: number[] = [];
      if (attendancePct !== null) scoreParts.push(attendancePct);
      if (retentionPct !== null) scoreParts.push(retentionPct);
      if (classAttendancePct !== null) scoreParts.push(classAttendancePct);
      if (scoreParts.length === 0) {
        scoreParts.push(staff.status === 'Active' ? 88 : 60);
      }
      const overallScore = Math.round(
        scoreParts.reduce((sum, val) => sum + val, 0) / scoreParts.length
      );

      let band: PerformanceBand = 'On Track';
      if (staff.status !== 'Active' || overallScore < 75) {
        band = 'Needs Review';
      } else if (overallScore >= 90 || totalBonuses > 0) {
        band = 'High Performer';
      }

      return {
        staff,
        attendancePct,
        assignedBatchCount: assignedBatches.length,
        activeTaught,
        retentionPct,
        classAttendancePct,
        totalPaidSlips,
        kpiHighlight,
        overallScore,
        band,
      };
    });

    return rows
      .filter((r) => (staffDeptFilter === 'All' ? true : r.staff.department === staffDeptFilter))
      .filter((r) => (staffStatusFilter === 'All' ? true : r.staff.status === staffStatusFilter))
      .filter((r) =>
        !q
          ? true
          : r.staff.id.toLowerCase().includes(q) ||
            r.staff.name.toLowerCase().includes(q) ||
            r.staff.designation.toLowerCase().includes(q) ||
            r.staff.department.toLowerCase().includes(q)
      );
  }, [
    db.hrStaff,
    db.payroll,
    db.batches,
    db.students,
    db.attendance,
    db.inquiries,
    db.fees,
    db.expenses,
    staffDeptFilter,
    staffStatusFilter,
    search,
  ]);

  // 9. Students Performance Report
  const studentsPerformanceData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedStudents
      .filter((s) => (batchFilter === 'All' ? true : s.batchId === batchFilter))
      .filter((s) => (courseFilter === 'All' ? true : s.course === courseFilter))
      .map((s) => {
        const records = db.attendance.filter((a) => a.studentId === s.id);
        const present = records.filter((a) => a.status === 'Present').length;
        const late = records.filter((a) => a.status === 'Late').length;
        const absent = records.filter((a) => a.status === 'Absent').length;
        const attendancePct = computeStudentAttendancePct(s.id, db.attendance);
        const outstanding = computeStudentOutstanding(s.id, db.fees);

        let standing: StudentStanding;
        if (s.status === 'Left') {
          standing = 'Exited';
        } else if (attendancePct === null) {
          standing = 'New';
        } else if (attendancePct < lowAttThreshold) {
          standing = 'At Risk';
        } else if (attendancePct >= 90) {
          standing = 'Excellent';
        } else {
          standing = 'Good';
        }

        return {
          student: s,
          totalSessions: records.length,
          present,
          late,
          absent,
          attendancePct,
          outstanding,
          standing,
        };
      })
      .filter((r) =>
        studentStandingFilter === 'All' ? true : r.standing === studentStandingFilter
      )
      .filter((r) =>
        !q
          ? true
          : r.student.id.toLowerCase().includes(q) ||
            r.student.name.toLowerCase().includes(q) ||
            r.student.course.toLowerCase().includes(q) ||
            r.student.batchId.toLowerCase().includes(q) ||
            r.student.teacher.toLowerCase().includes(q)
      );
  }, [
    scopedStudents,
    db.attendance,
    db.fees,
    batchFilter,
    courseFilter,
    studentStandingFilter,
    lowAttThreshold,
    search,
  ]);

  const handleExportCsv = () => {
    if (activeTab === 'admissions') {
      exportToCsv(
        'MTS_Total_Admissions_Report.csv',
        ['Student ID', 'Name', 'Father Name', 'Gender', 'Course', 'Batch', 'Monthly Fee', 'Status', 'Admission Date'],
        admissionsData.map((s) => [
          s.id,
          s.name,
          s.fatherName,
          s.gender,
          s.course,
          s.batchId,
          s.monthlyFee,
          s.status,
          s.admissionDate,
        ])
      );
    } else if (activeTab === 'batch-wise') {
      exportToCsv(
        'MTS_Batch_Wise_Report.csv',
        ['Batch ID', 'Batch Name', 'Course', 'Teacher', 'Schedule', 'Capacity', 'Active Enrolled', 'Left', 'Seats Available', 'Occupancy %'],
        batchWiseData.map(({ batch, metrics }) => [
          batch.id,
          batch.batchName,
          batch.course,
          batch.assignedTeacher,
          `${batch.days} ${batch.time}`,
          batch.maxCapacity,
          metrics.activeCount,
          metrics.leftCount,
          metrics.seatsLeft,
          `${metrics.occupancyPct}%`,
        ])
      );
    } else if (activeTab === 'dropouts') {
      exportToCsv(
        'MTS_Dropout_Students_Report.csv',
        ['Student ID', 'Name', 'Course', 'Batch', 'Admission Date', 'Left Date', 'Duration', 'Reason', 'Unpaid Balance'],
        dropoutData.map(({ student, duration, unpaidBalance }) => [
          student.id,
          student.name,
          student.course,
          student.batchId,
          student.admissionDate,
          student.leftDate,
          duration,
          student.leftReason,
          unpaidBalance,
        ])
      );
    } else if (activeTab === 'fee-collection') {
      exportToCsv(
        'MTS_Fees_Collection_Report.csv',
        ['Fee ID', 'Student ID', 'Name', 'Batch', 'Month', 'Fee Amount', 'Discount', 'Amount Paid', 'Balance', 'Method', 'Payment Date', 'Status'],
        feeCollectionData.map((f) => [
          f.id,
          f.studentId,
          f.studentName,
          f.batchId,
          f.month,
          f.feeAmount,
          f.discount,
          f.amountPaid,
          computeFeeBalance(f),
          f.paymentMethod,
          f.paymentDate,
          computeFeeStatus(f),
        ])
      );
    } else if (activeTab === 'defaulters') {
      exportToCsv(
        'MTS_Fee_Recovery_Defaulters_Report.csv',
        ['Student ID', 'Name', 'Parent Phone', 'Course', 'Months Pending', 'Total Due'],
        defaultersData.map((d) => [
          d.studentId,
          d.studentName,
          d.parentPhone,
          d.course,
          d.monthsPending.join('; '),
          d.totalDue,
        ])
      );
    } else if (activeTab === 'expenses-heads') {
      exportToCsv(
        'MTS_Expenses_All_Heads_Report.csv',
        ['Expense ID', 'Date', 'Expense Head', 'Description', 'Paid By', 'Amount'],
        filteredExpenseEntries.map((e) => [
          e.id,
          e.date,
          e.category,
          e.description,
          e.paidBy,
          e.amount,
        ])
      );
    } else if (activeTab === 'salaries-payroll') {
      exportToCsv(
        'MTS_Salaries_Payroll_Report.csv',
        ['Payroll ID', 'Staff ID', 'Staff Name', 'Department', 'Designation', 'Month', 'Working Days', 'Present Days', 'Base Salary', 'Allowances', 'Bonus & OT', 'Deductions & Adv', 'Net Salary', 'Method', 'Payment Date', 'Status'],
        salariesData.map((p) => [
          p.id,
          p.staffId,
          p.staffName,
          p.department,
          p.designation,
          p.month,
          p.workingDays,
          p.presentDays,
          p.baseSalary,
          p.allowances,
          (p.bonuses || 0) + (p.overtimePay || 0),
          (p.deductions || 0) + (p.advanceRecovery || 0),
          p.netSalary,
          p.paymentMethod || 'Pending',
          p.paymentDate || '',
          p.status,
        ])
      );
    } else if (activeTab === 'staff-performance') {
      exportToCsv(
        'MTS_Staff_Performance_Report.csv',
        ['Staff ID', 'Name', 'Department', 'Designation', 'Status', 'Payroll Attendance %', 'Batches / Output', 'Student Retention %', 'Class Attendance %', 'Score %', 'Rating'],
        staffPerformanceData.map((r) => [
          r.staff.id,
          r.staff.name,
          r.staff.department,
          r.staff.designation,
          r.staff.status,
          r.attendancePct !== null ? `${r.attendancePct}%` : 'N/A',
          r.kpiHighlight,
          r.retentionPct !== null ? `${r.retentionPct}%` : 'N/A',
          r.classAttendancePct !== null ? `${r.classAttendancePct}%` : 'N/A',
          `${r.overallScore}%`,
          r.band,
        ])
      );
    } else if (activeTab === 'students-performance') {
      const headers = isTrainer
        ? ['Student ID', 'Name', 'Course', 'Batch', 'Teacher', 'Sessions', 'Present', 'Late', 'Absent', 'Attendance %', 'Standing']
        : ['Student ID', 'Name', 'Course', 'Batch', 'Teacher', 'Sessions', 'Present', 'Late', 'Absent', 'Attendance %', 'Pending Fee Balance', 'Standing'];
      exportToCsv(
        'MTS_Students_Performance_Report.csv',
        headers,
        studentsPerformanceData.map((r) =>
          isTrainer
            ? [
                r.student.id,
                r.student.name,
                r.student.course,
                r.student.batchId,
                r.student.teacher,
                r.totalSessions,
                r.present,
                r.late,
                r.absent,
                r.attendancePct !== null ? `${r.attendancePct}%` : 'New',
                r.standing,
              ]
            : [
                r.student.id,
                r.student.name,
                r.student.course,
                r.student.batchId,
                r.student.teacher,
                r.totalSessions,
                r.present,
                r.late,
                r.absent,
                r.attendancePct !== null ? `${r.attendancePct}%` : 'New',
                r.outstanding,
                r.standing,
              ]
        )
      );
    }
  };

  const usesDateRange =
    activeTab === 'admissions' ||
    activeTab === 'dropouts' ||
    activeTab === 'fee-collection' ||
    activeTab === 'expenses-heads';

  if (visibleTabs.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-10 text-center text-sm text-slate-500">
        No reports are enabled for your role ({userRole}).
      </div>
    );
  }

  const totalPeriodExpenses = periodExpensesAllHeads.reduce((s, e) => s + e.amount, 0);
  const salaryHeadSpend =
    expenseHeadSummary.find((h) => h.head === 'Salary')?.total || 0;
  const highestExpenseHead = [...expenseHeadSummary].sort((a, b) => b.total - a.total)[0];

  const totalPayrollNet = salariesData.reduce((s, p) => s + p.netSalary, 0);
  const totalPayrollPaid = salariesData
    .filter((p) => p.status === 'Paid')
    .reduce((s, p) => s + p.netSalary, 0);
  const totalPayrollPending = salariesData
    .filter((p) => p.status !== 'Paid')
    .reduce((s, p) => s + p.netSalary, 0);
  const totalPayrollDeductions = salariesData.reduce(
    (s, p) => s + (p.deductions || 0) + (p.advanceRecovery || 0),
    0
  );

  const staffWithAtt = staffPerformanceData.filter((r) => r.attendancePct !== null);
  const avgStaffAttPct =
    staffWithAtt.length > 0
      ? Math.round(
          staffWithAtt.reduce((s, r) => s + (r.attendancePct || 0), 0) /
            staffWithAtt.length
        )
      : 100;
  const facultyPerfRows = staffPerformanceData.filter((r) => r.retentionPct !== null);
  const avgFacultyRetention =
    facultyPerfRows.length > 0
      ? Math.round(
          facultyPerfRows.reduce((s, r) => s + (r.retentionPct || 0), 0) /
            facultyPerfRows.length
        )
      : 100;

  const evaluatedWithAtt = studentsPerformanceData.filter(
    (r) => r.attendancePct !== null
  );
  const avgStudentAtt =
    evaluatedWithAtt.length > 0
      ? Math.round(
          evaluatedWithAtt.reduce((s, r) => s + (r.attendancePct || 0), 0) /
            evaluatedWithAtt.length
        )
      : 100;

  return (
    <div className="space-y-5">
      {/* Report Tabs + Export/Print */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] px-5 py-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === t.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            Role Scope: <span className="font-medium text-slate-800">{userRole}</span>
            {' · '}
            {userRole === 'Admin' || userRole === 'Manager'
              ? `All ${visibleTabs.length} academy, accounts, HR, and performance reports unlocked`
              : `${visibleTabs.length} role-permitted report(s)`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={triggerA4Print}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Report (A4)
          </button>
        </div>
      </div>

      {/* Printable A4 Report Header */}
      <div className="hidden print:block print-a4-sheet border-b-2 border-slate-900 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <MTSLogo size="lg" className="border border-slate-200" />
            <div>
              <h1 className="text-lg font-bold text-slate-900">{db.settings.academyName}</h1>
              <p className="text-xs text-slate-600">{db.settings.address}</p>
              <p className="font-mono text-xs text-slate-600">{db.settings.phone}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-wider text-sky-800">
              {REPORT_TABS.find((t) => t.id === activeTab)?.label || 'Academy Report'}
            </div>
            {usesDateRange && (
              <div className="mt-0.5 font-mono text-xs text-slate-600">
                Period: {dateFrom} to {dateTo}
              </div>
            )}
            <div className="font-mono text-[11px] text-slate-500">
              Role: {userRole} · Printed: {TODAY_ISO}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="no-print flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] px-5 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter report..."
            className="w-52 rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-xs outline-none focus:border-sky-600"
          />
        </div>

        {usesDateRange && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
            />
            <span className="text-slate-500">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
            />
          </div>
        )}

        {(activeTab === 'admissions' || activeTab === 'students-performance') && (
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
          >
            <option value="All">All Courses</option>
            {distinctCourses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        {activeTab === 'admissions' && (
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
          >
            <option value="All">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        )}

        {(activeTab === 'fee-collection' || activeTab === 'students-performance') && (
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
          >
            <option value="All">All Batches</option>
            {scopedBatches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} — {b.batchName}
              </option>
            ))}
          </select>
        )}

        {activeTab === 'fee-collection' && (
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as 'All' | PaymentMethod)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
          >
            <option value="All">All Payment Methods</option>
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="JazzCash">JazzCash</option>
            <option value="EasyPaisa">EasyPaisa</option>
          </select>
        )}

        {activeTab === 'expenses-heads' && (
          <select
            value={expenseHeadFilter}
            onChange={(e) =>
              setExpenseHeadFilter(e.target.value as 'All' | ExpenseCategory)
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
          >
            <option value="All">All Expense Heads</option>
            {EXPENSE_HEADS.map((head) => (
              <option key={head} value={head}>
                {head}
              </option>
            ))}
          </select>
        )}

        {activeTab === 'salaries-payroll' && (
          <>
            <select
              value={payrollMonthFilter}
              onChange={(e) => setPayrollMonthFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
            >
              <option value="All">All Months</option>
              {distinctPayrollMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={payrollDeptFilter}
              onChange={(e) => setPayrollDeptFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
            >
              <option value="All">All Departments</option>
              {distinctDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={payrollStatusFilter}
              onChange={(e) =>
                setPayrollStatusFilter(e.target.value as 'All' | PayrollStatus)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Approved">Approved</option>
              <option value="Draft">Draft</option>
            </select>
          </>
        )}

        {activeTab === 'staff-performance' && (
          <>
            <select
              value={staffDeptFilter}
              onChange={(e) => setStaffDeptFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
            >
              <option value="All">All Departments</option>
              {distinctDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={staffStatusFilter}
              onChange={(e) =>
                setStaffStatusFilter(e.target.value as 'All' | StaffStatus)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
            >
              <option value="All">All Staff Statuses</option>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Resigned">Resigned</option>
            </select>
          </>
        )}

        {activeTab === 'students-performance' && (
          <select
            value={studentStandingFilter}
            onChange={(e) =>
              setStudentStandingFilter(e.target.value as 'All' | StudentStanding)
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
          >
            <option value="All">All Standings</option>
            <option value="Excellent">Excellent (90%+)</option>
            <option value="Good">Good (75-89%)</option>
            <option value="At Risk">At Risk (&lt; {lowAttThreshold}%)</option>
            <option value="New">New</option>
            <option value="Exited">Exited / Left</option>
          </select>
        )}
      </div>

      {/* Report 1: Total Admission Report */}
      {activeTab === 'admissions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Total Enrollments</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {admissionsData.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Active in Selection</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
                {admissionsData.filter((s) => s.status === 'Active').length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Monthly Revenue Potential</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-sky-700 tabular-nums">
                {formatCurrency(
                  admissionsData
                    .filter((s) => s.status === 'Active')
                    .reduce((sum, s) => sum + s.monthlyFee, 0),
                  currency
                )}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">Student ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Gender</th>
                  <th className="px-4 py-3">Course &amp; Batch</th>
                  <th className="px-4 py-3">Admission Date</th>
                  <th className="px-4 py-3 text-right">Monthly Fee</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {admissionsData.map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-2.5 font-mono text-xs font-semibold">{s.id}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{s.name}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{s.gender}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-700">
                      {s.course} · <span className="font-mono">{s.batchId}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{s.admissionDate}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                      {formatCurrency(s.monthlyFee, currency)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs font-medium">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 2: Batch-Wise Admission Report */}
      {activeTab === 'batch-wise' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-5 py-3">Batch</th>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Timing</th>
                <th className="px-4 py-3 text-right">Capacity</th>
                <th className="px-4 py-3 text-right">Active Enrolled</th>
                <th className="px-4 py-3 text-right">Left</th>
                <th className="px-4 py-3 text-right">Seats Available</th>
                <th className="px-5 py-3 text-right">Occupancy %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batchWiseData.map(({ batch, metrics }) => (
                <tr key={batch.id}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{batch.batchName}</div>
                    <div className="font-mono text-xs text-slate-500">
                      {batch.id} · {batch.course}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">{batch.assignedTeacher}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {batch.days} · {batch.time}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                    {batch.maxCapacity}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                    {metrics.activeCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-red-700 tabular-nums">
                    {metrics.leftCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                    {metrics.seatsLeft}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-sky-700 tabular-nums">
                    {metrics.occupancyPct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Report 3: Left / Dropout Students Report */}
      {activeTab === 'dropouts' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-5 py-3">Student ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Course / Batch</th>
                <th className="px-4 py-3">Admission Date</th>
                <th className="px-4 py-3">Left Date</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-5 py-3 text-right">Unpaid Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dropoutData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-500">
                    No left/dropout students found in this date range.
                  </td>
                </tr>
              ) : (
                dropoutData.map(({ student, duration, unpaidBalance }) => (
                  <tr key={student.id}>
                    <td className="px-5 py-3 font-mono text-xs font-semibold">{student.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{student.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {student.course} · <span className="font-mono">{student.batchId}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {student.admissionDate}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-red-700">
                      {student.leftDate || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{duration}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {student.leftReason || '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-red-700 tabular-nums">
                      {formatCurrency(unpaidBalance, currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Report 4: Fees Collection Report */}
      {activeTab === 'fee-collection' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Total Billed</p>
              <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                {formatCurrency(
                  feeCollectionData.reduce((s, f) => s + f.feeAmount, 0),
                  currency
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Total Discounts</p>
              <p className="mt-1 font-mono text-xl font-semibold text-slate-700 tabular-nums">
                {formatCurrency(
                  feeCollectionData.reduce((s, f) => s + f.discount, 0),
                  currency
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Net Collected</p>
              <p className="mt-1 font-mono text-xl font-semibold text-emerald-700 tabular-nums">
                {formatCurrency(
                  feeCollectionData.reduce((s, f) => s + f.amountPaid, 0),
                  currency
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Pending Balance</p>
              <p className="mt-1 font-mono text-xl font-semibold text-amber-700 tabular-nums">
                {formatCurrency(
                  feeCollectionData.reduce((s, f) => s + computeFeeBalance(f), 0),
                  currency
                )}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">Fee ID</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Payment Date</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3 text-right">Billed</th>
                  <th className="px-4 py-3 text-right">Discount</th>
                  <th className="px-5 py-3 text-right">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feeCollectionData.map((f) => (
                  <tr key={f.id}>
                    <td className="px-5 py-2.5 font-mono text-xs font-semibold">{f.id}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-900">{f.studentName}</span>
                      <span className="ml-1.5 font-mono text-xs text-slate-500">{f.studentId}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{f.month}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                      {f.paymentDate || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-700">
                      {f.paymentMethod || 'Unpaid'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                      {formatCurrency(f.feeAmount, currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-500 tabular-nums">
                      {formatCurrency(f.discount, currency)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                      {formatCurrency(f.amountPaid, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 5: Fee Recovery / Defaulters Report */}
      {activeTab === 'defaulters' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-5 py-3">Student ID</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Parent Phone</th>
                <th className="px-4 py-3">Months Pending</th>
                <th className="px-4 py-3 text-right">Total Due</th>
                <th className="no-print px-5 py-3 text-right">Recovery Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {defaultersData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                    Zero pending fee defaulters. All accounts are settled.
                  </td>
                </tr>
              ) : (
                defaultersData.map((d) => {
                  const msg = buildWhatsAppMessage('Overdue Fee', {
                    academyName: db.settings.academyName,
                    studentName: d.studentName,
                    studentId: d.studentId,
                    course: d.course,
                    month: d.monthsPending.join(', '),
                    monthlyFee: d.totalDue,
                    outstanding: d.totalDue,
                    currency,
                  });
                  const waUrl = buildWhatsAppUrl(d.parentPhone, msg);

                  return (
                    <tr key={d.studentId}>
                      <td className="px-5 py-3 font-mono text-xs font-semibold">{d.studentId}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{d.studentName}</div>
                        <div className="text-xs text-slate-500">{d.course}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{d.parentPhone}</td>
                      <td className="px-4 py-3 font-mono text-xs text-amber-700">
                        {d.monthsPending.join(', ')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-red-700 tabular-nums">
                        {formatCurrency(d.totalDue, currency)}
                      </td>
                      <td className="no-print px-5 py-3 text-right">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() =>
                            onLogWhatsApp({
                              studentId: d.studentId,
                              studentName: d.studentName,
                              phone: d.parentPhone,
                              messageType: 'Overdue Fee',
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Send WhatsApp
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Report 6: Accounts - Expenses with All Heads */}
      {activeTab === 'expenses-heads' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Total Expenses (All Heads)</p>
              <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                {formatCurrency(totalPeriodExpenses, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {periodExpensesAllHeads.length} voucher entries
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Salary Head Expense</p>
              <p className="mt-1 font-mono text-xl font-semibold text-sky-700 tabular-nums">
                {formatCurrency(salaryHeadSpend, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Payroll &amp; wages</p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Operating Overheads</p>
              <p className="mt-1 font-mono text-xl font-semibold text-amber-700 tabular-nums">
                {formatCurrency(totalPeriodExpenses - salaryHeadSpend, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Rent, utilities, marketing &amp; misc</p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Top Expense Head</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {highestExpenseHead && highestExpenseHead.total > 0
                  ? highestExpenseHead.head
                  : '—'}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                {highestExpenseHead && highestExpenseHead.total > 0
                  ? `${formatCurrency(highestExpenseHead.total, currency)} (${highestExpenseHead.sharePct}%)`
                  : 'No expenses logged'}
              </p>
            </div>
          </div>

          {/* All 7 Expense Heads Summary Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Expense Summary Across All Heads
                </h2>
                <p className="text-xs text-slate-500">
                  Click any head to filter the itemized ledger below
                </p>
              </div>
              {expenseHeadFilter !== 'All' && (
                <button
                  type="button"
                  onClick={() => setExpenseHeadFilter('All')}
                  className="no-print text-xs font-medium text-sky-700 hover:underline"
                >
                  Show All Heads
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Expense Head</th>
                    <th className="px-4 py-3 text-right">Entries</th>
                    <th className="px-4 py-3 text-right">Total Spend</th>
                    <th className="px-4 py-3 text-right">Share %</th>
                    <th className="px-5 py-3">Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenseHeadSummary.map((row) => {
                    const isSelected = expenseHeadFilter === row.head;
                    return (
                      <tr
                        key={row.head}
                        onClick={() =>
                          setExpenseHeadFilter(isSelected ? 'All' : row.head)
                        }
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-sky-50/70' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-5 py-2.5 font-medium text-slate-900">
                          {row.head}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-600 tabular-nums">
                          {row.count}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(row.total, currency)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700 tabular-nums">
                          {row.sharePct}%
                        </td>
                        <td className="px-5 py-2.5">
                          <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-sky-700"
                              style={{ width: `${row.sharePct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900">
                  <tr>
                    <td className="px-5 py-2.5">Total All Heads</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {periodExpensesAllHeads.length}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {formatCurrency(totalPeriodExpenses, currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {totalPeriodExpenses > 0 ? '100%' : '0%'}
                    </td>
                    <td className="px-5 py-2.5" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Itemized Expense Ledger */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">
                Expense Ledger {expenseHeadFilter !== 'All' ? `· ${expenseHeadFilter}` : '· All Heads'}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Expense ID</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Expense Head</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Paid By</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenseEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                        No expense entries found for the selected head and period.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenseEntries.map((e) => (
                      <tr key={e.id}>
                        <td className="px-5 py-2.5 font-mono text-xs font-semibold text-slate-900">
                          {e.id}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{e.date}</td>
                        <td className="px-4 py-2.5 text-xs font-medium text-slate-800">
                          {e.category}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-700">{e.description}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{e.paidBy}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(e.amount, currency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Report 7: Accounts - Salaries & Payroll */}
      {activeTab === 'salaries-payroll' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Total Payroll Net</p>
              <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                {formatCurrency(totalPayrollNet, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500">{salariesData.length} salary slips</p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Disbursed / Paid</p>
              <p className="mt-1 font-mono text-xl font-semibold text-emerald-700 tabular-nums">
                {formatCurrency(totalPayrollPaid, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {salariesData.filter((p) => p.status === 'Paid').length} paid slips
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Pending Disbursement</p>
              <p className="mt-1 font-mono text-xl font-semibold text-amber-700 tabular-nums">
                {formatCurrency(totalPayrollPending, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Draft &amp; approved</p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Deductions &amp; Advances</p>
              <p className="mt-1 font-mono text-xl font-semibold text-red-700 tabular-nums">
                {formatCurrency(totalPayrollDeductions, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Recovered in payroll</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Payroll ID</th>
                    <th className="px-4 py-3">Staff Member</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3 text-right">Days</th>
                    <th className="px-4 py-3 text-right">Base + Allow</th>
                    <th className="px-4 py-3 text-right">Bonus / OT</th>
                    <th className="px-4 py-3 text-right">Deductions</th>
                    <th className="px-4 py-3 text-right">Net Salary</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salariesData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-5 py-8 text-center text-sm text-slate-500">
                        No payroll records match your filters.
                      </td>
                    </tr>
                  ) : (
                    salariesData.map((p) => {
                      const baseAllow = (p.baseSalary || 0) + (p.allowances || 0);
                      const bonusOt = (p.bonuses || 0) + (p.overtimePay || 0);
                      const deduct = (p.deductions || 0) + (p.advanceRecovery || 0);
                      return (
                        <tr key={p.id}>
                          <td className="px-5 py-2.5 font-mono text-xs font-semibold text-slate-900">
                            {p.id}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-slate-900">{p.staffName}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {p.staffId} · {p.designation}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-700">{p.department}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{p.month}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-600 tabular-nums">
                            {p.presentDays}/{p.workingDays}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700 tabular-nums">
                            {formatCurrency(baseAllow, currency)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-emerald-700 tabular-nums">
                            {formatCurrency(bonusOt, currency)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-red-700 tabular-nums">
                            {formatCurrency(deduct, currency)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                            {formatCurrency(p.netSalary, currency)}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-600">
                            <div>{p.paymentMethod || 'Pending'}</div>
                            {p.paymentDate && (
                              <div className="font-mono text-[11px] text-slate-400">
                                {p.paymentDate}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <span
                              className={`text-xs font-medium ${
                                p.status === 'Paid'
                                  ? 'text-emerald-700'
                                  : p.status === 'Approved'
                                    ? 'text-sky-700'
                                    : 'text-amber-700'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Report 8: Staff Performance Report */}
      {activeTab === 'staff-performance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Staff Evaluated</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {staffPerformanceData.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {staffPerformanceData.filter((r) => r.staff.status === 'Active').length} active
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Avg Staff Attendance</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
                {avgStaffAttPct}%
              </p>
              <p className="mt-1 text-xs text-slate-500">From payroll working days</p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Faculty Retention Avg</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-sky-700 tabular-nums">
                {avgFacultyRetention}%
              </p>
              <p className="mt-1 text-xs text-slate-500">Active vs exited students</p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">High Performers</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {staffPerformanceData.filter((r) => r.band === 'High Performer').length}
              </p>
              <p className="mt-1 text-xs text-slate-500">90%+ score or merit bonus</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Staff ID</th>
                    <th className="px-4 py-3">Name &amp; Designation</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Operational / Academic Output</th>
                    <th className="px-4 py-3 text-right">Attendance</th>
                    <th className="px-4 py-3 text-right">Retention</th>
                    <th className="px-4 py-3 text-right">Class Att.</th>
                    <th className="px-4 py-3 text-right">Score</th>
                    <th className="px-5 py-3 text-right">Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffPerformanceData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-8 text-center text-sm text-slate-500">
                        No staff members match your filters.
                      </td>
                    </tr>
                  ) : (
                    staffPerformanceData.map((r) => (
                      <tr key={r.staff.id}>
                        <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-900">
                          {r.staff.id}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{r.staff.name}</div>
                          <div className="text-xs text-slate-500">{r.staff.designation}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">{r.staff.department}</td>
                        <td className="px-4 py-3 text-xs text-slate-700">{r.kpiHighlight}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                          {r.attendancePct !== null ? `${r.attendancePct}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                          {r.retentionPct !== null ? `${r.retentionPct}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                          {r.classAttendancePct !== null ? `${r.classAttendancePct}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {r.overallScore}%
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span
                            className={`text-xs font-semibold ${
                              r.band === 'High Performer'
                                ? 'text-emerald-700'
                                : r.band === 'Needs Review'
                                  ? 'text-red-700'
                                  : 'text-sky-700'
                            }`}
                          >
                            {r.band}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Report 9: Students Performance Report */}
      {activeTab === 'students-performance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Students Evaluated</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {studentsPerformanceData.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Avg Attendance Rate</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-sky-700 tabular-nums">
                {avgStudentAtt}%
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">Excellent Standing (90%+)</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
                {
                  studentsPerformanceData.filter((r) => r.standing === 'Excellent')
                    .length
                }
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
              <p className="text-xs text-slate-500">At Risk (&lt; {lowAttThreshold}%)</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-red-700 tabular-nums">
                {
                  studentsPerformanceData.filter((r) => r.standing === 'At Risk')
                    .length
                }
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Student ID</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Course &amp; Batch</th>
                    <th className="px-4 py-3">Trainer</th>
                    <th className="px-4 py-3 text-right">Sessions</th>
                    <th className="px-4 py-3 text-right">P / L / A</th>
                    <th className="px-4 py-3 text-right">Attendance %</th>
                    {!isTrainer && <th className="px-4 py-3 text-right">Pending Fee</th>}
                    <th className="px-5 py-3 text-right">Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentsPerformanceData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isTrainer ? 8 : 9}
                        className="px-5 py-8 text-center text-sm text-slate-500"
                      >
                        No students match your filters.
                      </td>
                    </tr>
                  ) : (
                    studentsPerformanceData.map((r) => (
                      <tr key={r.student.id}>
                        <td className="px-5 py-2.5 font-mono text-xs font-semibold text-slate-900">
                          {r.student.id}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          {r.student.name}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-700">
                          {r.student.course} ·{' '}
                          <span className="font-mono text-slate-500">{r.student.batchId}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{r.student.teacher}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-600 tabular-nums">
                          {r.totalSessions}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700 tabular-nums">
                          {r.present}/{r.late}/{r.absent}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold tabular-nums">
                          {r.attendancePct === null ? (
                            <span className="text-slate-400">New</span>
                          ) : (
                            <span
                              className={
                                r.attendancePct < lowAttThreshold
                                  ? 'text-red-700'
                                  : r.attendancePct >= 90
                                    ? 'text-emerald-700'
                                    : 'text-slate-800'
                              }
                            >
                              {r.attendancePct}%
                            </span>
                          )}
                        </td>
                        {!isTrainer && (
                          <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                            <span
                              className={
                                r.outstanding > 0 ? 'font-semibold text-amber-700' : 'text-slate-600'
                              }
                            >
                              {formatCurrency(r.outstanding, currency)}
                            </span>
                          </td>
                        )}
                        <td className="px-5 py-2.5 text-right">
                          <span
                            className={`text-xs font-semibold ${
                              r.standing === 'Excellent'
                                ? 'text-emerald-700'
                                : r.standing === 'At Risk'
                                  ? 'text-red-700'
                                  : r.standing === 'Exited'
                                    ? 'text-slate-500'
                                    : 'text-sky-700'
                            }`}
                          >
                            {r.standing}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
