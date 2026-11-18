import {
  AcademyDatabase,
  AttendanceRecord,
  Batch,
  FeeRecord,
  FeeStatus,
  PeriodFilter,
  WhatsAppMessageType,
} from '../types/academy';

export const TODAY_ISO = new Date().toISOString().slice(0, 10);

export function formatCurrency(amount: number, currency = 'PKR'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${Math.round(safe).toLocaleString('en-US')}`;
}

export function generateNextId(prefix: string, existingIds: string[], padLength = 3): string {
  let maxNum = 0;
  for (const id of existingIds) {
    const match = id.match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `${prefix}-${String(maxNum + 1).padStart(padLength, '0')}`;
}

export function computeFeeBalance(fee: FeeRecord): number {
  return Math.max(0, (fee.feeAmount || 0) - (fee.discount || 0) - (fee.amountPaid || 0));
}

export function computeFeeStatus(fee: FeeRecord, referenceDate = TODAY_ISO): FeeStatus {
  const balance = computeFeeBalance(fee);
  if (balance <= 0) return 'Paid';
  const isPastDue = fee.dueDate && fee.dueDate < referenceDate;
  if (isPastDue) return 'Overdue';
  if ((fee.amountPaid || 0) > 0) return 'Partial';
  return 'Unpaid';
}

export function computeStudentAttendancePct(
  studentId: string,
  attendance: AttendanceRecord[]
): number | null {
  const records = attendance.filter((a) => a.studentId === studentId);
  if (records.length === 0) return null;
  const attended = records.filter((a) => a.status === 'Present' || a.status === 'Late').length;
  return Math.round((attended / records.length) * 100);
}

export function computeStudentOutstanding(studentId: string, fees: FeeRecord[]): number {
  return fees
    .filter((f) => f.studentId === studentId)
    .reduce((sum, f) => sum + computeFeeBalance(f), 0);
}

export function computeBatchMetrics(batch: Batch, db: AcademyDatabase) {
  const activeCount = db.students.filter(
    (s) => s.batchId === batch.id && s.status === 'Active'
  ).length;
  const leftCount = db.students.filter(
    (s) => s.batchId === batch.id && s.status === 'Left'
  ).length;
  const seatsLeft = Math.max(0, batch.maxCapacity - activeCount);
  const occupancyPct =
    batch.maxCapacity > 0 ? Math.min(100, Math.round((activeCount / batch.maxCapacity) * 100)) : 0;

  return {
    activeCount,
    leftCount,
    seatsLeft,
    occupancyPct,
  };
}

export function getPeriodBounds(
  period: PeriodFilter,
  customFrom: string,
  customTo: string,
  referenceDate = new Date()
): { from: string; to: string } {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-indexed

  const toIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (period === 'This Month') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return { from: toIso(start), to: toIso(end) };
  }
  if (period === 'Last Month') {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return { from: toIso(start), to: toIso(end) };
  }
  if (period === 'This Year') {
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  if (period === 'Custom') {
    return { from: customFrom || '2000-01-01', to: customTo || '2099-12-31' };
  }
  return { from: '2000-01-01', to: '2099-12-31' };
}

export function isDateInRange(dateStr: string, from: string, to: string): boolean {
  if (!dateStr) return false;
  const normalized = dateStr.slice(0, 10);
  return normalized >= from && normalized <= to;
}

export function formatWhatsAppPhone(rawPhone: string): string {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `92${digits.slice(1)}`;
  }
  if (digits.startsWith('92')) {
    return digits;
  }
  return digits;
}

export function buildWhatsAppMessage(
  type: WhatsAppMessageType,
  params: {
    academyName: string;
    instituteWhatsApp?: string;
    studentName: string;
    studentId: string;
    course: string;
    month?: string;
    dueDate?: string;
    monthlyFee: number;
    outstanding: number;
    lastPaid?: number;
    attendancePct?: number | null;
    currency: string;
  }
): string {
  const {
    academyName,
    instituteWhatsApp,
    studentName,
    studentId,
    course,
    month,
    dueDate,
    monthlyFee,
    outstanding,
    lastPaid,
    attendancePct,
    currency,
  } = params;

  const formattedOfficial = formatWhatsAppPhone(instituteWhatsApp || '');
  const officialLine = formattedOfficial
    ? ` Official WhatsApp Desk: +${formattedOfficial}.`
    : '';

  switch (type) {
    case 'Fee Reminder':
      return `Assalam-o-Alaikum, this is a friendly fee reminder from ${academyName}. Student: ${studentName} (${studentId}) - ${course}. Monthly fee of ${formatCurrency(outstanding > 0 ? outstanding : monthlyFee, currency)}${month ? ` for ${month}` : ''}${dueDate ? ` is due on ${dueDate}` : ''}.${officialLine} Thank you!`;
    case 'Overdue Fee':
      return `Assalam-o-Alaikum, urgent fee notice from ${academyName}. Student: ${studentName} (${studentId}) has an overdue balance of ${formatCurrency(outstanding, currency)}${month ? ` (${month})` : ''}. Kindly clear the dues at your earliest convenience.${officialLine}`;
    case 'Payment Received':
      return `Assalam-o-Alaikum, thank you for your payment to ${academyName}. We have received ${formatCurrency(lastPaid ?? monthlyFee, currency)} for ${studentName} (${studentId}). Remaining balance: ${formatCurrency(outstanding, currency)}.${officialLine}`;
    case 'Low Attendance Alert':
      return `Assalam-o-Alaikum from ${academyName}. Attendance alert for ${studentName} (${studentId}) in ${course}: current attendance is ${attendancePct ?? 0}%, which is below our required threshold. Please ensure regular attendance.${officialLine}`;
  }
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const formatted = formatWhatsAppPhone(phone);
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
}

export function computeDurationLabel(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return '—';
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  if (diffDays < 30) return `${diffDays} days`;
  const months = Math.floor(diffDays / 30);
  const remDays = diffDays % 30;
  return remDays > 0 ? `${months}m ${remDays}d` : `${months} months`;
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (val: string | number) => {
    const str = String(val ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [
    headers.map(escape).join(','),
    ...rows.map((r) => r.map(escape).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getMonthLabel(date = new Date()): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]}-${date.getFullYear()}`;
}

export function triggerA4Print(): void {
  try {
    window.focus();
  } catch {
    // ignore focus restriction in embedded contexts
  }
  window.print();
}

export function normalizeCnic(cnic?: string): string {
  return (cnic || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function formatCnicInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export function generateStudentPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$';
  const pick = (pool: string) => pool.charAt(Math.floor(Math.random() * pool.length));
  const raw = [
    'M',
    't',
    's',
    pick(special),
    pick(upper),
    pick(digits),
    pick(lower),
    pick(digits),
    pick(upper),
    pick(digits),
  ];
  return raw.join('');
}

