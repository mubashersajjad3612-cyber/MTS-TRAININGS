import React, { useMemo, useState } from 'react';
import { Printer, User, X } from 'lucide-react';
import { AcademyDatabase, FeeRecord, UserAccount } from '../types/academy';
import {
  computeFeeBalance,
  computeFeeStatus,
  computeStudentAttendancePct,
  computeStudentOutstanding,
  formatCurrency,
  TODAY_ISO,
  triggerA4Print,
} from '../utils/calculations';
import { MTSLogo } from './MTSLogo';

interface StudentPortalViewProps {
  db: AcademyDatabase;
  currentUser: UserAccount;
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  db,
  currentUser,
}) => {
  const [receiptFee, setReceiptFee] = useState<FeeRecord | null>(null);

  const student = useMemo(() => {
    if (currentUser.linkedStudentId) {
      const byId = db.students.find((s) => s.id === currentUser.linkedStudentId);
      if (byId) return byId;
    }
    return (
      db.students.find(
        (s) => s.name.toLowerCase() === currentUser.name.toLowerCase()
      ) || null
    );
  }, [db.students, currentUser]);

  const batch = useMemo(
    () => (student ? db.batches.find((b) => b.id === student.batchId) || null : null),
    [db.batches, student]
  );

  const studentFees = useMemo(
    () => (student ? db.fees.filter((f) => f.studentId === student.id) : []),
    [db.fees, student]
  );

  const studentAttendance = useMemo(
    () =>
      student
        ? db.attendance
            .filter((a) => a.studentId === student.id)
            .sort((a, b) => b.date.localeCompare(a.date))
        : [],
    [db.attendance, student]
  );

  const currency = db.settings.currency || 'PKR';

  if (!student) {
    return (
      <div className="os-card p-8 text-center">
        <h2 className="text-base font-semibold text-slate-900">
          Welcome, {currentUser.name}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Your student account ({currentUser.email}) is active, but it is not linked to an enrolled Student ID yet. Please ask the Academy Admin to link your profile in Users &amp; Roles.
        </p>
      </div>
    );
  }

  const attendancePct = computeStudentAttendancePct(student.id, db.attendance);
  const outstanding = computeStudentOutstanding(student.id, db.fees);

  return (
    <div className="space-y-6">
      <div className={receiptFee ? 'no-print space-y-6' : 'space-y-6'}>
        {/* Student Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-[#071526] p-6 text-white shadow-sm sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }}
          />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt={student.name}
                  className="h-16 w-14 shrink-0 rounded-xl border border-white/20 object-cover shadow-md"
                />
              ) : (
                <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-sky-300">
                  <User className="h-6 w-6" />
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-sky-300">
                  <span>{db.settings.academyName}</span>
                  <span aria-hidden="true">·</span>
                  <span>Student Portal</span>
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {student.name}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-slate-300">
                  {student.id} · {student.course} · {student.status}
                </p>
              </div>
            </div>
            <MTSLogo size="md" className="border border-white/15" />
          </div>
        </div>

        {/* Student Profile Summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="os-card p-5">
            <p className="text-xs text-slate-500">Enrolled Course &amp; Batch</p>
            <p className="mt-1.5 text-base font-semibold text-slate-900">{student.course}</p>
            <p className="mt-1 text-xs text-slate-500">
              {batch ? `${batch.batchName} (${batch.days} · ${batch.time})` : student.batchId}
            </p>
          </div>

          <div className="os-card p-5">
            <p className="text-xs text-slate-500">Assigned Instructor</p>
            <p className="mt-1.5 text-base font-semibold text-slate-900">{student.teacher}</p>
            <p className="mt-1 font-mono text-xs text-slate-500">
              Admitted: {student.admissionDate}
            </p>
          </div>

          <div className="os-card p-5">
            <p className="text-xs text-slate-500">Attendance Rate</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {attendancePct === null ? '—' : `${attendancePct}%`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {studentAttendance.length} recorded sessions
            </p>
          </div>

          <div className="os-card p-5">
            <p className="text-xs text-slate-500">Pending Fee Balance</p>
            <p
              className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${
                outstanding > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {formatCurrency(outstanding, currency)}
            </p>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">
              Monthly Tuition: {formatCurrency(student.monthlyFee, currency)}
            </p>
          </div>
        </div>

        {/* Fee Invoices & Attendance */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="os-card overflow-hidden lg:col-span-7">
            <div className="border-b border-slate-200/80 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                My Fee Vouchers &amp; Receipts
              </h3>
              <p className="text-xs text-slate-500">
                View payment history and print official A4 receipts
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/90 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5">Month</th>
                    <th className="px-4 py-2.5 text-right">Fee</th>
                    <th className="px-4 py-2.5 text-right">Paid</th>
                    <th className="px-4 py-2.5 text-right">Balance</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-5 py-2.5 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentFees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-xs text-slate-500">
                        No fee invoices issued yet.
                      </td>
                    </tr>
                  ) : (
                    studentFees.map((f) => {
                      const bal = computeFeeBalance(f);
                      const status = computeFeeStatus(f);
                      return (
                        <tr key={f.id} className="transition-colors hover:bg-slate-50/70">
                          <td className="px-5 py-2.5 font-mono text-xs font-medium text-slate-900">
                            {f.month}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                            {formatCurrency(f.feeAmount, currency)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-emerald-700 tabular-nums">
                            {formatCurrency(f.amountPaid, currency)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold tabular-nums">
                            {formatCurrency(bal, currency)}
                          </td>
                          <td className="px-4 py-2.5">
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
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => setReceiptFee(f)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                              <Printer className="h-3 w-3" />
                              Receipt
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="os-card overflow-hidden lg:col-span-5">
            <div className="border-b border-slate-200/80 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">My Attendance Record</h3>
              <p className="text-xs text-slate-500">Recent class sessions</p>
            </div>
            <div className="divide-y divide-slate-100">
              {studentAttendance.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-slate-500">
                  No attendance sessions marked yet.
                </div>
              ) : (
                studentAttendance.slice(0, 12).map((a, idx) => (
                  <div
                    key={`${a.date}-${idx}`}
                    className="flex items-center justify-between px-5 py-2.5 text-xs transition-colors hover:bg-slate-50/70"
                  >
                    <div>
                      <div className="font-mono font-medium text-slate-900">{a.date}</div>
                      {a.remarks && <div className="text-slate-500">{a.remarks}</div>}
                    </div>
                    <span
                      className={`font-medium ${
                        a.status === 'Present'
                          ? 'text-emerald-700'
                          : a.status === 'Absent'
                            ? 'text-red-700'
                            : 'text-amber-700'
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {receiptFee && (
        <div className="print-modal-root fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div className="print-modal-card os-modal-enter w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl">
            <div className="no-print mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-medium text-slate-500">
                Fee Receipt (A4 · Narrow Margins)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerA4Print}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print (A4)
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

            <div className="print-a4-sheet space-y-4">
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3">
                  <MTSLogo size="lg" className="border border-slate-200" />
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{db.settings.academyName}</h2>
                    <p className="text-xs text-slate-500">{db.settings.address}</p>
                  </div>
                </div>
                <div className="text-right font-mono text-xs">
                  <div className="font-semibold text-slate-900">{receiptFee.id}</div>
                  <div className="text-slate-500">{receiptFee.paymentDate || TODAY_ISO}</div>
                </div>
              </div>
              <div className="text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Student</span>
                  <span className="font-medium">
                    {student.name} ({student.id})
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Month</span>
                  <span className="font-mono">{receiptFee.month}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Tuition Fee</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(receiptFee.feeAmount, currency)}
                  </span>
                </div>
                <div className="flex justify-between py-1 font-semibold text-emerald-700">
                  <span>Amount Paid</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(receiptFee.amountPaid, currency)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold">
                  <span>Remaining Balance</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(computeFeeBalance(receiptFee), currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
