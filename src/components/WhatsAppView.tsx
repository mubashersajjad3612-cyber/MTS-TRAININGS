import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, MessageCircle, Settings } from 'lucide-react';
import { AcademyDatabase, WhatsAppMessageType } from '../types/academy';
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  computeStudentAttendancePct,
  computeStudentOutstanding,
  formatCurrency,
  formatWhatsAppPhone,
} from '../utils/calculations';

interface WhatsAppViewProps {
  db: AcademyDatabase;
  preselectedStudentId: string | null;
  canOpenSettings?: boolean;
  onOpenSettings?: () => void;
  onLogWhatsApp: (entry: {
    studentId: string;
    studentName: string;
    phone: string;
    messageType: WhatsAppMessageType;
  }) => void;
}

const MESSAGE_TYPES: WhatsAppMessageType[] = [
  'Fee Reminder',
  'Overdue Fee',
  'Payment Received',
  'Low Attendance Alert',
];

export const WhatsAppView: React.FC<WhatsAppViewProps> = ({
  db,
  preselectedStudentId,
  canOpenSettings,
  onOpenSettings,
  onLogWhatsApp,
}) => {
  const [studentId, setStudentId] = useState(
    preselectedStudentId || db.students[0]?.id || ''
  );
  const [messageType, setMessageType] = useState<WhatsAppMessageType>('Fee Reminder');
  const [recipientTarget, setRecipientTarget] = useState<'settings' | 'parent' | 'student'>('settings');
  const [customBody, setCustomBody] = useState('');

  useEffect(() => {
    if (preselectedStudentId) {
      setStudentId(preselectedStudentId);
    }
  }, [preselectedStudentId]);

  const selectedStudent = useMemo(
    () => db.students.find((s) => s.id === studentId) || db.students[0],
    [db.students, studentId]
  );

  const studentStats = useMemo(() => {
    if (!selectedStudent) return { outstanding: 0, attPct: null, lastFee: undefined };
    const outstanding = computeStudentOutstanding(selectedStudent.id, db.fees);
    const attPct = computeStudentAttendancePct(selectedStudent.id, db.attendance);
    const studentFees = db.fees.filter((f) => f.studentId === selectedStudent.id);
    const lastFee = studentFees[studentFees.length - 1];
    return { outstanding, attPct, lastFee };
  }, [selectedStudent, db.fees, db.attendance]);

  const currency = db.settings.currency || 'PKR';
  const settingsWhatsAppFormatted = formatWhatsAppPhone(db.settings.whatsapp);

  useEffect(() => {
    if (!selectedStudent) return;
    const generated = buildWhatsAppMessage(messageType, {
      academyName: db.settings.academyName,
      instituteWhatsApp: db.settings.whatsapp,
      studentName: selectedStudent.name,
      studentId: selectedStudent.id,
      course: selectedStudent.course,
      month: studentStats.lastFee?.month,
      dueDate: studentStats.lastFee?.dueDate,
      monthlyFee: selectedStudent.monthlyFee,
      outstanding: studentStats.outstanding,
      lastPaid: studentStats.lastFee?.amountPaid,
      attendancePct: studentStats.attPct,
      currency,
    });
    setCustomBody(generated);
  }, [
    selectedStudent,
    messageType,
    studentStats,
    db.settings.academyName,
    db.settings.whatsapp,
    currency,
  ]);

  const targetPhone =
    recipientTarget === 'settings'
      ? db.settings.whatsapp
      : recipientTarget === 'student'
        ? selectedStudent?.studentPhone || selectedStudent?.parentPhone || ''
        : selectedStudent?.parentPhone || selectedStudent?.studentPhone || '';

  const waHref = buildWhatsAppUrl(targetPhone, customBody);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left: Composer */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 lg:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">WhatsApp Reminder Composer</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Uses the official WhatsApp number configured in Settings ({settingsWhatsAppFormatted ? `+${settingsWhatsAppFormatted}` : 'Not set'}).
            </p>
          </div>
          {canOpenSettings && onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Settings className="h-3.5 w-3.5" />
              Edit Settings Number
            </button>
          )}
        </div>

        {/* Settings WhatsApp Number Banner */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs">
          <div>
            <span className="font-medium text-emerald-900">Institute WhatsApp (from Settings): </span>
            <span className="font-mono font-semibold text-emerald-800">
              {settingsWhatsAppFormatted ? `+${settingsWhatsAppFormatted}` : 'Configure in Settings'}
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-md bg-white p-0.5 border border-emerald-200">
            <button
              type="button"
              onClick={() => setRecipientTarget('settings')}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                recipientTarget === 'settings'
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Use Settings Number
            </button>
            <button
              type="button"
              onClick={() => setRecipientTarget('parent')}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                recipientTarget === 'parent'
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Parent Phone
            </button>
            <button
              type="button"
              onClick={() => setRecipientTarget('student')}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                recipientTarget === 'student'
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Student Phone
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Student</label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {db.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.name} ({s.course})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Message Type</label>
              <select
                value={messageType}
                onChange={(e) => setMessageType(e.target.value as WhatsAppMessageType)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {MESSAGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedStudent && (
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div>
                <p className="text-slate-500">Target WhatsApp</p>
                <p className="mt-0.5 font-mono font-medium text-slate-900">
                  +{formatWhatsAppPhone(targetPhone) || '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Outstanding</p>
                <p className="mt-0.5 font-mono font-semibold text-amber-700 tabular-nums">
                  {formatCurrency(studentStats.outstanding, currency)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Attendance</p>
                <p className="mt-0.5 font-mono font-medium text-slate-900 tabular-nums">
                  {studentStats.attPct === null ? '—' : `${studentStats.attPct}%`}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Message Preview (includes Settings WhatsApp number)
            </label>
            <textarea
              rows={5}
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-relaxed text-slate-800 outline-none focus:border-sky-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (!selectedStudent) return;
                onLogWhatsApp({
                  studentId: selectedStudent.id,
                  studentName: selectedStudent.name,
                  phone: targetPhone,
                  messageType,
                });
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
            >
              <MessageCircle className="h-4 w-4" />
              Open WhatsApp (+{formatWhatsAppPhone(targetPhone)})
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Right: WHATSAPP_LOGS */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:col-span-5">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">WhatsApp Logs</h3>
          <p className="text-xs text-slate-500">Recent reminders recorded in WHATSAPP_LOGS</p>
        </div>
        <div className="divide-y divide-slate-100">
          {db.whatsappLogs.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-slate-500">
              No WhatsApp reminders sent yet.
            </div>
          ) : (
            [...db.whatsappLogs]
              .reverse()
              .slice(0, 12)
              .map((log) => (
                <div key={log.id} className="flex items-center justify-between px-5 py-3 text-xs">
                  <div>
                    <div className="font-medium text-slate-900">
                      {log.studentName}{' '}
                      <span className="font-mono text-slate-500">({log.studentId})</span>
                    </div>
                    <div className="mt-0.5 text-slate-500">
                      {log.messageType} · <span className="font-mono">{log.phone}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-slate-700">{log.date}</div>
                    <div className="font-medium text-emerald-700">{log.status}</div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
