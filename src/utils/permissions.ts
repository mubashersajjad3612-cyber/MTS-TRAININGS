import {
  Batch,
  NavSection,
  ReportTab,
  RolePermissionsMap,
  Student,
  UserAccount,
  UserRole,
} from '../types/academy';

export const ALL_ROLES: UserRole[] = [
  'Admin',
  'Manager',
  'Admission Officer',
  'Coordinator',
  'Accountant',
  'Trainer',
  'Student',
];

export const CONFIGURABLE_SECTIONS: { id: NavSection; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'inquiries', label: 'Admission Inquiries' },
  { id: 'students', label: 'Students & Admissions' },
  { id: 'batches', label: 'Batches & Teachers' },
  { id: 'fees', label: 'Fee Management' },
  { id: 'attendance', label: 'Daily Attendance' },
  { id: 'hr', label: 'HR Department' },
  { id: 'expenses', label: 'Expenses & Finance' },
  { id: 'reports', label: 'Reports Center' },
  { id: 'whatsapp', label: 'WhatsApp Reminders' },
  { id: 'users', label: 'Users & Roles' },
  { id: 'settings', label: 'Settings' },
];

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMap = {
  Admin: [
    'dashboard',
    'inquiries',
    'students',
    'batches',
    'fees',
    'attendance',
    'hr',
    'expenses',
    'reports',
    'whatsapp',
    'users',
    'settings',
  ],
  Manager: [
    'dashboard',
    'inquiries',
    'students',
    'batches',
    'fees',
    'attendance',
    'hr',
    'expenses',
    'reports',
    'whatsapp',
  ],
  'Admission Officer': [
    'dashboard',
    'inquiries',
    'students',
    'batches',
    'reports',
    'whatsapp',
  ],
  Coordinator: [
    'dashboard',
    'inquiries',
    'students',
    'batches',
    'attendance',
    'reports',
    'whatsapp',
  ],
  Accountant: [
    'dashboard',
    'fees',
    'hr',
    'expenses',
    'reports',
    'whatsapp',
  ],
  Trainer: [
    'dashboard',
    'batches',
    'students',
    'attendance',
  ],
  Student: ['dashboard'],
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  Admin: 'Full control over all modules, financials, all reports, Google Sheets sync, user accounts, and role rights.',
  Manager: 'Full operational oversight across admissions, academics, HR, accounts, and access to all academy reports.',
  'Admission Officer': 'Manages admission inquiries, student enrollments, batch seat availability, and admission reports.',
  Coordinator: 'Oversees students, batch schedules, daily attendance tracking, inquiries, and academic/student performance reports.',
  Accountant: 'Manages monthly fee vouchers, payroll, expenses, and Accounts reports (fees, defaulters, expense heads, salaries).',
  Trainer: 'Only views batches listed under their name, enrolled students in those batches, and marks daily attendance from their own login ID.',
  Student: 'Personal self-service portal to view batch schedule, attendance percentage, and fee receipts.',
};

export function getAllowedSections(
  role: UserRole,
  customMap?: RolePermissionsMap
): NavSection[] {
  if (role === 'Admin') return DEFAULT_ROLE_PERMISSIONS.Admin;
  if (role === 'Student') return ['dashboard'];
  return customMap?.[role] || DEFAULT_ROLE_PERMISSIONS[role] || ['dashboard'];
}

export function getAllowedReportTabs(role: UserRole): ReportTab[] {
  switch (role) {
    case 'Admin':
    case 'Manager':
      return [
        'admissions',
        'batch-wise',
        'dropouts',
        'fee-collection',
        'defaulters',
        'expenses-heads',
        'salaries-payroll',
        'staff-performance',
        'students-performance',
      ];
    case 'Accountant':
      return ['fee-collection', 'defaulters', 'expenses-heads', 'salaries-payroll'];
    case 'Admission Officer':
      return ['admissions', 'batch-wise', 'dropouts'];
    case 'Coordinator':
      return ['admissions', 'batch-wise', 'dropouts', 'students-performance'];
    case 'Trainer':
      return ['batch-wise', 'students-performance'];
    default:
      return [];
  }
}

export function canSeeFinancialMetrics(role: UserRole): boolean {
  return role === 'Admin' || role === 'Manager' || role === 'Accountant';
}

export function canManageAdmissions(role: UserRole): boolean {
  return (
    role === 'Admin' ||
    role === 'Manager' ||
    role === 'Admission Officer' ||
    role === 'Coordinator'
  );
}

export function canVerifyPayments(role: UserRole): boolean {
  return role === 'Accountant' || role === 'Admin' || role === 'Manager';
}

export function getTrainerDisplayName(user: UserAccount | null | undefined): string {
  return (user?.linkedTeacherName || user?.name || 'Trainer').trim();
}

export function getTrainerMatchName(user: UserAccount | null | undefined): string {
  return (user?.linkedTeacherName || user?.name || '').trim().toLowerCase();
}

export function isBatchAssignedToTrainer(
  batch: Batch,
  user: UserAccount | null | undefined
): boolean {
  const target = getTrainerMatchName(user);
  if (!target) return false;
  return batch.assignedTeacher.trim().toLowerCase() === target;
}

export function getTrainerScopedBatches(
  batches: Batch[],
  userRole: UserRole,
  currentUser: UserAccount | null | undefined
): Batch[] {
  if (userRole !== 'Trainer') return batches;
  return batches.filter((b) => isBatchAssignedToTrainer(b, currentUser));
}

export function getTrainerScopedStudents(
  students: Student[],
  batches: Batch[],
  userRole: UserRole,
  currentUser: UserAccount | null | undefined
): Student[] {
  if (userRole !== 'Trainer') return students;
  const trainerMatch = getTrainerMatchName(currentUser);
  if (!trainerMatch) return [];
  const assignedBatchIds = new Set(
    batches
      .filter((b) => b.assignedTeacher.trim().toLowerCase() === trainerMatch)
      .map((b) => b.id)
  );
  return students.filter(
    (s) =>
      assignedBatchIds.has(s.batchId) ||
      s.teacher.trim().toLowerCase() === trainerMatch
  );
}
