import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  Edit2,
  FilePlus2,
  Plus,
  Printer,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  AcademyDatabase,
  EmploymentType,
  PaymentMethod,
  PayrollRecord,
  PayrollStatus,
  StaffDepartment,
  StaffMember,
  StaffStatus,
} from '../types/academy';
import {
  exportToCsv,
  formatCurrency,
  getMonthLabel,
  TODAY_ISO,
  triggerA4Print,
} from '../utils/calculations';
import { MTSLogo } from './MTSLogo';

interface HRDepartmentViewProps {
  db: AcademyDatabase;
  onSaveStaff: (staff: Omit<StaffMember, 'id'> & { id?: string }) => void;
  onDeleteStaff: (id: string) => void;
  onImportTeachersToHR: () => number;
  onGeneratePayroll: (params: {
    scope: 'all' | 'single';
    staffId: string;
    month: string;
    workingDays: number;
    remarks: string;
  }) => void;
  onSavePayroll: (record: PayrollRecord) => void;
  onPayPayroll: (
    payrollId: string,
    payment: {
      paymentDate: string;
      paymentMethod: PaymentMethod;
      logExpense: boolean;
    }
  ) => void;
  onDeletePayroll: (id: string) => void;
}

const DEPARTMENTS: StaffDepartment[] = [
  'Academic / Faculty',
  'Admissions',
  'Administration',
  'Finance',
  'Support & Operations',
];

const EMPLOYMENT_TYPES: EmploymentType[] = [
  'Full-Time',
  'Part-Time',
  'Contract',
  'Visiting',
];

export const HRDepartmentView: React.FC<HRDepartmentViewProps> = ({
  db,
  onSaveStaff,
  onDeleteStaff,
  onImportTeachersToHR,
  onGeneratePayroll,
  onSavePayroll,
  onPayPayroll,
  onDeletePayroll,
}) => {
  const [subTab, setSubTab] = useState<'staff' | 'payroll' | 'structure'>('staff');
  const currency = db.settings.currency || 'PKR';

  // Staff Directory filters
  const [staffSearch, setStaffSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<'All' | StaffDepartment>('All');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'All' | StaffStatus>('All');

  // Add/Edit Staff modal
  const [staffModal, setStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [stName, setStName] = useState('');
  const [stFather, setStFather] = useState('');
  const [stPhone, setStPhone] = useState('');
  const [stEmail, setStEmail] = useState('');
  const [stCnic, setStCnic] = useState('');
  const [stDesignation, setStDesignation] = useState('');
  const [stDepartment, setStDepartment] = useState<StaffDepartment>('Academic / Faculty');
  const [stEmpType, setStEmpType] = useState<EmploymentType>('Full-Time');
  const [stJoinDate, setStJoinDate] = useState(TODAY_ISO);
  const [stBaseSalary, setStBaseSalary] = useState(40000);
  const [stAllowance, setStAllowance] = useState(3000);
  const [stBankAccount, setStBankAccount] = useState('');
  const [stLinkedTeacherId, setStLinkedTeacherId] = useState('');
  const [stStatus, setStStatus] = useState<StaffStatus>('Active');
  const [stEmergency, setStEmergency] = useState('');

  // Printable Staff Profile / Letterhead modal
  const [printingStaff, setPrintingStaff] = useState<StaffMember | null>(null);

  // Payroll filters
  const [payrollSearch, setPayrollSearch] = useState('');
  const [payrollMonthFilter, setPayrollMonthFilter] = useState<string>('All');
  const [payrollDeptFilter, setPayrollDeptFilter] = useState<'All' | StaffDepartment>('All');
  const [payrollStatusFilter, setPayrollStatusFilter] = useState<'All' | PayrollStatus>('All');

  // Generate Payroll modal
  const [genPayrollModal, setGenPayrollModal] = useState(false);
  const [genScope, setGenScope] = useState<'all' | 'single'>('all');
  const [genStaffSearch, setGenStaffSearch] = useState('');
  const [genStaffId, setGenStaffId] = useState(db.hrStaff[0]?.id || '');
  const [genMonth, setGenMonth] = useState(getMonthLabel());
  const [genWorkingDays, setGenWorkingDays] = useState(26);
  const [genRemarks, setGenRemarks] = useState('');

  // Edit / Calculate Payroll modal
  const [editingPayroll, setEditingPayroll] = useState<PayrollRecord | null>(null);
  const [pWorkingDays, setPWorkingDays] = useState(26);
  const [pPresentDays, setPPresentDays] = useState(26);
  const [pLeaveDays, setPLeaveDays] = useState(0);
  const [pBaseSalary, setPBaseSalary] = useState(0);
  const [pAllowances, setPAllowances] = useState(0);
  const [pBonuses, setPBonuses] = useState(0);
  const [pOvertime, setPOvertime] = useState(0);
  const [pDeductions, setPDeductions] = useState(0);
  const [pAdvance, setPAdvance] = useState(0);
  const [pStatus, setPStatus] = useState<PayrollStatus>('Draft');
  const [pRemarks, setPRemarks] = useState('');

  // Pay Salary modal
  const [payingPayroll, setPayingPayroll] = useState<PayrollRecord | null>(null);
  const [payDate, setPayDate] = useState(TODAY_ISO);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Bank Transfer');
  const [payLogExpense, setPayLogExpense] = useState(true);

  // Printable Payslip modal
  const [payslipRecord, setPayslipRecord] = useState<PayrollRecord | null>(null);

  // Import banner
  const [hrNotice, setHrNotice] = useState<string | null>(null);

  const staffById = useMemo(
    () => new Map(db.hrStaff.map((s) => [s.id, s])),
    [db.hrStaff]
  );

  const unlinkedTeachersCount = useMemo(() => {
    return db.teachers.filter(
      (t) =>
        !db.hrStaff.some(
          (s) => s.linkedTeacherId === t.id || s.name.toLowerCase() === t.name.toLowerCase()
        )
    ).length;
  }, [db.teachers, db.hrStaff]);

  const distinctPayrollMonths = useMemo(
    () => Array.from(new Set(db.payroll.map((p) => p.month))).filter(Boolean),
    [db.payroll]
  );

  // KPI Metrics
  const kpis = useMemo(() => {
    const activeStaff = db.hrStaff.filter((s) => s.status === 'Active');
    const fixedMonthly = activeStaff.reduce(
      (sum, s) => sum + (s.baseSalary || 0) + (s.defaultAllowance || 0),
      0
    );
    const scopePayroll =
      payrollMonthFilter === 'All'
        ? db.payroll
        : db.payroll.filter((p) => p.month === payrollMonthFilter);
    const paidTotal = scopePayroll
      .filter((p) => p.status === 'Paid')
      .reduce((sum, p) => sum + p.netSalary, 0);
    const pendingTotal = scopePayroll
      .filter((p) => p.status !== 'Paid')
      .reduce((sum, p) => sum + p.netSalary, 0);

    return {
      totalStaff: db.hrStaff.length,
      activeCount: activeStaff.length,
      fixedMonthly,
      paidTotal,
      pendingTotal,
    };
  }, [db.hrStaff, db.payroll, payrollMonthFilter]);

  // Filtered Staff
  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    return db.hrStaff
      .filter((s) => (deptFilter === 'All' ? true : s.department === deptFilter))
      .filter((s) => (staffStatusFilter === 'All' ? true : s.status === staffStatusFilter))
      .filter((s) => {
        if (!q) return true;
        return (
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.designation.toLowerCase().includes(q) ||
          s.department.toLowerCase().includes(q) ||
          s.phone.includes(q) ||
          s.cnic.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
        );
      });
  }, [db.hrStaff, staffSearch, deptFilter, staffStatusFilter]);

  // Filtered Payroll
  const filteredPayroll = useMemo(() => {
    const q = payrollSearch.trim().toLowerCase();
    return db.payroll
      .filter((p) => (payrollMonthFilter === 'All' ? true : p.month === payrollMonthFilter))
      .filter((p) => (payrollDeptFilter === 'All' ? true : p.department === payrollDeptFilter))
      .filter((p) => (payrollStatusFilter === 'All' ? true : p.status === payrollStatusFilter))
      .filter((p) => {
        if (!q) return true;
        return (
          p.id.toLowerCase().includes(q) ||
          p.staffId.toLowerCase().includes(q) ||
          p.staffName.toLowerCase().includes(q) ||
          p.designation.toLowerCase().includes(q) ||
          p.department.toLowerCase().includes(q) ||
          p.month.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.id.localeCompare(a.id));
  }, [
    db.payroll,
    payrollMonthFilter,
    payrollDeptFilter,
    payrollStatusFilter,
    payrollSearch,
  ]);

  const payrollTotals = useMemo(() => {
    return filteredPayroll.reduce(
      (acc, p) => {
        acc.base += p.baseSalary;
        acc.allowances += p.allowances + p.bonuses + p.overtimePay;
        acc.deductions += p.deductions + p.advanceRecovery;
        acc.net += p.netSalary;
        return acc;
      },
      { base: 0, allowances: 0, deductions: 0, net: 0 }
    );
  }, [filteredPayroll]);

  // Staff search inside Generate Payroll modal
  const modalFilteredStaff = useMemo(() => {
    const q = genStaffSearch.trim().toLowerCase();
    return db.hrStaff.filter((s) => {
      if (!q) return s.status === 'Active';
      return (
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.designation.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
      );
    });
  }, [db.hrStaff, genStaffSearch]);

  // Department structure summary
  const departmentSummary = useMemo(() => {
    return DEPARTMENTS.map((dept) => {
      const members = db.hrStaff.filter((s) => s.department === dept && s.status === 'Active');
      const baseTotal = members.reduce((sum, s) => sum + s.baseSalary, 0);
      const allowTotal = members.reduce((sum, s) => sum + s.defaultAllowance, 0);
      const total = baseTotal + allowTotal;
      return {
        dept,
        headcount: members.length,
        baseTotal,
        allowTotal,
        total,
        sharePct: kpis.fixedMonthly > 0 ? Math.round((total / kpis.fixedMonthly) * 100) : 0,
      };
    });
  }, [db.hrStaff, kpis.fixedMonthly]);

  const showNotice = (msg: string) => {
    setHrNotice(msg);
    setTimeout(() => setHrNotice(null), 3500);
  };

  const openNewStaffModal = () => {
    setEditingStaff(null);
    setStName('');
    setStFather('');
    setStPhone('');
    setStEmail('');
    setStCnic('');
    setStDesignation('');
    setStDepartment('Academic / Faculty');
    setStEmpType('Full-Time');
    setStJoinDate(TODAY_ISO);
    setStBaseSalary(35000);
    setStAllowance(3000);
    setStBankAccount('');
    setStLinkedTeacherId('');
    setStStatus('Active');
    setStEmergency('');
    setStaffModal(true);
  };

  const openEditStaffModal = (s: StaffMember) => {
    setEditingStaff(s);
    setStName(s.name);
    setStFather(s.fatherName);
    setStPhone(s.phone);
    setStEmail(s.email);
    setStCnic(s.cnic);
    setStDesignation(s.designation);
    setStDepartment(s.department);
    setStEmpType(s.employmentType);
    setStJoinDate(s.joiningDate);
    setStBaseSalary(s.baseSalary);
    setStAllowance(s.defaultAllowance);
    setStBankAccount(s.bankAccount);
    setStLinkedTeacherId(s.linkedTeacherId || '');
    setStStatus(s.status);
    setStEmergency(s.emergencyContact);
    setStaffModal(true);
  };

  const handleTeacherLinkSelect = (teacherId: string) => {
    setStLinkedTeacherId(teacherId);
    const t = db.teachers.find((item) => item.id === teacherId);
    if (t && !editingStaff) {
      setStName(t.name);
      setStPhone(t.phone);
      setStDesignation(`${t.subject} Trainer`);
      setStDepartment('Academic / Faculty');
      setStBaseSalary(t.monthlySalary);
    }
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveStaff({
      id: editingStaff?.id,
      name: stName.trim(),
      fatherName: stFather.trim(),
      phone: stPhone.trim(),
      email: stEmail.trim(),
      cnic: stCnic.trim(),
      designation: stDesignation.trim(),
      department: stDepartment,
      employmentType: stEmpType,
      joiningDate: stJoinDate,
      baseSalary: Number(stBaseSalary) || 0,
      defaultAllowance: Number(stAllowance) || 0,
      bankAccount: stBankAccount.trim(),
      linkedTeacherId: stLinkedTeacherId || undefined,
      status: stStatus,
      emergencyContact: stEmergency.trim(),
    });
    setStaffModal(false);
  };

  const handleImportTeachers = () => {
    const added = onImportTeachersToHR();
    if (added > 0) {
      showNotice(`Imported ${added} faculty member(s) into HR Staff Directory.`);
    } else {
      showNotice('All existing faculty teachers are already listed in HR Staff.');
    }
  };

  const openGeneratePayrollModal = () => {
    setGenScope('all');
    setGenStaffSearch('');
    setGenStaffId(db.hrStaff.find((s) => s.status === 'Active')?.id || db.hrStaff[0]?.id || '');
    setGenMonth(getMonthLabel());
    setGenWorkingDays(26);
    setGenRemarks('');
    setGenPayrollModal(true);
  };

  const handleGeneratePayrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGeneratePayroll({
      scope: genScope,
      staffId: genStaffId,
      month: genMonth.trim() || getMonthLabel(),
      workingDays: Math.max(1, Number(genWorkingDays) || 26),
      remarks: genRemarks.trim(),
    });
    setGenPayrollModal(false);
  };

  const openEditPayrollModal = (p: PayrollRecord) => {
    setEditingPayroll(p);
    setPWorkingDays(p.workingDays);
    setPPresentDays(p.presentDays);
    setPLeaveDays(p.leaveDays);
    setPBaseSalary(p.baseSalary);
    setPAllowances(p.allowances);
    setPBonuses(p.bonuses);
    setPOvertime(p.overtimePay);
    setPDeductions(p.deductions);
    setPAdvance(p.advanceRecovery);
    setPStatus(p.status);
    setPRemarks(p.remarks);
  };

  const computedModalNet = Math.max(
    0,
    (Number(pBaseSalary) || 0) +
      (Number(pAllowances) || 0) +
      (Number(pBonuses) || 0) +
      (Number(pOvertime) || 0) -
      (Number(pDeductions) || 0) -
      (Number(pAdvance) || 0)
  );

  const handleProrateLeaveDeduction = () => {
    const wd = Math.max(1, Number(pWorkingDays) || 26);
    const leaves = Math.max(0, Number(pLeaveDays) || 0);
    const dailyRate = (Number(pBaseSalary) || 0) / wd;
    setPDeductions(Math.round(dailyRate * leaves));
  };

  const handleEditPayrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayroll) return;
    onSavePayroll({
      ...editingPayroll,
      workingDays: Math.max(1, Number(pWorkingDays) || 26),
      presentDays: Math.max(0, Number(pPresentDays) || 0),
      leaveDays: Math.max(0, Number(pLeaveDays) || 0),
      baseSalary: Number(pBaseSalary) || 0,
      allowances: Number(pAllowances) || 0,
      bonuses: Number(pBonuses) || 0,
      overtimePay: Number(pOvertime) || 0,
      deductions: Number(pDeductions) || 0,
      advanceRecovery: Number(pAdvance) || 0,
      netSalary: computedModalNet,
      status: pStatus,
      remarks: pRemarks.trim(),
    });
    setEditingPayroll(null);
  };

  const openPayModal = (p: PayrollRecord) => {
    setPayingPayroll(p);
    setPayDate(p.paymentDate || TODAY_ISO);
    setPayMethod(p.paymentMethod || 'Bank Transfer');
    setPayLogExpense(true);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingPayroll) return;
    onPayPayroll(payingPayroll.id, {
      paymentDate: payDate,
      paymentMethod: payMethod,
      logExpense: payLogExpense,
    });
    setPayingPayroll(null);
  };

  const handleExportPayrollCsv = () => {
    exportToCsv(
      'MTS_HR_Payroll_Sheet.csv',
      [
        'Payroll ID',
        'Staff ID',
        'Name',
        'Designation',
        'Department',
        'Month',
        'Working Days',
        'Present Days',
        'Leave Days',
        'Base Salary',
        'Allowances',
        'Bonuses',
        'Overtime',
        'Deductions',
        'Advance Recovery',
        'Net Salary',
        'Status',
        'Payment Date',
        'Payment Method',
      ],
      filteredPayroll.map((p) => [
        p.id,
        p.staffId,
        p.staffName,
        p.designation,
        p.department,
        p.month,
        p.workingDays,
        p.presentDays,
        p.leaveDays,
        p.baseSalary,
        p.allowances,
        p.bonuses,
        p.overtimePay,
        p.deductions,
        p.advanceRecovery,
        p.netSalary,
        p.status,
        p.paymentDate,
        p.paymentMethod,
      ])
    );
  };

  const anyPrintModalOpen = Boolean(payslipRecord || printingStaff);

  return (
    <div className="space-y-5">
      {/* Main Screen Content (hidden when a modal print document like Payslip or Staff Profile is open) */}
      <div className={anyPrintModalOpen ? 'no-print space-y-5' : 'space-y-5'}>
        {/* KPI Strip */}
        <div className="no-print grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-5">
            <p className="text-xs font-medium text-slate-500">Active Staff Roster</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {kpis.activeCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {kpis.totalStaff} total HR profiles
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-5">
            <p className="text-xs font-medium text-slate-500">Monthly Base + Allowance</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {formatCurrency(kpis.fixedMonthly, currency)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Active fixed staff commitment</p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-5">
            <p className="text-xs font-medium text-slate-500">
              Payroll Paid ({payrollMonthFilter === 'All' ? 'All Months' : payrollMonthFilter})
            </p>
            <p className="mt-1.5 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
              {formatCurrency(kpis.paidTotal, currency)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Disbursed salaries</p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-5">
            <p className="text-xs font-medium text-slate-500">Pending Payroll</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
              {formatCurrency(kpis.pendingTotal, currency)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Draft &amp; approved awaiting payout</p>
          </div>
        </div>

        {/* Sub-tab Navigation & Primary Actions */}
        <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] px-5 py-4">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSubTab('staff')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                subTab === 'staff'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Staff Management ({db.hrStaff.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('payroll')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                subTab === 'payroll'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Payroll &amp; Salary Slips ({db.payroll.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('structure')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                subTab === 'structure'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Department Salary Structure
            </button>
          </div>

          {subTab === 'staff' && (
            <div className="flex flex-wrap items-center gap-2">
              {unlinkedTeachersCount > 0 && (
                <button
                  type="button"
                  onClick={handleImportTeachers}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <UserPlus className="h-3.5 w-3.5 text-sky-700" />
                  Import Faculty ({unlinkedTeachersCount})
                </button>
              )}
              <button
                type="button"
                onClick={triggerA4Print}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Roster (A4)
              </button>
              <button
                type="button"
                onClick={openNewStaffModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Staff Member
              </button>
            </div>
          )}

          {subTab === 'payroll' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportPayrollCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={triggerA4Print}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Payroll Sheet (A4)
              </button>
              <button
                type="button"
                onClick={openGeneratePayrollModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                Make Monthly Payroll
              </button>
            </div>
          )}
        </div>

        {hrNotice && (
          <div className="no-print rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
            {hrNotice}
          </div>
        )}

        {/* TAB 1: STAFF MANAGEMENT */}
        {subTab === 'staff' && (
          <>
            {/* Print-Only Header for Staff Roster */}
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
                    HR Department — Staff Directory
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-slate-600">
                    Department: {deptFilter} · Status: {staffStatusFilter}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">Printed: {TODAY_ISO}</div>
                </div>
              </div>
            </div>

            {/* Staff Filter Bar */}
            <div className="no-print flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] px-5 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder="Search Staff ID (EMP-001), name, CNIC, role..."
                  className="w-72 rounded-lg border border-slate-200 py-1.5 pl-9 pr-8 text-xs outline-none focus:border-sky-600"
                />
                {staffSearch && (
                  <button
                    type="button"
                    onClick={() => setStaffSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value as 'All' | StaffDepartment)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                <option value="All">All Departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {(['All', 'Active', 'On Leave', 'Resigned'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStaffStatusFilter(st)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                      staffStatusFilter === st
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Staff Directory Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Staff ID</th>
                      <th className="px-4 py-3">Employee &amp; CNIC</th>
                      <th className="px-4 py-3">Designation &amp; Dept</th>
                      <th className="px-4 py-3">Contact &amp; Account</th>
                      <th className="px-4 py-3 text-right">Base Salary</th>
                      <th className="px-4 py-3 text-right">Allowance</th>
                      <th className="px-4 py-3 text-right">Gross Package</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="no-print px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStaff.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-5 py-10 text-center text-sm text-slate-500">
                          No staff profiles match your search or filter.
                        </td>
                      </tr>
                    ) : (
                      filteredStaff.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-3">
                            <div className="font-mono text-xs font-semibold text-slate-900">{s.id}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              Joined {s.joiningDate}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{s.name}</div>
                            <div className="font-mono text-xs text-slate-500">
                              {s.cnic || 'No CNIC'} · {s.employmentType}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-slate-800">{s.designation}</div>
                            <div className="text-xs text-slate-500">{s.department}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs text-slate-700">{s.phone}</div>
                            <div className="truncate max-w-[200px] text-[11px] text-slate-500">
                              {s.bankAccount || s.email || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                            {formatCurrency(s.baseSalary, currency)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-slate-500 tabular-nums">
                            {s.defaultAllowance > 0 ? formatCurrency(s.defaultAllowance, currency) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                            {formatCurrency(s.baseSalary + s.defaultAllowance, currency)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-medium ${
                                s.status === 'Active'
                                  ? 'text-emerald-700'
                                  : s.status === 'On Leave'
                                    ? 'text-amber-700'
                                    : 'text-red-700'
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td className="no-print px-5 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setPrintingStaff(s)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                                title="Printable HR Staff Record (A4)"
                              >
                                <Printer className="h-3 w-3" />
                                Profile
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditStaffModal(s)}
                                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                title="Edit staff member"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteStaff(s.id)}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                                title="Delete staff member"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: PAYROLL MAKING & SALARY SLIPS */}
        {subTab === 'payroll' && (
          <>
            {/* Print-Only Header for Payroll Sheet */}
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
                    HR Payroll Register
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-slate-600">
                    Month: {payrollMonthFilter} · Dept: {payrollDeptFilter} · Status: {payrollStatusFilter}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">Printed: {TODAY_ISO}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-3 border-t border-slate-200 pt-2 text-xs">
                <div>
                  <span className="text-slate-500">Base Total: </span>
                  <span className="font-mono font-semibold">{formatCurrency(payrollTotals.base, currency)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Add-ons: </span>
                  <span className="font-mono font-semibold text-emerald-700">
                    +{formatCurrency(payrollTotals.allowances, currency)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Deductions: </span>
                  <span className="font-mono font-semibold text-red-700">
                    -{formatCurrency(payrollTotals.deductions, currency)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Net Payable: </span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(payrollTotals.net, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payroll Filter Bar */}
            <div className="no-print flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] px-5 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={payrollSearch}
                  onChange={(e) => setPayrollSearch(e.target.value)}
                  placeholder="Search Staff ID (EMP-001), Pay ID, name..."
                  className="w-68 rounded-lg border border-slate-200 py-1.5 pl-9 pr-8 text-xs outline-none focus:border-sky-600"
                />
                {payrollSearch && (
                  <button
                    type="button"
                    onClick={() => setPayrollSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <select
                value={payrollMonthFilter}
                onChange={(e) => setPayrollMonthFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
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
                onChange={(e) => setPayrollDeptFilter(e.target.value as 'All' | StaffDepartment)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                <option value="All">All Departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {(['All', 'Draft', 'Approved', 'Paid'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setPayrollStatusFilter(st)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                      payrollStatusFilter === st
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Payroll Register Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Pay ID</th>
                      <th className="px-4 py-3">Staff Member</th>
                      <th className="px-4 py-3">Month / Days</th>
                      <th className="px-4 py-3 text-right">Base</th>
                      <th className="px-4 py-3 text-right">Allow / Bonus</th>
                      <th className="px-4 py-3 text-right">Deductions</th>
                      <th className="px-4 py-3 text-right">Net Payable</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="no-print px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPayroll.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-5 py-10 text-center text-sm text-slate-500">
                          No payroll entries found. Click &ldquo;Make Monthly Payroll&rdquo; to generate salaries.
                        </td>
                      </tr>
                    ) : (
                      filteredPayroll.map((p) => {
                        const addOns = p.allowances + p.bonuses + p.overtimePay;
                        const totalDed = p.deductions + p.advanceRecovery;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/70">
                            <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-900">
                              {p.id}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{p.staffName}</div>
                              <div className="font-mono text-xs text-slate-500">
                                {p.staffId} · {p.designation}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-mono text-xs font-medium text-slate-800">
                                {p.month}
                              </div>
                              <div className="font-mono text-[11px] text-slate-500">
                                {p.presentDays}/{p.workingDays} days
                                {p.leaveDays > 0 ? ` · ${p.leaveDays} leave` : ''}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                              {formatCurrency(p.baseSalary, currency)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-emerald-700 tabular-nums">
                              {addOns > 0 ? `+${formatCurrency(addOns, currency)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-red-700 tabular-nums">
                              {totalDed > 0 ? `-${formatCurrency(totalDed, currency)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-900 tabular-nums">
                              {formatCurrency(p.netSalary, currency)}
                            </td>
                            <td className="px-4 py-3">
                              <div
                                className={`text-xs font-semibold ${
                                  p.status === 'Paid'
                                    ? 'text-emerald-700'
                                    : p.status === 'Approved'
                                      ? 'text-sky-700'
                                      : 'text-amber-700'
                                }`}
                              >
                                {p.status}
                              </div>
                              {p.paymentDate && (
                                <div className="font-mono text-[11px] text-slate-400">
                                  {p.paymentDate} · {p.paymentMethod}
                                </div>
                              )}
                            </td>
                            <td className="no-print px-5 py-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                {p.status !== 'Paid' && (
                                  <button
                                    type="button"
                                    onClick={() => openPayModal(p)}
                                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
                                  >
                                    <CreditCard className="h-3 w-3" />
                                    Pay Salary
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setPayslipRecord(p)}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                                  title="Printable A4 Payslip"
                                >
                                  <Printer className="h-3 w-3" />
                                  Slip
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditPayrollModal(p)}
                                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                  title="Adjust bonuses, overtime, leaves, deductions"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeletePayroll(p.id)}
                                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                                  title="Delete payroll entry"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 3: DEPARTMENT SALARY STRUCTURE */}
        {subTab === 'structure' && (
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Department-Wise Monthly Salary Structure
              </h3>
              <p className="text-xs text-slate-500">
                Active staff distribution and recurring monthly payroll budget by department
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Department</th>
                    <th className="px-4 py-3 text-right">Active Headcount</th>
                    <th className="px-4 py-3 text-right">Base Salaries</th>
                    <th className="px-4 py-3 text-right">Default Allowances</th>
                    <th className="px-4 py-3 text-right">Monthly Commitment</th>
                    <th className="px-5 py-3 text-right">Payroll Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departmentSummary.map((row) => (
                    <tr key={row.dept} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-medium text-slate-900">{row.dept}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                        {row.headcount}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                        {formatCurrency(row.baseTotal, currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 tabular-nums">
                        {formatCurrency(row.allowTotal, currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(row.total, currency)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs font-medium text-sky-700 tabular-nums">
                        {row.sharePct}%
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                    <td className="px-5 py-3 text-slate-900">Total Active Institute Payroll</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {kpis.activeCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {formatCurrency(
                        departmentSummary.reduce((s, r) => s + r.baseTotal, 0),
                        currency
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {formatCurrency(
                        departmentSummary.reduce((s, r) => s + r.allowTotal, 0),
                        currency
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-900 tabular-nums">
                      {formatCurrency(kpis.fixedMonthly, currency)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add / Edit Staff Member Modal */}
        {staffModal && (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-sky-700" />
                  <h3 className="text-base font-semibold text-slate-900">
                    {editingStaff ? `Edit Staff ${editingStaff.id}` : 'Add New Staff Member'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setStaffModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleStaffSubmit} className="mt-4 space-y-4">
                {!editingStaff && db.teachers.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Link Existing Faculty Teacher (Optional)
                    </label>
                    <select
                      value={stLinkedTeacherId}
                      onChange={(e) => handleTeacherLinkSelect(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <option value="">None — Non-teaching or new staff member</option>
                      {db.teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.id} — {t.name} ({t.subject})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={stName}
                      onChange={(e) => setStName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Father / Guardian Name</label>
                    <input
                      type="text"
                      value={stFather}
                      onChange={(e) => setStFather(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">CNIC / National ID</label>
                    <input
                      type="text"
                      value={stCnic}
                      onChange={(e) => setStCnic(e.target.value)}
                      placeholder="35202-1234567-1"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Phone *</label>
                    <input
                      type="tel"
                      required
                      value={stPhone}
                      onChange={(e) => setStPhone(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Emergency Contact</label>
                    <input
                      type="tel"
                      value={stEmergency}
                      onChange={(e) => setStEmergency(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Designation *</label>
                    <input
                      type="text"
                      required
                      value={stDesignation}
                      onChange={(e) => setStDesignation(e.target.value)}
                      placeholder="e.g. Admission Officer"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Department *</label>
                    <select
                      value={stDepartment}
                      onChange={(e) => setStDepartment(e.target.value as StaffDepartment)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Employment Type</label>
                    <select
                      value={stEmpType}
                      onChange={(e) => setStEmpType(e.target.value as EmploymentType)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {EMPLOYMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Base Salary ({currency}) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={stBaseSalary}
                      onChange={(e) => setStBaseSalary(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Monthly Allowance ({currency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={stAllowance}
                      onChange={(e) => setStAllowance(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Joining Date</label>
                    <input
                      type="date"
                      required
                      value={stJoinDate}
                      onChange={(e) => setStJoinDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Bank Account / IBAN / Wallet
                    </label>
                    <input
                      type="text"
                      value={stBankAccount}
                      onChange={(e) => setStBankAccount(e.target.value)}
                      placeholder="e.g. HBL · PK45HABB... or JazzCash 0300..."
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Status</label>
                    <select
                      value={stStatus}
                      onChange={(e) => setStStatus(e.target.value as StaffStatus)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Resigned">Resigned</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Work Email</label>
                  <input
                    type="email"
                    value={stEmail}
                    onChange={(e) => setStEmail(e.target.value)}
                    placeholder="staff@mtstrainings.edu.pk"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStaffModal(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
                  >
                    {editingStaff ? 'Update Staff Profile' : 'Save Staff Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Make Monthly Payroll Modal */}
        {genPayrollModal && (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-base font-semibold text-slate-900">
                  Make Monthly Staff Payroll
                </h3>
                <button
                  type="button"
                  onClick={() => setGenPayrollModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleGeneratePayrollSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Payroll Scope</label>
                  <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setGenScope('all')}
                      className={`rounded-md py-1.5 text-xs font-medium ${
                        genScope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      All Active Staff ({kpis.activeCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenScope('single')}
                      className={`rounded-md py-1.5 text-xs font-medium ${
                        genScope === 'single'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      Single Staff Member
                    </button>
                  </div>
                </div>

                {genScope === 'single' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Search &amp; Select Staff Member (by ID, Name, or Designation)
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={genStaffSearch}
                        onChange={(e) => setGenStaffSearch(e.target.value)}
                        placeholder="Search EMP-001, name, department..."
                        className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-sky-600"
                      />
                    </div>
                    <div className="max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                      {modalFilteredStaff.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-slate-500">
                          No staff match &ldquo;{genStaffSearch}&rdquo;
                        </div>
                      ) : (
                        modalFilteredStaff.map((s) => {
                          const isSelected = genStaffId === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setGenStaffId(s.id)}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs ${
                                isSelected ? 'bg-sky-50 text-blue-900' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div>
                                <div className="font-medium text-slate-900">
                                  <span className="font-mono font-semibold">{s.id}</span> — {s.name}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {s.designation} · {formatCurrency(s.baseSalary + s.defaultAllowance, currency)}
                                </div>
                              </div>
                              {isSelected && <Check className="h-4 w-4 text-sky-700" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Payroll Month *</label>
                    <input
                      type="text"
                      required
                      value={genMonth}
                      onChange={(e) => setGenMonth(e.target.value)}
                      placeholder="Nov-2026"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Working Days *</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      required
                      value={genWorkingDays}
                      onChange={(e) => setGenWorkingDays(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Payroll Remarks</label>
                  <input
                    type="text"
                    value={genRemarks}
                    onChange={(e) => setGenRemarks(e.target.value)}
                    placeholder="e.g. Monthly regular salary run"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <p className="text-xs text-slate-500">
                  Existing payroll entries for the same employee and month are skipped automatically. You can adjust bonuses, overtime, leaves, or deductions on each slip after generation.
                </p>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setGenPayrollModal(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
                  >
                    Generate Payroll
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit / Calculate Payroll Modal */}
        {editingPayroll && (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
            <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Calculate &amp; Adjust Payroll · {editingPayroll.id}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingPayroll.staffId} · {editingPayroll.staffName} ({editingPayroll.month})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPayroll(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleEditPayrollSubmit} className="mt-4 space-y-4">
                <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700">Working Days</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={pWorkingDays}
                      onChange={(e) => {
                        const wd = Math.max(1, Number(e.target.value) || 1);
                        setPWorkingDays(wd);
                        setPLeaveDays(Math.max(0, wd - pPresentDays));
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700">Present Days</label>
                    <input
                      type="number"
                      min={0}
                      max={31}
                      value={pPresentDays}
                      onChange={(e) => {
                        const pres = Math.max(0, Number(e.target.value) || 0);
                        setPPresentDays(pres);
                        setPLeaveDays(Math.max(0, pWorkingDays - pres));
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700">Leave Days</label>
                    <input
                      type="number"
                      min={0}
                      max={31}
                      value={pLeaveDays}
                      onChange={(e) => setPLeaveDays(Math.max(0, Number(e.target.value) || 0))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Base Salary ({currency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={pBaseSalary}
                      onChange={(e) => setPBaseSalary(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Allowances ({currency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={pAllowances}
                      onChange={(e) => setPAllowances(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Bonuses / Incentives ({currency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={pBonuses}
                      onChange={(e) => setPBonuses(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Overtime Pay ({currency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={pOvertime}
                      onChange={(e) => setPOvertime(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-slate-700">
                        Leave / Tax Deductions ({currency})
                      </label>
                      {pLeaveDays > 0 && (
                        <button
                          type="button"
                          onClick={handleProrateLeaveDeduction}
                          className="text-[11px] font-medium text-sky-700 hover:underline"
                        >
                          Pro-rate {pLeaveDays}d
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={pDeductions}
                      onChange={(e) => setPDeductions(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Advance Recovery ({currency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={pAdvance}
                      onChange={(e) => setPAdvance(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Approval Status</label>
                    <select
                      value={pStatus}
                      onChange={(e) => setPStatus(e.target.value as PayrollStatus)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Approved">Approved</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Remarks</label>
                    <input
                      type="text"
                      value={pRemarks}
                      onChange={(e) => setPRemarks(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-xs font-medium text-slate-600">Net Salary Payable</span>
                  <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                    {formatCurrency(computedModalNet, currency)}
                  </span>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingPayroll(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
                  >
                    Save Payroll Calculation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Pay Salary Modal */}
        {payingPayroll && (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Disburse Staff Salary</h3>
                  <p className="text-xs text-slate-500">
                    {payingPayroll.id} · {payingPayroll.staffName} ({payingPayroll.month})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPayingPayroll(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handlePaySubmit} className="mt-4 space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-xs">
                  <span className="text-slate-600">Net Payable Salary</span>
                  <span className="font-mono text-base font-bold text-emerald-700">
                    {formatCurrency(payingPayroll.netSalary, currency)}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Payment Date *</label>
                    <input
                      type="date"
                      required
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Payment Method *</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="JazzCash">JazzCash</option>
                      <option value="EasyPaisa">EasyPaisa</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={payLogExpense}
                    onChange={(e) => setPayLogExpense(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-700"
                  />
                  <span>
                    Automatically record as a <strong className="font-semibold">Salary</strong> expense in Expenses &amp; Finance
                  </span>
                </label>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPayingPayroll(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm Salary Paid
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Printable A4 Payslip Modal */}
      {payslipRecord && (
        <div className="print-modal-root fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div className="print-modal-card max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 shadow-xl">
            <div className="no-print mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Official Salary Payslip (A4 · Narrow Margins)
                </h3>
                <p className="text-xs text-slate-500">
                  {payslipRecord.id} · {payslipRecord.staffName} ({payslipRecord.month})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerA4Print}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Payslip (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setPayslipRecord(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {(() => {
              const emp = staffById.get(payslipRecord.staffId);
              const grossEarnings =
                payslipRecord.baseSalary +
                payslipRecord.allowances +
                payslipRecord.bonuses +
                payslipRecord.overtimePay;
              const totalDeductions =
                payslipRecord.deductions + payslipRecord.advanceRecovery;

              return (
                <div className="print-a4-sheet space-y-4 text-slate-900">
                  <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
                    <div className="flex items-center gap-3">
                      <MTSLogo size="lg" className="border border-slate-200" />
                      <div>
                        <h1 className="text-xl font-bold text-slate-900">
                          {db.settings.academyName}
                        </h1>
                        <p className="text-xs text-slate-600">{db.settings.address}</p>
                        <p className="font-mono text-xs text-slate-600">
                          Tel: {db.settings.phone} · Email: {db.settings.email}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold uppercase tracking-wider text-sky-800">
                        Salary Payslip
                      </div>
                      <div className="mt-1 font-mono text-base font-bold text-slate-900">
                        {payslipRecord.id}
                      </div>
                      <div className="font-mono text-xs text-slate-600">
                        Pay Period: {payslipRecord.month}
                      </div>
                      <div className="text-xs font-semibold text-slate-800">
                        Status: {payslipRecord.status}
                      </div>
                    </div>
                  </div>

                  {/* Employee Particulars */}
                  <div className="rounded-lg border border-slate-300">
                    <div className="border-b border-slate-300 bg-slate-100 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                      Employee Particulars &amp; Attendance
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 text-xs">
                      <div className="px-3.5 py-2">
                        <span className="text-[11px] text-slate-500">Employee Name &amp; ID</span>
                        <div className="mt-0.5 text-sm font-semibold text-slate-900">
                          {payslipRecord.staffName}{' '}
                          <span className="font-mono text-xs font-normal text-slate-600">
                            ({payslipRecord.staffId})
                          </span>
                        </div>
                      </div>
                      <div className="px-3.5 py-2">
                        <span className="text-[11px] text-slate-500">Designation &amp; Department</span>
                        <div className="mt-0.5 font-medium text-slate-900">
                          {payslipRecord.designation} · {payslipRecord.department}
                        </div>
                      </div>
                      <div className="px-3.5 py-2">
                        <span className="text-[11px] text-slate-500">CNIC / Joining Date</span>
                        <div className="mt-0.5 font-mono text-slate-900">
                          {emp?.cnic || '—'} · Joined {emp?.joiningDate || '—'}
                        </div>
                      </div>
                      <div className="px-3.5 py-2">
                        <span className="text-[11px] text-slate-500">Bank / Payout Account</span>
                        <div className="mt-0.5 font-medium text-slate-900">
                          {emp?.bankAccount || 'Cash / Counter'}
                        </div>
                      </div>
                      <div className="px-3.5 py-2">
                        <span className="text-[11px] text-slate-500">Attendance Summary</span>
                        <div className="mt-0.5 font-mono text-slate-900">
                          Working: {payslipRecord.workingDays}d · Present: {payslipRecord.presentDays}d · Leave: {payslipRecord.leaveDays}d
                        </div>
                      </div>
                      <div className="px-3.5 py-2">
                        <span className="text-[11px] text-slate-500">Disbursement Details</span>
                        <div className="mt-0.5 font-mono text-slate-900">
                          {payslipRecord.paymentDate
                            ? `${payslipRecord.paymentDate} · ${payslipRecord.paymentMethod}`
                            : 'Pending Disbursement'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Earnings vs Deductions */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-slate-300">
                      <div className="border-b border-slate-300 bg-slate-100 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                        Earnings
                      </div>
                      <div className="divide-y divide-slate-100 text-xs">
                        <div className="flex justify-between px-3.5 py-2">
                          <span>Basic Salary</span>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(payslipRecord.baseSalary, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between px-3.5 py-2">
                          <span>Allowances</span>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(payslipRecord.allowances, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between px-3.5 py-2">
                          <span>Bonuses / Incentives</span>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(payslipRecord.bonuses, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between px-3.5 py-2">
                          <span>Overtime Pay</span>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(payslipRecord.overtimePay, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between bg-slate-50 px-3.5 py-2 font-bold">
                          <span>Total Gross Earnings</span>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(grossEarnings, currency)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-300">
                      <div className="border-b border-slate-300 bg-slate-100 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                        Deductions
                      </div>
                      <div className="divide-y divide-slate-100 text-xs">
                        <div className="flex justify-between px-3.5 py-2">
                          <span>Leave / Tax Deductions</span>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(payslipRecord.deductions, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between px-3.5 py-2">
                          <span>Advance Recovery</span>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(payslipRecord.advanceRecovery, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between px-3.5 py-2 text-slate-400">
                          <span>Other Adjustments</span>
                          <span className="font-mono tabular-nums">{formatCurrency(0, currency)}</span>
                        </div>
                        <div className="flex justify-between px-3.5 py-2 text-slate-400">
                          <span>—</span>
                          <span>—</span>
                        </div>
                        <div className="flex justify-between bg-slate-50 px-3.5 py-2 font-bold text-red-700">
                          <span>Total Deductions</span>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(totalDeductions, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Net Payable Banner */}
                  <div className="flex items-center justify-between rounded-lg border-2 border-slate-900 bg-slate-50 px-4 py-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-700">
                        Net Salary Payable
                      </div>
                      {payslipRecord.remarks && (
                        <div className="mt-0.5 text-xs text-slate-600">
                          Remarks: {payslipRecord.remarks}
                        </div>
                      )}
                    </div>
                    <div className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                      {formatCurrency(payslipRecord.netSalary, currency)}
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-3 gap-6 pt-8 text-center text-xs text-slate-700">
                    <div className="border-t border-slate-400 pt-1.5 font-medium">
                      Employee Signature
                    </div>
                    <div className="border-t border-slate-400 pt-1.5 font-medium">
                      HR / Accounts Officer
                    </div>
                    <div className="border-t border-slate-400 pt-1.5 font-medium">
                      Director / Admin Approval
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-2 text-center font-mono text-[10px] text-slate-400">
                    Printed on {TODAY_ISO} · {db.settings.academyName} · HR &amp; Payroll Department
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Printable A4 Staff Profile Modal */}
      {printingStaff && (
        <div className="print-modal-root fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div className="print-modal-card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 shadow-xl">
            <div className="no-print mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-semibold text-slate-700">
                HR Employee Profile Sheet (A4 · Narrow Margins)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerA4Print}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Profile (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingStaff(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="print-a4-sheet space-y-4 text-slate-900">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
                <div className="flex items-center gap-3">
                  <MTSLogo size="lg" className="border border-slate-200" />
                  <div>
                    <h1 className="text-xl font-bold">{db.settings.academyName}</h1>
                    <p className="text-xs text-slate-600">{db.settings.address}</p>
                    <p className="font-mono text-xs text-slate-600">{db.settings.phone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wider text-sky-800">
                    HR Staff Appointment Record
                  </div>
                  <div className="mt-1 font-mono text-base font-bold">{printingStaff.id}</div>
                  <div className="font-mono text-xs text-slate-600">
                    Joined: {printingStaff.joiningDate}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-300">
                <div className="border-b border-slate-300 bg-slate-100 px-3.5 py-2 text-xs font-bold uppercase">
                  Staff Personal &amp; Employment Details
                </div>
                <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 text-xs">
                  <div className="px-3.5 py-2">
                    <span className="text-[11px] text-slate-500">Full Name</span>
                    <div className="mt-0.5 text-sm font-semibold">{printingStaff.name}</div>
                  </div>
                  <div className="px-3.5 py-2">
                    <span className="text-[11px] text-slate-500">Father / Guardian Name</span>
                    <div className="mt-0.5 text-sm font-semibold">
                      {printingStaff.fatherName || '—'}
                    </div>
                  </div>
                  <div className="px-3.5 py-2">
                    <span className="text-[11px] text-slate-500">CNIC / National ID</span>
                    <div className="mt-0.5 font-mono font-medium">{printingStaff.cnic || '—'}</div>
                  </div>
                  <div className="px-3.5 py-2">
                    <span className="text-[11px] text-slate-500">Contact &amp; Emergency</span>
                    <div className="mt-0.5 font-mono">
                      {printingStaff.phone} · Emg: {printingStaff.emergencyContact || '—'}
                    </div>
                  </div>
                  <div className="px-3.5 py-2">
                    <span className="text-[11px] text-slate-500">Designation &amp; Department</span>
                    <div className="mt-0.5 font-medium">
                      {printingStaff.designation} ({printingStaff.department})
                    </div>
                  </div>
                  <div className="px-3.5 py-2">
                    <span className="text-[11px] text-slate-500">Employment Type &amp; Status</span>
                    <div className="mt-0.5 font-medium">
                      {printingStaff.employmentType} · {printingStaff.status}
                    </div>
                  </div>
                  <div className="px-3.5 py-2">
                    <span className="text-[11px] text-slate-500">Work Email</span>
                    <div className="mt-0.5 font-mono">{printingStaff.email || '—'}</div>
                  </div>
                  <div className="px-3.5 py-2">
                    <span className="text-[11px] text-slate-500">Bank / Payout Account</span>
                    <div className="mt-0.5 font-medium">{printingStaff.bankAccount || '—'}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-300">
                <div className="border-b border-slate-300 bg-slate-100 px-3.5 py-2 text-xs font-bold uppercase">
                  Compensation Package
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-200 text-xs">
                  <div className="px-3.5 py-2.5">
                    <div className="text-[11px] text-slate-500">Basic Monthly Salary</div>
                    <div className="mt-0.5 font-mono text-sm font-bold tabular-nums">
                      {formatCurrency(printingStaff.baseSalary, currency)}
                    </div>
                  </div>
                  <div className="px-3.5 py-2.5">
                    <div className="text-[11px] text-slate-500">Monthly Allowance</div>
                    <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                      {formatCurrency(printingStaff.defaultAllowance, currency)}
                    </div>
                  </div>
                  <div className="bg-slate-50 px-3.5 py-2.5">
                    <div className="text-[11px] font-semibold text-slate-700">Gross Monthly Package</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-sky-800 tabular-nums">
                      {formatCurrency(
                        printingStaff.baseSalary + printingStaff.defaultAllowance,
                        currency
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-10 text-center text-xs text-slate-700">
                <div className="border-t border-slate-400 pt-1.5 font-medium">
                  Employee Signature
                </div>
                <div className="border-t border-slate-400 pt-1.5 font-medium">
                  HR Manager / Principal Approval
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
