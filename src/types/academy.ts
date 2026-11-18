export type NavSection =
  | 'dashboard'
  | 'inquiries'
  | 'students'
  | 'batches'
  | 'fees'
  | 'attendance'
  | 'hr'
  | 'expenses'
  | 'reports'
  | 'whatsapp'
  | 'users'
  | 'settings';

export type UserRole =
  | 'Admin'
  | 'Manager'
  | 'Admission Officer'
  | 'Coordinator'
  | 'Accountant'
  | 'Trainer'
  | 'Student';

export type PeriodFilter =
  | 'This Month'
  | 'Last Month'
  | 'This Year'
  | 'All Time'
  | 'Custom';

export type InquiryStatus =
  | 'New'
  | 'Contacted'
  | 'Demo Scheduled'
  | 'Converted'
  | 'Closed';

export type InquirySource = 'Walk-in' | 'Social Media' | 'Referral' | 'Call';

export type StudentStatus = 'Active' | 'Left' | 'Completed';

export type TeacherStatus = 'Active' | 'Inactive';

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'JazzCash' | 'EasyPaisa';

export type FeeStatus = 'Paid' | 'Partial' | 'Unpaid' | 'Overdue';

export type AttendanceStatus = 'Present' | 'Absent' | 'Late';

export type ExpenseCategory =
  | 'Rent'
  | 'Salary'
  | 'Electricity'
  | 'Internet'
  | 'Marketing'
  | 'Equipment'
  | 'Misc';

export type WhatsAppMessageType =
  | 'Fee Reminder'
  | 'Overdue Fee'
  | 'Payment Received'
  | 'Low Attendance Alert';

export type ReportTab =
  | 'admissions'
  | 'batch-wise'
  | 'dropouts'
  | 'fee-collection'
  | 'defaulters'
  | 'expenses-heads'
  | 'salaries-payroll'
  | 'staff-performance'
  | 'students-performance';

export type RolePermissionsMap = Record<UserRole, NavSection[]>;

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  linkedStudentId?: string;
  linkedTeacherName?: string;
  status: 'Active' | 'Disabled';
  createdAt: string;
}

export interface AcademySettings {
  academyName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  currency: string;
  defaultDueDay: number;
  lowAttendanceAlertPct: number;
  adminPin: string;
  staffPin: string;
  primaryAdminEmail?: string;
  rolePermissions?: RolePermissionsMap;
}

export interface Inquiry {
  id: string;
  date: string;
  fullName: string;
  fatherName: string;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  email: string;
  interestedCourse: string;
  preferredTiming: string;
  source: InquirySource;
  followUpDate: string;
  status: InquiryStatus;
  remarks: string;
}

export interface Student {
  id: string;
  name: string;
  fatherName: string;
  email?: string;
  cnic?: string;
  photoUrl?: string;
  gender: 'Male' | 'Female' | 'Other';
  studentPhone: string;
  parentPhone: string;
  course: string;
  batchId: string;
  teacher: string;
  monthlyFee: number;
  status: StudentStatus;
  admissionDate: string;
  leftDate: string;
  leftReason: string;
}

export interface Batch {
  id: string;
  batchName: string;
  course: string;
  assignedTeacher: string;
  days: string;
  time: string;
  maxCapacity: number;
  defaultFee: number;
}

export interface Teacher {
  id: string;
  name: string;
  phone: string;
  subject: string;
  monthlySalary: number;
  status: TeacherStatus;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  studentName: string;
  batchId: string;
  month: string; // e.g., "Nov-2026"
  feeAmount: number;
  discount: number;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: PaymentMethod | '';
  dueDate: string;
  isAdmissionFee?: boolean;
  verified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  lastEmailSentAt?: string;
}

export interface EmailDispatchLog {
  id: string;
  date: string;
  studentId: string;
  studentName: string;
  toEmail: string;
  primaryEmail: string;
  type: 'Admission Credentials' | 'Full Payment Receipt' | 'Partial Payment Receipt';
  subject: string;
  textBody?: string;
  verifiedBy: string;
  deliveryStatus: 'Sent via Gmail' | 'Prepared via Mail App' | 'Saved (No API / Offline)';
}

export interface AttendanceRecord {
  date: string;
  studentId: string;
  studentName: string;
  batchId: string;
  status: AttendanceStatus;
  remarks: string;
}

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paidBy: string;
}

export interface WhatsAppLog {
  id: string;
  date: string;
  studentId: string;
  studentName: string;
  phone: string;
  messageType: WhatsAppMessageType;
  status: 'Sent' | 'Opened';
}

export type StaffDepartment =
  | 'Academic / Faculty'
  | 'Admissions'
  | 'Administration'
  | 'Finance'
  | 'Support & Operations';

export type EmploymentType = 'Full-Time' | 'Part-Time' | 'Contract' | 'Visiting';

export type StaffStatus = 'Active' | 'On Leave' | 'Resigned';

export interface StaffMember {
  id: string;
  name: string;
  fatherName: string;
  phone: string;
  email: string;
  cnic: string;
  designation: string;
  department: StaffDepartment;
  employmentType: EmploymentType;
  joiningDate: string;
  baseSalary: number;
  defaultAllowance: number;
  bankAccount: string;
  linkedTeacherId?: string;
  status: StaffStatus;
  emergencyContact: string;
}

export type PayrollStatus = 'Draft' | 'Approved' | 'Paid';

export interface PayrollRecord {
  id: string;
  staffId: string;
  staffName: string;
  designation: string;
  department: string;
  month: string; // e.g., "Nov-2026"
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  baseSalary: number;
  allowances: number;
  bonuses: number;
  overtimePay: number;
  deductions: number;
  advanceRecovery: number;
  netSalary: number;
  status: PayrollStatus;
  paymentDate: string;
  paymentMethod: PaymentMethod | '';
  remarks: string;
}

export interface AcademyDatabase {
  settings: AcademySettings;
  users: UserAccount[];
  inquiries: Inquiry[];
  students: Student[];
  batches: Batch[];
  teachers: Teacher[];
  hrStaff: StaffMember[];
  payroll: PayrollRecord[];
  fees: FeeRecord[];
  attendance: AttendanceRecord[];
  expenses: Expense[];
  whatsappLogs: WhatsAppLog[];
  emailLogs?: EmailDispatchLog[];
}

export interface PendingSheetConfirmation {
  title: string;
  description: string;
  affectedTab: string;
  confirmLabel: string;
  isDestructive?: boolean;
  emailPreview?: {
    to: string;
    primaryEmail: string;
    subject: string;
    textBody?: string;
    highlights: { label: string; value: string }[];
    gmailConnected: boolean;
  };
  onConnectGmail?: () => Promise<void>;
  onConfirm: () => Promise<void>;
}
