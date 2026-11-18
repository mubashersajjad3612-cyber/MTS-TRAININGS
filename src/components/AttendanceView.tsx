import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCheck, MessageCircle, Save } from 'lucide-react';
import {
  AcademyDatabase,
  AttendanceRecord,
  AttendanceStatus,
  UserAccount,
  UserRole,
} from '../types/academy';
import {
  computeStudentAttendancePct,
  TODAY_ISO,
} from '../utils/calculations';
import {
  getTrainerDisplayName,
  getTrainerScopedBatches,
} from '../utils/permissions';

interface AttendanceViewProps {
  db: AcademyDatabase;
  userRole: UserRole;
  currentUser: UserAccount | null;
  canSendWhatsApp?: boolean;
  onSaveBatchAttendance: (
    batchId: string,
    date: string,
    entries: AttendanceRecord[]
  ) => void;
  onOpenWhatsAppForStudent: (studentId: string) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  db,
  userRole,
  currentUser,
  canSendWhatsApp = false,
  onSaveBatchAttendance,
  onOpenWhatsAppForStudent,
}) => {
  const isTrainer = userRole === 'Trainer';
  const trainerDisplayName = getTrainerDisplayName(currentUser);

  const visibleBatches = useMemo(
    () => getTrainerScopedBatches(db.batches, userRole, currentUser),
    [db.batches, userRole, currentUser]
  );

  const [selectedBatch, setSelectedBatch] = useState(visibleBatches[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState(TODAY_ISO);
  const [drafts, setDrafts] = useState<
    Record<string, { status: AttendanceStatus; remarks: string }>
  >({});
  const [savedNotice, setSavedNotice] = useState(false);

  // Keep selectedBatch strictly within visibleBatches
  useEffect(() => {
    if (!visibleBatches.some((b) => b.id === selectedBatch)) {
      setSelectedBatch(visibleBatches[0]?.id || '');
    }
  }, [visibleBatches, selectedBatch]);

  const batchStudents = useMemo(
    () =>
      selectedBatch
        ? db.students.filter((s) => s.batchId === selectedBatch && s.status === 'Active')
        : [],
    [db.students, selectedBatch]
  );

  // Sync drafts whenever batch, date, or stored attendance changes
  useEffect(() => {
    const next: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    for (const s of batchStudents) {
      const existing = db.attendance.find(
        (a) => a.date === selectedDate && a.studentId === s.id
      );
      next[s.id] = {
        status: existing?.status || 'Present',
        remarks: existing?.remarks || '',
      };
    }
    setDrafts(next);
    setSavedNotice(false);
  }, [batchStudents, db.attendance, selectedDate]);

  const handleMarkAllPresent = () => {
    const next: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    for (const s of batchStudents) {
      next[s.id] = {
        status: 'Present',
        remarks: drafts[s.id]?.remarks || '',
      };
    }
    setDrafts(next);
  };

  const handleSave = () => {
    if (!selectedBatch || !visibleBatches.some((b) => b.id === selectedBatch)) return;
    const entries: AttendanceRecord[] = batchStudents.map((s) => ({
      date: selectedDate,
      studentId: s.id,
      studentName: s.name,
      batchId: selectedBatch,
      status: drafts[s.id]?.status || 'Present',
      remarks: drafts[s.id]?.remarks || '',
    }));
    onSaveBatchAttendance(selectedBatch, selectedDate, entries);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const threshold = db.settings.lowAttendanceAlertPct || 75;
  const activeBatchObj = visibleBatches.find((b) => b.id === selectedBatch);

  return (
    <div className="space-y-5">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500">
              {isTrainer ? 'My Assigned Batch' : 'Batch'}
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              disabled={visibleBatches.length === 0}
              className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
            >
              {visibleBatches.length === 0 ? (
                <option value="">No batches assigned</option>
              ) : (
                visibleBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id} — {b.batchName}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500">Session Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
            />
          </div>
          {activeBatchObj && (
            <div className="hidden border-l border-slate-200 pl-4 text-xs text-slate-500 md:block">
              <div className="font-medium text-slate-800">{activeBatchObj.assignedTeacher}</div>
              <div>
                {activeBatchObj.days} · {activeBatchObj.time}
              </div>
            </div>
          )}
          {isTrainer && (
            <div className="hidden border-l border-slate-200 pl-4 text-xs text-slate-500 xl:block">
              <div className="font-medium text-slate-800">
                Marked by: {trainerDisplayName}
              </div>
              <div className="font-mono text-[11px]">
                ID: {currentUser?.id || currentUser?.email || 'TRAINER'}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleMarkAllPresent}
            disabled={batchStudents.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
          >
            <CheckCheck className="h-3.5 w-3.5 text-emerald-700" />
            Mark All Present
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={batchStudents.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50 whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            Save Attendance
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
          Attendance for {selectedBatch} on {selectedDate} has been recorded
          {currentUser ? ` by ${currentUser.name} (${currentUser.id})` : ''}.
        </div>
      )}

      {/* Attendance Roll */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-5 py-3">Student ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Overall Rate</th>
                <th className="px-4 py-3">Session Status</th>
                <th className="px-4 py-3">Remarks</th>
                {canSendWhatsApp && <th className="px-5 py-3 text-right">Alert</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleBatches.length === 0 ? (
                <tr>
                  <td
                    colSpan={canSendWhatsApp ? 6 : 5}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    No batches are currently listed under {trainerDisplayName}.
                  </td>
                </tr>
              ) : batchStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={canSendWhatsApp ? 6 : 5}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    No active students enrolled in this batch yet.
                  </td>
                </tr>
              ) : (
                batchStudents.map((s) => {
                  const currentStatus = drafts[s.id]?.status || 'Present';
                  const currentRemarks = drafts[s.id]?.remarks || '';
                  const overallPct = computeStudentAttendancePct(s.id, db.attendance);
                  const isLow = overallPct !== null && overallPct < threshold;

                  return (
                    <tr
                      key={s.id}
                      className={isLow ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50/70'}
                    >
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-900">
                        {s.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{s.name}</div>
                        {!isTrainer && (
                          <div className="font-mono text-xs text-slate-500">{s.parentPhone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums">
                        {overallPct === null ? (
                          <span className="text-slate-400">New</span>
                        ) : (
                          <span className={isLow ? 'font-semibold text-red-700' : 'text-slate-700'}>
                            {overallPct}%
                            {isLow && !canSendWhatsApp ? ` (Below ${threshold}%)` : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                          {(['Present', 'Absent', 'Late'] as AttendanceStatus[]).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [s.id]: { ...prev[s.id], status: st },
                                }))
                              }
                              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                                currentStatus === st
                                  ? st === 'Present'
                                    ? 'bg-emerald-700 text-white'
                                    : st === 'Absent'
                                      ? 'bg-red-700 text-white'
                                      : 'bg-amber-600 text-white'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={currentRemarks}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [s.id]: { ...prev[s.id], remarks: e.target.value },
                            }))
                          }
                          placeholder="Optional note..."
                          className="w-44 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-sky-600"
                        />
                      </td>
                      {canSendWhatsApp && (
                        <td className="px-5 py-3 text-right">
                          {isLow ? (
                            <button
                              type="button"
                              onClick={() => onOpenWhatsAppForStudent(s.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Below {threshold}% · Notify
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onOpenWhatsAppForStudent(s.id)}
                              className="inline-flex items-center gap-1 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-700"
                              title="Send WhatsApp message"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
