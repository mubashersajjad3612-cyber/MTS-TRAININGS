import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Edit2,
  MessageCircle,
  Plus,
  Printer,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  AcademyDatabase,
  FeeRecord,
  Inquiry,
  PaymentMethod,
  Student,
  StudentStatus,
  UserAccount,
  UserRole,
} from '../types/academy';
import {
  computeFeeBalance,
  computeFeeStatus,
  computeStudentAttendancePct,
  computeStudentOutstanding,
  formatCnicInput,
  formatCurrency,
  getMonthLabel,
  normalizeCnic,
  TODAY_ISO,
  triggerA4Print,
} from '../utils/calculations';
import {
  canManageAdmissions,
  getTrainerDisplayName,
  getTrainerScopedBatches,
  getTrainerScopedStudents,
} from '../utils/permissions';
import { MTSLogo } from './MTSLogo';

async function resizeStudentPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (JPG, PNG, WEBP).');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image file is too large (max 10 MB).');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode selected image.'));
    image.src = dataUrl;
  });

  const maxW = 220;
  const maxH = 260;
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const targetW = Math.max(1, Math.round(img.width * scale));
  const targetH = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', 0.8);
}

interface StudentsViewProps {
  db: AcademyDatabase;
  userRole: UserRole;
  currentUser: UserAccount | null;
  pendingConversion: Inquiry | null;
  onClearPendingConversion: () => void;
  onSaveStudent: (
    student: Omit<Student, 'id'> & { id?: string },
    convertedInquiryId?: string,
    initialFeePackage?: {
      feeAmount: number;
      discount: number;
      amountPaid: number;
      paymentMethod: PaymentMethod;
      month: string;
      dueDate: string;
    }
  ) => { student: Student; initialFee?: FeeRecord };
  onDeleteStudent: (id: string) => void;
  onOpenWhatsAppForStudent: (studentId: string) => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  db,
  userRole,
  currentUser,
  pendingConversion,
  onClearPendingConversion,
  onSaveStudent,
  onDeleteStudent,
  onOpenWhatsAppForStudent,
}) => {
  const isTrainer = userRole === 'Trainer';
  const canEditAdmissions = canManageAdmissions(userRole);
  const trainerDisplayName = getTrainerDisplayName(currentUser);
  const visibleBatches = useMemo(
    () => getTrainerScopedBatches(db.batches, userRole, currentUser),
    [db.batches, userRole, currentUser]
  );
  const scopedStudents = useMemo(
    () => getTrainerScopedStudents(db.students, db.batches, userRole, currentUser),
    [db.students, db.batches, userRole, currentUser]
  );

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | StudentStatus>('All');
  const [batchFilter, setBatchFilter] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [convertingInquiryId, setConvertingInquiryId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (batchFilter !== 'All' && !visibleBatches.some((b) => b.id === batchFilter)) {
      setBatchFilter('All');
    }
  }, [batchFilter, visibleBatches]);

  // Printable Admission Form modal state
  const [admissionFormStudent, setAdmissionFormStudent] = useState<Student | null>(null);
  const [initialFeeSnapshot, setInitialFeeSnapshot] = useState<FeeRecord | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [email, setEmail] = useState('');
  const [cnic, setCnic] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [formError, setFormError] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [studentPhone, setStudentPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [batchId, setBatchId] = useState(db.batches[0]?.id || '');
  const [course, setCourse] = useState(db.batches[0]?.course || '');
  const [teacher, setTeacher] = useState(db.batches[0]?.assignedTeacher || '');
  const [monthlyFee, setMonthlyFee] = useState(db.batches[0]?.defaultFee || 7500);
  const [status, setStatus] = useState<StudentStatus>('Active');
  const [admissionDate, setAdmissionDate] = useState(TODAY_ISO);
  const [leftDate, setLeftDate] = useState('');
  const [leftReason, setLeftReason] = useState('');

  // Initial fee package states for new admission
  const [createInitialFee, setCreateInitialFee] = useState(true);
  const [packageDiscount, setPackageDiscount] = useState(0);
  const [initialPaid, setInitialPaid] = useState(0);
  const [initialPayMethod, setInitialPayMethod] = useState<PaymentMethod>('Cash');
  const [initialBillingMonth, setInitialBillingMonth] = useState(getMonthLabel());
  const [initialDueDate, setInitialDueDate] = useState(() => {
    const now = new Date();
    const day = String(db.settings.defaultDueDay || 10).padStart(2, '0');
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${day}`;
  });

  const normalizedCnicInput = normalizeCnic(cnic);
  const duplicateCnicStudent = useMemo(() => {
    if (!normalizedCnicInput) return null;
    return (
      db.students.find(
        (s) =>
          s.id !== editing?.id &&
          s.cnic &&
          normalizeCnic(s.cnic) === normalizedCnicInput
      ) || null
    );
  }, [db.students, editing?.id, normalizedCnicInput]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !canEditAdmissions) return;
    setPhotoError('');
    try {
      const compressed = await resizeStudentPhoto(file);
      setPhotoUrl(compressed);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Unable to process image.');
    }
  };

  const handleBatchSelect = (nextBatchId: string) => {
    setBatchId(nextBatchId);
    const b = db.batches.find((item) => item.id === nextBatchId);
    if (b) {
      setCourse(b.course);
      setTeacher(b.assignedTeacher);
      setMonthlyFee(b.defaultFee);
    }
  };

  useEffect(() => {
    if (pendingConversion && canEditAdmissions) {
      setEditing(null);
      setConvertingInquiryId(pendingConversion.id);
      setName(pendingConversion.fullName);
      setFatherName(pendingConversion.fatherName);
      setEmail(pendingConversion.email || '');
      setCnic('');
      setPhotoUrl('');
      setPhotoError('');
      setFormError('');
      setGender(pendingConversion.gender);
      setStudentPhone(pendingConversion.phone);
      setParentPhone(pendingConversion.phone);
      const matchingBatch =
        db.batches.find(
          (b) => b.course.toLowerCase() === pendingConversion.interestedCourse.toLowerCase()
        ) || db.batches[0];
      if (matchingBatch) {
        setBatchId(matchingBatch.id);
        setCourse(matchingBatch.course);
        setTeacher(matchingBatch.assignedTeacher);
        setMonthlyFee(matchingBatch.defaultFee);
      }
      setStatus('Active');
      setAdmissionDate(TODAY_ISO);
      setLeftDate('');
      setLeftReason('');
      setCreateInitialFee(true);
      setPackageDiscount(0);
      setInitialPaid(0);
      setInitialPayMethod('Cash');
      setInitialBillingMonth(getMonthLabel());
      setModalOpen(true);
      onClearPendingConversion();
    }
  }, [pendingConversion, canEditAdmissions, db.batches, onClearPendingConversion]);

  const openNewModal = () => {
    if (!canEditAdmissions) return;
    setEditing(null);
    setConvertingInquiryId(undefined);
    const firstBatch = db.batches[0];
    setName('');
    setFatherName('');
    setEmail('');
    setCnic('');
    setPhotoUrl('');
    setPhotoError('');
    setFormError('');
    setGender('Male');
    setStudentPhone('');
    setParentPhone('');
    setBatchId(firstBatch?.id || '');
    setCourse(firstBatch?.course || '');
    setTeacher(firstBatch?.assignedTeacher || '');
    setMonthlyFee(firstBatch?.defaultFee || 7500);
    setStatus('Active');
    setAdmissionDate(TODAY_ISO);
    setLeftDate('');
    setLeftReason('');
    setCreateInitialFee(true);
    setPackageDiscount(0);
    setInitialPaid(0);
    setInitialPayMethod('Cash');
    setInitialBillingMonth(getMonthLabel());
    setModalOpen(true);
  };

  const openEditModal = (s: Student) => {
    if (!canEditAdmissions) return;
    setEditing(s);
    setConvertingInquiryId(undefined);
    setName(s.name);
    setFatherName(s.fatherName);
    setEmail(s.email || '');
    setCnic(s.cnic || '');
    setPhotoUrl(s.photoUrl || '');
    setPhotoError('');
    setFormError('');
    setGender(s.gender);
    setStudentPhone(s.studentPhone);
    setParentPhone(s.parentPhone);
    setBatchId(s.batchId);
    setCourse(s.course);
    setTeacher(s.teacher);
    setMonthlyFee(s.monthlyFee);
    setStatus(s.status);
    setAdmissionDate(s.admissionDate);
    setLeftDate(s.leftDate);
    setLeftReason(s.leftReason);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditAdmissions) return;
    setFormError('');

    if (!normalizedCnicInput) {
      setFormError('CNIC No. is required as the unique student identifier.');
      return;
    }

    if (duplicateCnicStudent) {
      setFormError(
        `CNIC No. already exists in student record (${duplicateCnicStudent.id} — ${duplicateCnicStudent.name}, Batch ${duplicateCnicStudent.batchId}).`
      );
      return;
    }

    const isNew = !editing;
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        setFormError('A valid student email address is required for login ID and payment receipts.');
        return;
      }

      const result = onSaveStudent(
        {
          id: editing?.id,
          name: name.trim(),
          fatherName: fatherName.trim(),
          email: normalizedEmail,
          cnic: cnic.trim(),
          photoUrl,
          gender,
          studentPhone: studentPhone.trim(),
          parentPhone: parentPhone.trim(),
          batchId,
          course,
          teacher,
          monthlyFee: Number(monthlyFee) || 0,
          status,
          admissionDate,
          leftDate: status === 'Left' ? leftDate || TODAY_ISO : '',
          leftReason: status === 'Left' ? leftReason.trim() : '',
        },
        convertingInquiryId,
        isNew && createInitialFee
          ? {
              feeAmount: Number(monthlyFee) || 0,
              discount: Number(packageDiscount) || 0,
              amountPaid: Number(initialPaid) || 0,
              paymentMethod: initialPayMethod,
              month: initialBillingMonth.trim() || getMonthLabel(),
              dueDate: initialDueDate || TODAY_ISO,
            }
          : undefined
      );
      setModalOpen(false);
      if (isNew) {
        setInitialFeeSnapshot(result.initialFee || null);
        setAdmissionFormStudent(result.student);
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to save student admission record.'
      );
    }
  };

  const openAdmissionFormForStudent = (s: Student) => {
    setInitialFeeSnapshot(null);
    setAdmissionFormStudent(s);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qCnic = normalizeCnic(search);
    return scopedStudents
      .filter((s) => (statusFilter === 'All' ? true : s.status === statusFilter))
      .filter((s) => (batchFilter === 'All' ? true : s.batchId === batchFilter))
      .filter((s) => {
        if (!q) return true;
        return (
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          (!isTrainer && Boolean(s.email) && s.email!.toLowerCase().includes(q)) ||
          (!isTrainer && Boolean(s.cnic) && s.cnic!.toLowerCase().includes(q)) ||
          (!isTrainer && Boolean(qCnic) && Boolean(s.cnic) && normalizeCnic(s.cnic).includes(qCnic)) ||
          (!isTrainer && s.fatherName.toLowerCase().includes(q)) ||
          (!isTrainer && s.studentPhone.includes(q)) ||
          (!isTrainer && s.parentPhone.includes(q)) ||
          s.course.toLowerCase().includes(q) ||
          s.batchId.toLowerCase().includes(q)
        );
      });
  }, [scopedStudents, search, statusFilter, batchFilter, isTrainer]);

  const lowAttThreshold = db.settings.lowAttendanceAlertPct || 75;
  const currency = db.settings.currency || 'PKR';

  // Live package calculations inside modal
  const modalNetPackage = Math.max(0, (Number(monthlyFee) || 0) - (Number(packageDiscount) || 0));
  const modalBalanceAmount = Math.max(0, modalNetPackage - (Number(initialPaid) || 0));

  // Admission form derived data
  const admissionBatch = useMemo(
    () =>
      admissionFormStudent
        ? db.batches.find((b) => b.id === admissionFormStudent.batchId) || null
        : null,
    [db.batches, admissionFormStudent]
  );

  const admissionStudentFees = useMemo(() => {
    if (!admissionFormStudent) return [];
    const fromDb = db.fees.filter((f) => f.studentId === admissionFormStudent.id);
    if (
      initialFeeSnapshot &&
      initialFeeSnapshot.studentId === admissionFormStudent.id &&
      !fromDb.some((f) => f.id === initialFeeSnapshot.id)
    ) {
      return [...fromDb, initialFeeSnapshot];
    }
    return fromDb;
  }, [db.fees, admissionFormStudent, initialFeeSnapshot]);

  const admissionTotals = useMemo(() => {
    if (!admissionFormStudent) {
      return { packageFee: 0, totalDiscount: 0, totalPaid: 0, balanceAmount: 0 };
    }
    if (admissionStudentFees.length === 0) {
      return {
        packageFee: admissionFormStudent.monthlyFee,
        totalDiscount: 0,
        totalPaid: 0,
        balanceAmount: admissionFormStudent.monthlyFee,
      };
    }
    const totalBilled = admissionStudentFees.reduce((s, f) => s + f.feeAmount, 0);
    const totalDiscount = admissionStudentFees.reduce((s, f) => s + f.discount, 0);
    const totalPaid = admissionStudentFees.reduce((s, f) => s + f.amountPaid, 0);
    const balanceAmount = admissionStudentFees.reduce((s, f) => s + computeFeeBalance(f), 0);
    return {
      packageFee: admissionFormStudent.monthlyFee || totalBilled,
      totalDiscount,
      totalPaid,
      balanceAmount,
    };
  }, [admissionFormStudent, admissionStudentFees]);

  return (
    <div className="space-y-5">
      {/* Screen Content (hidden during print if Admission Form modal is open) */}
      <div className={admissionFormStudent ? 'no-print space-y-5' : 'space-y-5'}>
        {/* Toolbar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isTrainer ? 'Search ID, name, batch...' : 'Search ID, CNIC, name, phone...'}
                className="w-64 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-600"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['All', 'Active', 'Left', 'Completed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
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
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
            >
              <option value="All">
                {isTrainer ? 'All My Batches' : 'All Batches'}
              </option>
              {visibleBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id} · {b.batchName}
                </option>
              ))}
            </select>
          </div>

          {isTrainer ? (
            <div className="text-xs text-slate-500">
              Showing students in batches assigned to{' '}
              <span className="font-medium text-slate-800">{trainerDisplayName}</span>
            </div>
          ) : canEditAdmissions ? (
            <button
              type="button"
              onClick={openNewModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              New Admission
            </button>
          ) : (
            <div className="text-xs text-slate-500">
              Read-only student directory ({userRole})
            </div>
          )}
        </div>

        {/* Students Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">{isTrainer ? 'Student ID' : 'Student ID & CNIC'}</th>
                  <th className="px-4 py-3">
                    {isTrainer ? 'Student Name' : 'Student & Guardian'}
                  </th>
                  <th className="px-4 py-3">Course / Batch</th>
                  <th className="px-4 py-3">Teacher</th>
                  {!isTrainer && <th className="px-4 py-3 text-right">Fee Package</th>}
                  <th className="px-4 py-3 text-right">Attendance</th>
                  {!isTrainer && <th className="px-4 py-3 text-right">Balance</th>}
                  <th className="px-4 py-3">Status</th>
                  {!isTrainer && <th className="no-print px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isTrainer ? 6 : 9}
                      className="px-5 py-10 text-center text-sm text-slate-500"
                    >
                      {isTrainer && visibleBatches.length === 0
                        ? `No batches are currently assigned to ${trainerDisplayName}.`
                        : 'No student records match your filter.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const attPct = computeStudentAttendancePct(s.id, db.attendance);
                    const outstanding = computeStudentOutstanding(s.id, db.fees);
                    const isLowAtt = attPct !== null && attPct < lowAttThreshold;

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <div className="font-mono text-xs font-semibold text-slate-900">{s.id}</div>
                          {!isTrainer && (
                            <>
                              <div className="font-mono text-[11px] text-slate-600">
                                {s.cnic ? s.cnic : 'CNIC —'}
                              </div>
                              <div className="font-mono text-[10px] text-slate-400">
                                Adm: {s.admissionDate}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {!isTrainer && (
                              s.photoUrl ? (
                                <img
                                  src={s.photoUrl}
                                  alt={s.name}
                                  className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 object-cover"
                                />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-500">
                                  <User className="h-4 w-4 text-slate-400" />
                                </div>
                              )
                            )}
                            <div>
                              <div className="font-medium text-slate-900">{s.name}</div>
                              {!isTrainer && (
                                <>
                                  <div className="text-xs text-slate-500">
                                    {s.fatherName} · <span className="font-mono">{s.parentPhone || s.studentPhone}</span>
                                  </div>
                                  {s.email && (
                                    <div className="font-mono text-[11px] text-sky-700">{s.email}</div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-800">{s.course}</div>
                          <div className="font-mono text-xs text-slate-500">{s.batchId}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">{s.teacher}</td>
                        {!isTrainer && (
                          <td className="px-4 py-3 text-right font-mono text-xs text-slate-800 tabular-nums">
                            {formatCurrency(s.monthlyFee, currency)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                          {attPct === null ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                isLowAtt ? 'text-red-700' : 'text-slate-800'
                              }`}
                            >
                              {isLowAtt && <AlertCircle className="h-3.5 w-3.5" />}
                              {attPct}%
                            </span>
                          )}
                        </td>
                        {!isTrainer && (
                          <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums">
                            <span className={outstanding > 0 ? 'text-amber-700' : 'text-slate-600'}>
                              {formatCurrency(outstanding, currency)}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-medium ${
                              s.status === 'Active'
                                ? 'text-emerald-700'
                                : s.status === 'Left'
                                  ? 'text-red-700'
                                  : 'text-sky-700'
                            }`}
                          >
                            {s.status}
                          </span>
                          {!isTrainer && s.status === 'Left' && s.leftDate && (
                            <div className="font-mono text-[11px] text-slate-400">{s.leftDate}</div>
                          )}
                        </td>
                        {!isTrainer && (
                          <td className="no-print px-5 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openAdmissionFormForStudent(s)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                                title="Printable Admission Form (A4)"
                              >
                                <Printer className="h-3 w-3" />
                                Form
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenWhatsAppForStudent(s.id)}
                                className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50"
                                title="WhatsApp Parent"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </button>
                              {canEditAdmissions && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(s)}
                                    className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                    title="Edit student"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteStudent(s.id)}
                                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                                    title="Delete student"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
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

        {/* Add/Edit Student Modal (Admission-Authorized Roles Only) */}
        {modalOpen && canEditAdmissions && (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {editing ? `Edit Student ${editing.id}` : 'New Student Admission'}
                  </h3>
                  {convertingInquiryId && (
                    <p className="mt-0.5 text-xs text-sky-700">
                      Converting inquiry {convertingInquiryId} to enrolled student
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                {formError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Student Photograph & Unique CNIC No. Block */}
                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-start">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-white">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt="Student portrait preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-center text-slate-400">
                          <User className="h-7 w-7" />
                          <span className="mt-1 text-[10px]">Photo</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-800">Student Picture</div>
                      <p className="text-[11px] text-slate-500">
                        Printed on A4 Admission Form ({userRole})
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          <Camera className="h-3.5 w-3.5" />
                          <span>{photoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>
                        {photoUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoUrl('');
                              setPhotoError('');
                            }}
                            className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {photoError && (
                        <div className="text-[11px] font-medium text-red-700">{photoError}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-700">
                      CNIC / B-Form No. (Unique Student ID) *
                    </label>
                    <input
                      type="text"
                      required
                      value={cnic}
                      onChange={(e) => {
                        setCnic(formatCnicInput(e.target.value));
                        if (formError) setFormError('');
                      }}
                      placeholder="35202-1234567-1"
                      maxLength={15}
                      className={`mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none ${
                        duplicateCnicStudent
                          ? 'border-red-500 bg-red-50/40 text-red-900 focus:border-red-600'
                          : 'border-slate-200 bg-white focus:border-sky-600'
                      }`}
                    />
                    {duplicateCnicStudent ? (
                      <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-800">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                        <span>
                          Already exist: CNIC No. is already registered to{' '}
                          <span className="font-semibold">
                            {duplicateCnicStudent.name} ({duplicateCnicStudent.id}
                          </span>
                          {' · '}Batch {duplicateCnicStudent.batchId}).
                        </span>
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-500">
                        13-digit CNIC / B-Form used as unique student verification ID
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Student Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Father Name *</label>
                    <input
                      type="text"
                      required
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Student Email Address (Portal Login ID &amp; Payment Receipts) *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (formError) setFormError('');
                    }}
                    placeholder="student@gmail.com"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Used as Student Portal Login ID. Auto-generated password and all payment receipts are emailed here once verified by the Accountant.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'Male' | 'Female' | 'Other')}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Student Phone *</label>
                    <input
                      type="tel"
                      required
                      value={studentPhone}
                      onChange={(e) => setStudentPhone(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Parent Phone *</label>
                    <input
                      type="tel"
                      required
                      value={parentPhone}
                      onChange={(e) => setParentPhone(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Assign Batch *</label>
                    <select
                      value={batchId}
                      onChange={(e) => handleBatchSelect(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {db.batches.length === 0 ? (
                        <option value="">No batches yet — add in Batches &amp; Teachers</option>
                      ) : (
                        db.batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.id} — {b.batchName}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Course (Auto)</label>
                    <input
                      type="text"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Teacher (Auto)</label>
                    <input
                      type="text"
                      value={teacher}
                      onChange={(e) => setTeacher(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Fee Package Decided ({currency}) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={monthlyFee}
                      onChange={(e) => setMonthlyFee(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Admission Date</label>
                    <input
                      type="date"
                      required
                      value={admissionDate}
                      onChange={(e) => setAdmissionDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as StudentStatus)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                      <option value="Left">Left</option>
                    </select>
                  </div>
                </div>

                {/* New Admission Fee Package & Initial Payment Section */}
                {!editing && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-900">
                          Admission Fee Package &amp; Initial Payment
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Creates an admission voucher queued for Accountant verification to email login credentials to the student
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={createInitialFee}
                          onChange={(e) => setCreateInitialFee(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-700"
                        />
                        Record Fee Voucher
                      </label>
                    </div>

                    {createInitialFee && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-4">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700">
                              Discount ({currency})
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={monthlyFee}
                              value={packageDiscount}
                              onChange={(e) => setPackageDiscount(Number(e.target.value))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700">
                              Paid at Admission ({currency})
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={initialPaid}
                              onChange={(e) => setInitialPaid(Number(e.target.value))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700">
                              Payment Method
                            </label>
                            <select
                              value={initialPayMethod}
                              onChange={(e) => setInitialPayMethod(e.target.value as PaymentMethod)}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                            >
                              <option value="Cash">Cash</option>
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="JazzCash">JazzCash</option>
                              <option value="EasyPaisa">EasyPaisa</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700">
                              Billing Month
                            </label>
                            <input
                              type="text"
                              value={initialBillingMonth}
                              onChange={(e) => setInitialBillingMonth(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 border-t border-slate-200 pt-2.5 text-xs">
                          <div>
                            <span className="text-slate-500">Net Package Fee: </span>
                            <span className="font-mono font-semibold text-slate-900">
                              {formatCurrency(modalNetPackage, currency)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Paid Now: </span>
                            <span className="font-mono font-semibold text-emerald-700">
                              {formatCurrency(Number(initialPaid) || 0, currency)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500">Balance Amount: </span>
                            <span
                              className={`font-mono font-semibold ${
                                modalBalanceAmount > 0 ? 'text-amber-700' : 'text-emerald-700'
                              }`}
                            >
                              {formatCurrency(modalBalanceAmount, currency)}
                            </span>
                          </div>
                        </div>

                        <input
                          type="hidden"
                          value={initialDueDate}
                          onChange={(e) => setInitialDueDate(e.target.value)}
                        />
                      </>
                    )}
                  </div>
                )}

                {status === 'Left' && (
                  <div className="grid gap-4 rounded-lg border border-red-200 bg-red-50/50 p-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-red-800">Left Date *</label>
                      <input
                        type="date"
                        required
                        value={leftDate || TODAY_ISO}
                        onChange={(e) => setLeftDate(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-red-800">Reason for Leaving</label>
                      <input
                        type="text"
                        value={leftReason}
                        onChange={(e) => setLeftReason(e.target.value)}
                        placeholder="e.g. Schedule conflict, relocated"
                        className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
                  >
                    {!editing && <Printer className="h-3.5 w-3.5" />}
                    {editing ? 'Update Student' : 'Save & View Admission Form'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Printable A4 Admission Form Modal */}
      {admissionFormStudent && (
        <div className="print-modal-root fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div className="print-modal-card max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 shadow-xl">
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Printable Student Admission Form (A4 · Narrow Margins)
                </h3>
                <p className="text-xs text-slate-500">
                  Includes full student profile, decided fee package, and balance amount
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerA4Print}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Admission Form (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setAdmissionFormStudent(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                  aria-label="Close admission form"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* A4 Printable Sheet */}
            <div className="print-a4-sheet space-y-4 text-slate-900">
              {/* Institute Letterhead */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
                <div className="flex items-center gap-3">
                  <MTSLogo size="lg" className="border border-slate-200" />
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900">
                      {db.settings.academyName}
                    </h1>
                    <p className="mt-0.5 text-xs text-slate-600">{db.settings.address}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-600">
                      Tel: {db.settings.phone} · Email: {db.settings.email}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wider text-sky-800">
                    Student Admission Form
                  </div>
                  <div className="mt-1 font-mono text-base font-bold text-slate-900">
                    ID: {admissionFormStudent.id}
                  </div>
                  <div className="font-mono text-xs text-slate-600">
                    Admission Date: {admissionFormStudent.admissionDate}
                  </div>
                  <div className="text-xs font-semibold text-slate-700">
                    Status: {admissionFormStudent.status}
                  </div>
                </div>
              </div>

              {/* Section 1: Student & Guardian Particulars + Passport Photo */}
              <div className="rounded-lg border border-slate-300">
                <div className="border-b border-slate-300 bg-slate-100 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                  1. Student &amp; Guardian Information
                </div>
                <div className="flex items-stretch divide-x divide-slate-200">
                  <div className="grid flex-1 grid-cols-2 divide-x divide-y divide-slate-200 text-xs">
                    <div className="px-3.5 py-2">
                      <span className="text-[11px] text-slate-500">Full Name</span>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">
                        {admissionFormStudent.name}
                      </div>
                    </div>
                    <div className="px-3.5 py-2">
                      <span className="text-[11px] text-slate-500">Father / Guardian Name</span>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">
                        {admissionFormStudent.fatherName}
                      </div>
                    </div>
                    <div className="px-3.5 py-2">
                      <span className="text-[11px] text-slate-500">CNIC / B-Form No. (Unique ID)</span>
                      <div className="mt-0.5 font-mono font-semibold text-slate-900">
                        {admissionFormStudent.cnic || '—'}
                      </div>
                    </div>
                    <div className="px-3.5 py-2">
                      <span className="text-[11px] text-slate-500">Gender &amp; Enrollment ID</span>
                      <div className="mt-0.5 font-medium text-slate-900">
                        {admissionFormStudent.gender} ·{' '}
                        <span className="font-mono font-semibold">{admissionFormStudent.id}</span>
                      </div>
                    </div>
                    <div className="px-3.5 py-2">
                      <span className="text-[11px] text-slate-500">Student Contact No.</span>
                      <div className="mt-0.5 font-mono font-medium text-slate-900">
                        {admissionFormStudent.studentPhone}
                      </div>
                    </div>
                    <div className="px-3.5 py-2">
                      <span className="text-[11px] text-slate-500">Parent / Guardian Contact No.</span>
                      <div className="mt-0.5 font-mono font-medium text-slate-900">
                        {admissionFormStudent.parentPhone}
                      </div>
                    </div>
                    <div className="col-span-2 px-3.5 py-2">
                      <span className="text-[11px] text-slate-500">Registered Email Address (Portal Login ID)</span>
                      <div className="mt-0.5 font-mono font-semibold text-slate-900">
                        {admissionFormStudent.email || '—'}
                      </div>
                    </div>
                  </div>
                  <div className="flex w-32 shrink-0 flex-col items-center justify-center bg-slate-50/50 p-2.5">
                    {admissionFormStudent.photoUrl ? (
                      <img
                        src={admissionFormStudent.photoUrl}
                        alt={admissionFormStudent.name}
                        className="h-28 w-24 rounded border border-slate-300 object-cover"
                      />
                    ) : (
                      <div className="flex h-28 w-24 flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-white px-2 text-center text-[10px] text-slate-400">
                        <User className="mb-1 h-5 w-5 text-slate-300" />
                        Passport Size Photo
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Course & Batch Enrollment */}
              <div className="rounded-lg border border-slate-300">
                <div className="border-b border-slate-300 bg-slate-100 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                  2. Course &amp; Batch Assignment
                </div>
                <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 text-xs">
                  <div className="px-3.5 py-2">
                    <span className="text-[11px] text-slate-500">Enrolled Course</span>
                    <div className="mt-0.5 text-sm font-semibold text-slate-900">
                      {admissionFormStudent.course}
                    </div>
                  </div>
                  <div className="px-3.5 py-2">
                    <span className="text-[11px] text-slate-500">Batch Code &amp; Name</span>
                    <div className="mt-0.5 font-medium text-slate-900">
                      <span className="font-mono font-semibold">{admissionFormStudent.batchId}</span>
                      {admissionBatch ? ` — ${admissionBatch.batchName}` : ''}
                    </div>
                  </div>
                  <div className="px-3.5 py-2">
                    <span className="text-[11px] text-slate-500">Assigned Trainer / Instructor</span>
                    <div className="mt-0.5 font-medium text-slate-900">
                      {admissionFormStudent.teacher}
                    </div>
                  </div>
                  <div className="px-3.5 py-2">
                    <span className="text-[11px] text-slate-500">Class Schedule &amp; Timing</span>
                    <div className="mt-0.5 font-medium text-slate-900">
                      {admissionBatch ? `${admissionBatch.days} · ${admissionBatch.time}` : 'Standard Batch Schedule'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Fee Package Decided & Balance Summary */}
              <div className="rounded-lg border border-slate-300">
                <div className="border-b border-slate-300 bg-slate-100 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-slate-800">
                  3. Fee Package Decided &amp; Balance Statement
                </div>

                <div className="grid grid-cols-4 divide-x divide-slate-200 border-b border-slate-200 text-xs">
                  <div className="px-3.5 py-2.5">
                    <div className="text-[11px] text-slate-500">Fee Package Decided</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-slate-900 tabular-nums">
                      {formatCurrency(admissionTotals.packageFee, currency)}
                    </div>
                    <div className="text-[10px] text-slate-500">Per Month</div>
                  </div>
                  <div className="px-3.5 py-2.5">
                    <div className="text-[11px] text-slate-500">Discount Granted</div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-slate-800 tabular-nums">
                      {formatCurrency(admissionTotals.totalDiscount, currency)}
                    </div>
                  </div>
                  <div className="px-3.5 py-2.5">
                    <div className="text-[11px] text-slate-500">Total Amount Paid</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-emerald-700 tabular-nums">
                      {formatCurrency(admissionTotals.totalPaid, currency)}
                    </div>
                  </div>
                  <div className="bg-slate-50 px-3.5 py-2.5">
                    <div className="text-[11px] font-semibold text-slate-700">Balance Amount</div>
                    <div
                      className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${
                        admissionTotals.balanceAmount > 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatCurrency(admissionTotals.balanceAmount, currency)}
                    </div>
                  </div>
                </div>

                {admissionStudentFees.length > 0 && (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                      <tr>
                        <th className="px-3.5 py-2">Voucher ID</th>
                        <th className="px-3 py-2">Month</th>
                        <th className="px-3 py-2">Due Date</th>
                        <th className="px-3 py-2 text-right">Package Fee</th>
                        <th className="px-3 py-2 text-right">Discount</th>
                        <th className="px-3 py-2 text-right">Paid</th>
                        <th className="px-3 py-2 text-right">Balance</th>
                        <th className="px-3.5 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {admissionStudentFees.map((f) => (
                        <tr key={f.id}>
                          <td className="px-3.5 py-1.5 font-mono font-semibold">{f.id}</td>
                          <td className="px-3 py-1.5 font-mono">{f.month}</td>
                          <td className="px-3 py-1.5 font-mono text-slate-600">{f.dueDate}</td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                            {formatCurrency(f.feeAmount, currency)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                            {formatCurrency(f.discount, currency)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-medium text-emerald-700 tabular-nums">
                            {formatCurrency(f.amountPaid, currency)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-semibold tabular-nums">
                            {formatCurrency(computeFeeBalance(f), currency)}
                          </td>
                          <td className="px-3.5 py-1.5 text-right font-medium">
                            {computeFeeStatus(f)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Section 4: Terms & Signatures */}
              <div className="rounded-lg border border-slate-300 px-3.5 py-3 text-[11px] leading-relaxed text-slate-600">
                <p className="font-semibold text-slate-800">Declaration &amp; Institute Policy:</p>
                <p className="mt-0.5">
                  I hereby confirm that all particulars stated above are accurate. I agree to abide by the rules, attendance requirements, and monthly fee schedule of {db.settings.academyName} (due by day {db.settings.defaultDueDay || 10} of each month). Fees once paid are non-refundable.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-8 text-center text-xs text-slate-700">
                <div>
                  <div className="border-t border-slate-400 pt-1.5 font-medium">
                    Student / Guardian Signature
                  </div>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1.5 font-medium">
                    Admission Officer Signature
                  </div>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1.5 font-medium">
                    Principal / Authorized Stamp
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2 text-center font-mono text-[10px] text-slate-400">
                Printed on {TODAY_ISO} · {db.settings.academyName} · A4 Official Admission Record
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
