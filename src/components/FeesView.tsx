import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  FilePlus2,
  Mail,
  MessageCircle,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  AcademyDatabase,
  FeeRecord,
  FeeStatus,
  PaymentMethod,
  UserRole,
} from '../types/academy';
import {
  computeFeeBalance,
  computeFeeStatus,
  formatCurrency,
  getMonthLabel,
  TODAY_ISO,
  triggerA4Print,
} from '../utils/calculations';
import { canVerifyPayments } from '../utils/permissions';
import { MTSLogo } from './MTSLogo';

interface FeesViewProps {
  db: AcademyDatabase;
  userRole: UserRole;
  googleEmail: string | null;
  hasGmailToken: boolean;
  onConnectGmail: () => Promise<void>;
  onGenerateVouchers: (params: {
    scope: 'batch' | 'student';
    batchId: string;
    studentId: string;
    month: string;
    dueDate: string;
  }) => void;
  onRecordPayment: (
    feeId: string,
    updates: {
      discount: number;
      amountPaid: number;
      paymentDate: string;
      paymentMethod: PaymentMethod;
      verifyAndEmail?: boolean;
    }
  ) => void;
  onVerifyAndEmailFee: (feeId: string) => void;
  onDeleteFee: (id: string) => void;
  onOpenWhatsAppForStudent: (studentId: string) => void;
}

export const FeesView: React.FC<FeesViewProps> = ({
  db,
  userRole,
  googleEmail,
  hasGmailToken,
  onConnectGmail,
  onGenerateVouchers,
  onRecordPayment,
  onVerifyAndEmailFee,
  onDeleteFee,
  onOpenWhatsAppForStudent,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | FeeStatus>('All');
  const [monthFilter, setMonthFilter] = useState<string>('All');
  const [batchFilter, setBatchFilter] = useState<string>('All');
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  const canVerify = canVerifyPayments(userRole);
  const primaryEmail = db.settings.email || db.settings.primaryAdminEmail || 'mts.training2026@gmail.com';

  // Voucher generation modal
  const [voucherModal, setVoucherModal] = useState(false);
  const [voucherScope, setVoucherScope] = useState<'batch' | 'student'>('batch');
  const [voucherBatchId, setVoucherBatchId] = useState(db.batches[0]?.id || '');
  const [voucherStudentId, setVoucherStudentId] = useState(
    db.students.find((s) => s.status === 'Active')?.id || db.students[0]?.id || ''
  );
  const [voucherBatchSearch, setVoucherBatchSearch] = useState('');
  const [voucherStudentSearch, setVoucherStudentSearch] = useState('');
  const [voucherMonth, setVoucherMonth] = useState(getMonthLabel());
  const [voucherDueDate, setVoucherDueDate] = useState(() => {
    const now = new Date();
    const day = String(db.settings.defaultDueDay || 10).padStart(2, '0');
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${day}`;
  });

  // Payment modal
  const [payingFee, setPayingFee] = useState<FeeRecord | null>(null);
  const [payDiscount, setPayDiscount] = useState(0);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(TODAY_ISO);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const [verifyAndEmailOnSave, setVerifyAndEmailOnSave] = useState(true);

  // Printable receipt modal
  const [receiptFee, setReceiptFee] = useState<FeeRecord | null>(null);

  const currency = db.settings.currency || 'PKR';

  const distinctMonths = useMemo(() => {
    return Array.from(new Set(db.fees.map((f) => f.month))).filter(Boolean);
  }, [db.fees]);

  const studentById = useMemo(() => {
    const map = new Map(db.students.map((s) => [s.id, s]));
    return map;
  }, [db.students]);

  const batchById = useMemo(() => {
    const map = new Map(db.batches.map((b) => [b.id, b]));
    return map;
  }, [db.batches]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.fees
      .filter((f) => (monthFilter === 'All' ? true : f.month === monthFilter))
      .filter((f) => (batchFilter === 'All' ? true : f.batchId === batchFilter))
      .filter((f) => (statusFilter === 'All' ? true : computeFeeStatus(f) === statusFilter))
      .filter((f) => {
        if (!q) return true;
        const st = studentById.get(f.studentId);
        const batch = batchById.get(f.batchId);
        return (
          f.id.toLowerCase().includes(q) ||
          f.studentId.toLowerCase().includes(q) ||
          f.studentName.toLowerCase().includes(q) ||
          f.batchId.toLowerCase().includes(q) ||
          f.month.toLowerCase().includes(q) ||
          (batch?.batchName.toLowerCase().includes(q) ?? false) ||
          (batch?.course.toLowerCase().includes(q) ?? false) ||
          (st?.course.toLowerCase().includes(q) ?? false) ||
          (st?.fatherName.toLowerCase().includes(q) ?? false) ||
          (st?.studentPhone.toLowerCase().includes(q) ?? false) ||
          (st?.parentPhone.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => b.id.localeCompare(a.id));
  }, [db.fees, monthFilter, batchFilter, statusFilter, search, studentById, batchById]);

  const filteredTotals = useMemo(() => {
    return filtered.reduce(
      (acc, f) => {
        acc.billed += f.feeAmount || 0;
        acc.discount += f.discount || 0;
        acc.paid += f.amountPaid || 0;
        acc.balance += computeFeeBalance(f);
        return acc;
      },
      { billed: 0, discount: 0, paid: 0, balance: 0 }
    );
  }, [filtered]);

  // Modal search lists for Batch & Student selection
  const modalFilteredBatches = useMemo(() => {
    const q = voucherBatchSearch.trim().toLowerCase();
    return db.batches.filter((b) => {
      if (!q) return true;
      return (
        b.id.toLowerCase().includes(q) ||
        b.batchName.toLowerCase().includes(q) ||
        b.course.toLowerCase().includes(q) ||
        b.assignedTeacher.toLowerCase().includes(q)
      );
    });
  }, [db.batches, voucherBatchSearch]);

  const modalFilteredStudents = useMemo(() => {
    const q = voucherStudentSearch.trim().toLowerCase();
    return db.students
      .filter((s) => {
        if (!q) return s.status === 'Active';
        return (
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.fatherName.toLowerCase().includes(q) ||
          s.batchId.toLowerCase().includes(q) ||
          s.course.toLowerCase().includes(q) ||
          s.studentPhone.toLowerCase().includes(q) ||
          s.parentPhone.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (a.status !== 'Active' && b.status === 'Active') return 1;
        return a.id.localeCompare(b.id);
      });
  }, [db.students, voucherStudentSearch]);

  const selectedModalBatch = batchById.get(voucherBatchId);
  const selectedModalStudent = studentById.get(voucherStudentId);

  const openVoucherModal = () => {
    setVoucherBatchSearch('');
    setVoucherStudentSearch('');
    if (batchFilter !== 'All') {
      setVoucherBatchId(batchFilter);
    }
    setVoucherModal(true);
  };

  const openPaymentModal = (f: FeeRecord) => {
    setPayingFee(f);
    setPayDiscount(f.discount);
    setPayAmount(f.amountPaid > 0 ? f.amountPaid : Math.max(0, f.feeAmount - f.discount));
    setPayDate(f.paymentDate || TODAY_ISO);
    setPayMethod(f.paymentMethod || 'Cash');
    setVerifyAndEmailOnSave(canVerify);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingFee) return;
    const targetId = payingFee.id;
    setPayingFee(null);
    onRecordPayment(targetId, {
      discount: Number(payDiscount) || 0,
      amountPaid: Number(payAmount) || 0,
      paymentDate: payDate,
      paymentMethod: payMethod,
      verifyAndEmail: canVerify ? verifyAndEmailOnSave : false,
    });
  };

  const handleConnectGmailClick = async () => {
    setConnectingGmail(true);
    try {
      await onConnectGmail();
    } finally {
      setConnectingGmail(false);
    }
  };

  const handleVoucherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (voucherScope === 'batch' && !voucherBatchId) return;
    if (voucherScope === 'student' && !voucherStudentId) return;
    onGenerateVouchers({
      scope: voucherScope,
      batchId: voucherBatchId,
      studentId: voucherStudentId,
      month: voucherMonth.trim(),
      dueDate: voucherDueDate,
    });
    setVoucherModal(false);
  };

  const receiptStudent = receiptFee ? studentById.get(receiptFee.studentId) : null;
  const receiptBatch = receiptFee ? batchById.get(receiptFee.batchId) : null;

  return (
    <div className="space-y-5">
      {/* Main Ledger & Non-Receipt Modals (hidden during print if Receipt modal is open) */}
      <div className={receiptFee ? 'no-print space-y-5' : 'space-y-5'}>
        {/* Printable A4 Fee Register Header (only visible when printing the register) */}
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
                Fee Management Register
              </div>
              <div className="mt-0.5 font-mono text-xs text-slate-600">
                Batch: {batchFilter} · Month: {monthFilter} · Status: {statusFilter}
              </div>
              {search && (
                <div className="font-mono text-[11px] text-slate-500">
                  Query: &ldquo;{search}&rdquo;
                </div>
              )}
              <div className="font-mono text-[11px] text-slate-500">Printed: {TODAY_ISO}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3 border-t border-slate-200 pt-2 text-xs">
            <div>
              <span className="text-slate-500">Billed: </span>
              <span className="font-mono font-semibold">{formatCurrency(filteredTotals.billed, currency)}</span>
            </div>
            <div>
              <span className="text-slate-500">Discount: </span>
              <span className="font-mono font-semibold">{formatCurrency(filteredTotals.discount, currency)}</span>
            </div>
            <div>
              <span className="text-slate-500">Collected: </span>
              <span className="font-mono font-semibold text-emerald-700">
                {formatCurrency(filteredTotals.paid, currency)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500">Balance: </span>
              <span className="font-mono font-bold text-red-700">
                {formatCurrency(filteredTotals.balance, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Gmail Automated Verification Notification Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                hasGmailToken ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
              }`}
            >
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">
                Automated Verification &amp; Student Email Dispatch
              </div>
              <div className="text-[11px] text-slate-500">
                Primary Email: <span className="font-mono font-medium text-slate-700">{primaryEmail}</span>
                {' · '}
                {hasGmailToken ? (
                  <span className="font-medium text-emerald-700">
                    Gmail API connected ({googleEmail}) — sends portal credentials &amp; receipts automatically
                  </span>
                ) : (
                  <span className="text-slate-600">
                    Standalone mode active (no API required) — verify payments, generate student login IDs, and open via Mail app or copy text
                  </span>
                )}
              </div>
            </div>
          </div>

          {!hasGmailToken && canVerify && (
            <button
              type="button"
              onClick={handleConnectGmailClick}
              disabled={connectingGmail}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50 whitespace-nowrap"
            >
              <Mail className="h-3.5 w-3.5" />
              {connectingGmail ? 'Connecting...' : 'Connect Gmail (Optional)'}
            </button>
          )}
        </div>

        {/* Toolbar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Student ID (S-001), name, batch, fee ID..."
                className="w-72 rounded-lg border border-slate-200 py-2 pl-9 pr-8 text-sm outline-none focus:border-sky-600"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
            >
              <option value="All">All Batches</option>
              {db.batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id} · {b.batchName}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['All', 'Paid', 'Partial', 'Unpaid', 'Overdue'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
            >
              <option value="All">All Months</option>
              {distinctMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={triggerA4Print}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Register (A4)
            </button>
            <button
              type="button"
              onClick={openVoucherModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              Generate Monthly Vouchers
            </button>
          </div>
        </div>

        {/* Fee Ledger Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">Fee ID</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Month / Due</th>
                  <th className="px-4 py-3 text-right">Fee</th>
                  <th className="px-4 py-3 text-right">Discount</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status &amp; Verification</th>
                  <th className="no-print px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-10 text-center text-sm text-slate-500">
                      No fee invoices match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((f) => {
                    const balance = computeFeeBalance(f);
                    const status = computeFeeStatus(f);
                    const st = studentById.get(f.studentId);
                    const needsVerify = !f.verified && (f.amountPaid > 0 || f.isAdmissionFee);
                    return (
                      <tr key={f.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <div className="font-mono text-xs font-semibold text-slate-900">{f.id}</div>
                          {f.isAdmissionFee && (
                            <div className="text-[10px] font-medium text-sky-700">Admission Fee</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{f.studentName}</div>
                          <div className="font-mono text-xs text-slate-500">
                            {f.studentId} · {f.batchId}
                          </div>
                          {st?.email && (
                            <div className="font-mono text-[11px] text-slate-500">{st.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-slate-800">{f.month}</div>
                          <div className="font-mono text-[11px] text-slate-500">Due {f.dueDate}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                          {formatCurrency(f.feeAmount, currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-500 tabular-nums">
                          {f.discount > 0 ? formatCurrency(f.discount, currency) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-medium text-emerald-700 tabular-nums">
                          {formatCurrency(f.amountPaid, currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(balance, currency)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {f.paymentMethod || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-medium ${
                              status === 'Paid'
                                ? 'text-emerald-700'
                                : status === 'Overdue'
                                  ? 'text-red-700'
                                  : 'text-amber-700'
                            }`}
                          >
                            {status}
                          </span>
                          {f.verified ? (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              <span>
                                Verified{f.lastEmailSentAt ? ` · Emailed ${f.lastEmailSentAt}` : ''}
                              </span>
                            </div>
                          ) : needsVerify ? (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-amber-700">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span>Pending Accountant Verify</span>
                            </div>
                          ) : null}
                        </td>
                        <td className="no-print px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            {canVerify && !f.verified && (f.amountPaid > 0 || f.isAdmissionFee) && (
                              <button
                                type="button"
                                onClick={() => onVerifyAndEmailFee(f.id)}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap"
                                title="Verify payment by Accountant & email student"
                              >
                                <ShieldCheck className="h-3 w-3" />
                                Verify &amp; Email
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openPaymentModal(f)}
                              className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-blue-100 whitespace-nowrap"
                            >
                              <CreditCard className="h-3 w-3" />
                              {balance > 0 ? 'Record Pay' : 'Edit Pay'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setReceiptFee(f)}
                              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              title="Printable Receipt (A4)"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenWhatsAppForStudent(f.studentId)}
                              className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50"
                              title="Send WhatsApp Reminder"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteFee(f.id)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                              title="Delete fee record"
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

        {/* Automated Verification Email Log */}
        {(db.emailLogs || []).length > 0 && (
          <div className="no-print overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div>
                <h3 className="text-xs font-semibold text-slate-900">
                  Automated Admission &amp; Payment Email Dispatch Log
                </h3>
                <p className="text-[11px] text-slate-500">
                  Sent upon Accountant verification via primary email ({primaryEmail})
                </p>
              </div>
              <span className="font-mono text-xs text-slate-500">
                {(db.emailLogs || []).length} record(s)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-4 py-2.5">Recipient Email</th>
                    <th className="px-4 py-2.5">Email Type</th>
                    <th className="px-4 py-2.5">Verified By</th>
                    <th className="px-4 py-2.5">Delivery Status</th>
                    <th className="px-5 py-2.5 text-right">Dispatch / Copy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...(db.emailLogs || [])].reverse().slice(0, 12).map((log) => {
                    const mailtoUrl = `mailto:${encodeURIComponent(log.toEmail)}?subject=${encodeURIComponent(
                      log.subject
                    )}&body=${encodeURIComponent(log.textBody || '')}`;
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-2.5 font-mono text-slate-600">{log.date}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          {log.studentName}{' '}
                          <span className="font-mono text-[11px] text-slate-500">({log.studentId})</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-sky-700">{log.toEmail}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{log.type}</td>
                        <td className="px-4 py-2.5 text-slate-600">{log.verifiedBy}</td>
                        <td className="px-4 py-2.5 font-medium">
                          <span
                            className={
                              log.deliveryStatus === 'Sent via Gmail'
                                ? 'text-emerald-700'
                                : 'text-slate-600'
                            }
                          >
                            {log.deliveryStatus}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={mailtoUrl}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                              title="Open in default Mail app (no API needed)"
                            >
                              <ExternalLink className="h-3 w-3 text-sky-700" />
                              Mail App
                            </a>
                            {log.textBody && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(
                                      `To: ${log.toEmail}\nSubject: ${log.subject}\n\n${log.textBody}`
                                    );
                                    setCopiedLogId(log.id);
                                    setTimeout(() => setCopiedLogId(null), 2000);
                                  } catch {
                                    // ignore
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                                title="Copy message text"
                              >
                                {copiedLogId === log.id ? (
                                  <Check className="h-3 w-3 text-emerald-700" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                                {copiedLogId === log.id ? 'Copied' : 'Copy'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Generate Monthly Vouchers Modal with Searchable Batch & Student Selection */}
        {voucherModal && (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-base font-semibold text-slate-900">
                  Generate Monthly Fee Vouchers
                </h3>
                <button
                  type="button"
                  onClick={() => setVoucherModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleVoucherSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Target Scope</label>
                  <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setVoucherScope('batch')}
                      className={`rounded-md py-1.5 text-xs font-medium ${
                        voucherScope === 'batch'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      Entire Active Batch
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoucherScope('student')}
                      className={`rounded-md py-1.5 text-xs font-medium ${
                        voucherScope === 'student'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      Single Student
                    </button>
                  </div>
                </div>

                {voucherScope === 'batch' ? (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Search &amp; Select Batch (by ID, Name, Course, or Teacher)
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={voucherBatchSearch}
                        onChange={(e) => setVoucherBatchSearch(e.target.value)}
                        placeholder="Type batch keyword or ID (e.g. B-01, Python)..."
                        className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-sky-600"
                      />
                    </div>
                    <div className="max-h-44 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                      {modalFilteredBatches.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-slate-500">
                          No batches match &ldquo;{voucherBatchSearch}&rdquo;
                        </div>
                      ) : (
                        modalFilteredBatches.map((b) => {
                          const activeCount = db.students.filter(
                            (s) => s.batchId === b.id && s.status === 'Active'
                          ).length;
                          const isSelected = voucherBatchId === b.id;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setVoucherBatchId(b.id)}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                                isSelected ? 'bg-sky-50 text-blue-900' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900">
                                  <span className="font-mono font-semibold">{b.id}</span> — {b.batchName}
                                </div>
                                <div className="truncate text-[11px] text-slate-500">
                                  {b.course} · {b.assignedTeacher} · {activeCount} active student(s)
                                </div>
                              </div>
                              {isSelected && <Check className="h-4 w-4 shrink-0 text-sky-700" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                    {selectedModalBatch && (
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                        Selected Batch:{' '}
                        <span className="font-mono font-semibold text-slate-900">
                          {selectedModalBatch.id}
                        </span>{' '}
                        · {selectedModalBatch.batchName}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Search &amp; Select Student (by Student ID, Name, Phone, or Batch)
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={voucherStudentSearch}
                        onChange={(e) => setVoucherStudentSearch(e.target.value)}
                        placeholder="Type Student ID (S-001), name, phone, or batch..."
                        className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-sky-600"
                      />
                    </div>
                    <div className="max-h-44 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                      {modalFilteredStudents.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-slate-500">
                          No students match &ldquo;{voucherStudentSearch}&rdquo;
                        </div>
                      ) : (
                        modalFilteredStudents.map((s) => {
                          const isSelected = voucherStudentId === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setVoucherStudentId(s.id)}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                                isSelected ? 'bg-sky-50 text-blue-900' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900">
                                  <span className="font-mono font-semibold">{s.id}</span> — {s.name}
                                </div>
                                <div className="truncate text-[11px] text-slate-500">
                                  {s.course} ({s.batchId}) · {formatCurrency(s.monthlyFee, currency)} ·{' '}
                                  {s.status}
                                </div>
                              </div>
                              {isSelected && <Check className="h-4 w-4 shrink-0 text-sky-700" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                    {selectedModalStudent && (
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                        Selected Student:{' '}
                        <span className="font-mono font-semibold text-slate-900">
                          {selectedModalStudent.id}
                        </span>{' '}
                        · {selectedModalStudent.name} ({selectedModalStudent.batchId})
                      </div>
                    )}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Month Label *</label>
                    <input
                      type="text"
                      required
                      value={voucherMonth}
                      onChange={(e) => setVoucherMonth(e.target.value)}
                      placeholder="Nov-2026"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Due Date *</label>
                    <input
                      type="date"
                      required
                      value={voucherDueDate}
                      onChange={(e) => setVoucherDueDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  Existing invoices for the same student and month are automatically skipped to avoid duplicates.
                </p>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setVoucherModal(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
                  >
                    Generate Vouchers
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Record Payment Modal */}
        {payingFee && (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Record Fee Payment</h3>
                  <p className="text-xs text-slate-500">
                    {payingFee.id} · {payingFee.studentName} ({payingFee.month})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPayingFee(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-xs">
                  <span className="text-slate-600">Billed Tuition</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(payingFee.feeAmount, currency)}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Discount ({currency})</label>
                    <input
                      type="number"
                      min={0}
                      max={payingFee.feeAmount}
                      value={payDiscount}
                      onChange={(e) => setPayDiscount(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Amount Paid *</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={payAmount}
                      onChange={(e) => setPayAmount(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Payment Date</label>
                    <input
                      type="date"
                      required
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Method</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="JazzCash">JazzCash</option>
                      <option value="EasyPaisa">EasyPaisa</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-600">
                    Resulting Balance{' '}
                    {Math.max(0, payingFee.feeAmount - payDiscount - payAmount) > 0 && payAmount > 0 && (
                      <span className="font-medium text-amber-700">(Partial Payment)</span>
                    )}
                  </span>
                  <span className="font-mono text-sm font-semibold text-slate-900">
                    {formatCurrency(
                      Math.max(0, payingFee.feeAmount - payDiscount - payAmount),
                      currency
                    )}
                  </span>
                </div>

                {canVerify ? (
                  <label className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-slate-800">
                    <input
                      type="checkbox"
                      checked={verifyAndEmailOnSave}
                      onChange={(e) => setVerifyAndEmailOnSave(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700"
                    />
                    <div>
                      <div className="font-semibold text-emerald-900">
                        Verify payment by {userRole} &amp; email student
                      </div>
                      <div className="mt-0.5 text-[11px] text-emerald-800">
                        {studentById.get(payingFee.studentId)?.email
                          ? `Sends login credentials (if new admission) or payment receipt to ${studentById.get(payingFee.studentId)?.email}`
                          : 'Add student email in Students & Admissions to send receipt email.'}
                      </div>
                    </div>
                  </label>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-800">
                    Payment will be saved as Pending Accountant Verification. An Accountant or Admin must verify it to email the student.
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPayingFee(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
                  >
                    {canVerify && verifyAndEmailOnSave ? 'Save, Verify & Email' : 'Save Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Printable Fee Receipt Modal (A4 Narrow Margins) */}
      {receiptFee && (
        <div className="print-modal-root fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div className="print-modal-card w-full max-w-2xl rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-8 shadow-xl">
            <div className="no-print mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-medium text-slate-500">
                Fee Receipt Preview (A4 · Narrow Margins)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerA4Print}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print / Save PDF (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptFee(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="print-a4-sheet space-y-5">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div className="flex items-center gap-3">
                  <MTSLogo size="lg" className="border border-slate-200" />
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{db.settings.academyName}</h2>
                    <p className="text-xs text-slate-500">{db.settings.address}</p>
                    <p className="font-mono text-xs text-slate-500">{db.settings.phone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wider text-sky-800">
                    Official Fee Receipt
                  </div>
                  <div className="mt-1 font-mono text-base font-semibold text-slate-900">
                    {receiptFee.id}
                  </div>
                  <div className="font-mono text-xs text-slate-500">
                    Date: {receiptFee.paymentDate || TODAY_ISO}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Student Name</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{receiptFee.studentName}</p>
                  {receiptStudent?.fatherName && (
                    <p className="text-slate-500">S/O {receiptStudent.fatherName}</p>
                  )}
                </div>
                <div>
                  <p className="text-slate-500">Student ID &amp; Batch</p>
                  <p className="mt-0.5 font-mono text-sm font-medium text-slate-900">
                    {receiptFee.studentId} · {receiptFee.batchId}
                  </p>
                  {receiptBatch && (
                    <p className="text-slate-500">
                      {receiptBatch.course} ({receiptBatch.batchName})
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-slate-500">Billing Month &amp; Due Date</p>
                  <p className="mt-0.5 font-mono text-sm text-slate-900">
                    {receiptFee.month} · Due {receiptFee.dueDate}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Payment Method</p>
                  <p className="mt-0.5 text-sm text-slate-900">{receiptFee.paymentMethod || 'Pending'}</p>
                </div>
              </div>

              <div className="border-y border-slate-200 py-4 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Monthly Tuition Fee</span>
                  <span className="font-mono tabular-nums">{formatCurrency(receiptFee.feeAmount, currency)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Discount</span>
                  <span className="font-mono tabular-nums">-{formatCurrency(receiptFee.discount, currency)}</span>
                </div>
                <div className="flex justify-between py-1 font-semibold text-emerald-700">
                  <span>Amount Paid</span>
                  <span className="font-mono tabular-nums">{formatCurrency(receiptFee.amountPaid, currency)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
                  <span>Remaining Balance</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(computeFeeBalance(receiptFee), currency)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs text-slate-600">
                <div className="border-t border-slate-300 pt-1.5">Depositor Signature</div>
                <div className="border-t border-slate-300 pt-1.5">Accountant / Stamp</div>
              </div>

              <p className="text-center text-xs text-slate-400">
                Computer-generated A4 receipt · {db.settings.email}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
