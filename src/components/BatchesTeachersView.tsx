import React, { useMemo, useState } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import {
  AcademyDatabase,
  Batch,
  Teacher,
  TeacherStatus,
  UserAccount,
  UserRole,
} from '../types/academy';
import { computeBatchMetrics, formatCurrency } from '../utils/calculations';
import {
  getTrainerDisplayName,
  getTrainerScopedBatches,
} from '../utils/permissions';

interface BatchesTeachersViewProps {
  db: AcademyDatabase;
  userRole: UserRole;
  currentUser: UserAccount | null;
  onSaveBatch: (batch: Omit<Batch, 'id'> & { id?: string }) => void;
  onDeleteBatch: (id: string) => void;
  onSaveTeacher: (teacher: Omit<Teacher, 'id'> & { id?: string }) => void;
  onDeleteTeacher: (id: string) => void;
}

export const BatchesTeachersView: React.FC<BatchesTeachersViewProps> = ({
  db,
  userRole,
  currentUser,
  onSaveBatch,
  onDeleteBatch,
  onSaveTeacher,
  onDeleteTeacher,
}) => {
  const isTrainer = userRole === 'Trainer';
  const trainerDisplayName = getTrainerDisplayName(currentUser);
  const visibleBatches = useMemo(
    () => getTrainerScopedBatches(db.batches, userRole, currentUser),
    [db.batches, userRole, currentUser]
  );

  const [subTab, setSubTab] = useState<'batches' | 'teachers'>('batches');
  const activeTab = isTrainer ? 'batches' : subTab;

  // Batch modal
  const [batchModal, setBatchModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchName, setBatchName] = useState('');
  const [course, setCourse] = useState('');
  const [assignedTeacher, setAssignedTeacher] = useState(db.teachers[0]?.name || '');
  const [days, setDays] = useState('Mon Wed Fri');
  const [time, setTime] = useState('09:00 AM');
  const [maxCapacity, setMaxCapacity] = useState(20);
  const [defaultFee, setDefaultFee] = useState(8000);

  // Teacher modal
  const [teacherModal, setTeacherModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [tName, setTName] = useState('');
  const [tPhone, setTPhone] = useState('');
  const [tSubject, setTSubject] = useState('');
  const [tSalary, setTSalary] = useState(40000);
  const [tStatus, setTStatus] = useState<TeacherStatus>('Active');

  const currency = db.settings.currency || 'PKR';

  const openNewBatch = () => {
    setEditingBatch(null);
    setBatchName('');
    setCourse('');
    setAssignedTeacher(db.teachers.find((t) => t.status === 'Active')?.name || '');
    setDays('Mon Wed Fri');
    setTime('09:00 AM');
    setMaxCapacity(20);
    setDefaultFee(8000);
    setBatchModal(true);
  };

  const openEditBatch = (b: Batch) => {
    setEditingBatch(b);
    setBatchName(b.batchName);
    setCourse(b.course);
    setAssignedTeacher(b.assignedTeacher);
    setDays(b.days);
    setTime(b.time);
    setMaxCapacity(b.maxCapacity);
    setDefaultFee(b.defaultFee);
    setBatchModal(true);
  };

  const submitBatch = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveBatch({
      id: editingBatch?.id,
      batchName: batchName.trim(),
      course: course.trim(),
      assignedTeacher,
      days: days.trim(),
      time: time.trim(),
      maxCapacity: Number(maxCapacity) || 1,
      defaultFee: Number(defaultFee) || 0,
    });
    setBatchModal(false);
  };

  const openNewTeacher = () => {
    setEditingTeacher(null);
    setTName('');
    setTPhone('');
    setTSubject('');
    setTSalary(40000);
    setTStatus('Active');
    setTeacherModal(true);
  };

  const openEditTeacher = (t: Teacher) => {
    setEditingTeacher(t);
    setTName(t.name);
    setTPhone(t.phone);
    setTSubject(t.subject);
    setTSalary(t.monthlySalary);
    setTStatus(t.status);
    setTeacherModal(true);
  };

  const submitTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveTeacher({
      id: editingTeacher?.id,
      name: tName.trim(),
      phone: tPhone.trim(),
      subject: tSubject.trim(),
      monthlySalary: Number(tSalary) || 0,
      status: tStatus,
    });
    setTeacherModal(false);
  };

  return (
    <div className="space-y-5">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] px-5 py-4">
        {isTrainer ? (
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              My Assigned Batches ({visibleBatches.length})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Showing only batches assigned to {trainerDisplayName}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setSubTab('batches')}
                className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === 'batches'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Batches ({db.batches.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('teachers')}
                className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === 'teachers'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Teachers ({db.teachers.length})
              </button>
            </div>

            <button
              type="button"
              onClick={activeTab === 'batches' ? openNewBatch : openNewTeacher}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              {activeTab === 'batches' ? 'Add Batch' : 'Add Teacher'}
            </button>
          </>
        )}
      </div>

      {activeTab === 'batches' ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">Batch ID</th>
                  <th className="px-4 py-3">Batch &amp; Course</th>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Schedule</th>
                  {!isTrainer && <th className="px-4 py-3 text-right">Fee</th>}
                  <th className="px-4 py-3 text-right">Capacity</th>
                  <th className="px-4 py-3 text-right">Enrolled</th>
                  <th className="px-4 py-3 text-right">Seats Left</th>
                  <th className="px-4 py-3 text-right">Occupancy</th>
                  {!isTrainer && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleBatches.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isTrainer ? 8 : 10}
                      className="px-5 py-10 text-center text-sm text-slate-500"
                    >
                      No batches are currently listed under {trainerDisplayName}.
                    </td>
                  </tr>
                ) : (
                  visibleBatches.map((b) => {
                    const m = computeBatchMetrics(b, db);
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-900">
                          {b.id}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{b.batchName}</div>
                          <div className="text-xs text-slate-500">{b.course}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">{b.assignedTeacher}</td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-slate-800">{b.days}</div>
                          <div className="font-mono text-[11px] text-slate-500">{b.time}</div>
                        </td>
                        {!isTrainer && (
                          <td className="px-4 py-3 text-right font-mono text-xs text-slate-800 tabular-nums">
                            {formatCurrency(b.defaultFee, currency)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 tabular-nums">
                          {b.maxCapacity}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {m.activeCount}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                          {m.seatsLeft}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-medium tabular-nums">
                          <span className={m.occupancyPct >= 90 ? 'text-amber-700' : 'text-sky-700'}>
                            {m.occupancyPct}%
                          </span>
                        </td>
                        {!isTrainer && (
                          <td className="px-5 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditBatch(b)}
                                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteBatch(b.id)}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
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
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">Teacher ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Subject / Course</th>
                  <th className="px-4 py-3 text-right">Monthly Salary</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-900">
                      {t.id}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{t.phone}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{t.subject}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-medium text-slate-900 tabular-nums">
                      {formatCurrency(t.monthlySalary, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium ${
                          t.status === 'Active' ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditTeacher(t)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTeacher(t.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch Modal */}
      {batchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editingBatch ? `Edit Batch ${editingBatch.id}` : 'Create New Batch'}
              </h3>
              <button
                type="button"
                onClick={() => setBatchModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitBatch} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Batch Name *</label>
                  <input
                    type="text"
                    required
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="e.g. Web Evening Cohort"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Course *</label>
                  <input
                    type="text"
                    required
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="e.g. Web Development"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Assigned Teacher</label>
                  {db.teachers.length > 0 ? (
                    <select
                      value={assignedTeacher}
                      onChange={(e) => setAssignedTeacher(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select teacher...</option>
                      {db.teachers.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name} ({t.subject})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={assignedTeacher}
                      onChange={(e) => setAssignedTeacher(e.target.value)}
                      placeholder="Teacher name (or add in Teachers tab)"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Days</label>
                  <input
                    type="text"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Time</label>
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Max Capacity *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Default Fee *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={defaultFee}
                    onChange={(e) => setDefaultFee(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBatchModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
                >
                  Save Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Modal */}
      {teacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editingTeacher ? `Edit Teacher ${editingTeacher.id}` : 'Add New Teacher'}
              </h3>
              <button
                type="button"
                onClick={() => setTeacherModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitTeacher} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={tName}
                  onChange={(e) => setTName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={tPhone}
                    onChange={(e) => setTPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Subject *</label>
                  <input
                    type="text"
                    required
                    value={tSubject}
                    onChange={(e) => setTSubject(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Monthly Salary ({currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={tSalary}
                    onChange={(e) => setTSalary(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Status</label>
                  <select
                    value={tStatus}
                    onChange={(e) => setTStatus(e.target.value as TeacherStatus)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTeacherModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
                >
                  Save Teacher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
