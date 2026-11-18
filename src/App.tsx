import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { MTSLogo } from './components/MTSLogo';
import { AttendanceView } from './components/AttendanceView';
import { BatchesTeachersView } from './components/BatchesTeachersView';
import { ConfirmModal } from './components/ConfirmModal';
import { DashboardHome } from './components/DashboardHome';
import { ExpensesView } from './components/ExpensesView';
import { FeesView } from './components/FeesView';
import { HRDepartmentView } from './components/HRDepartmentView';
import { InquiriesView } from './components/InquiriesView';
import { KioskInquiryView } from './components/KioskInquiryView';
import { LoginScreen } from './components/LoginScreen';
import { ReportsCenter } from './components/ReportsCenter';
import { SettingsView } from './components/SettingsView';
import { StudentPortalView } from './components/StudentPortalView';
import { StudentsView } from './components/StudentsView';
import { UsersRolesView } from './components/UsersRolesView';
import { WhatsAppView } from './components/WhatsAppView';
import { INITIAL_ACADEMY_DATA } from './data/seedData';
import {
  getAccessToken,
  getSignedInGoogleEmail,
  googleSignIn,
  initAuth,
  logoutGoogle,
} from './services/googleAuth';
import {
  buildAdmissionCredentialsEmail,
  buildPaymentReceiptEmail,
  sendGmailMessage,
} from './services/gmail';
import {
  createAcademySpreadsheet,
  pullAcademyDataFromSheet,
  SheetTabName,
  syncAllTabsToSheet,
  syncTabToSheet,
} from './services/googleSheets';
import {
  AcademyDatabase,
  AcademySettings,
  AttendanceRecord,
  Batch,
  EmailDispatchLog,
  Expense,
  FeeRecord,
  Inquiry,
  NavSection,
  PaymentMethod,
  PayrollRecord,
  PendingSheetConfirmation,
  RolePermissionsMap,
  StaffMember,
  Student,
  Teacher,
  UserAccount,
  UserRole,
  WhatsAppMessageType,
} from './types/academy';
import {
  computeFeeBalance,
  formatCurrency,
  generateNextId,
  generateStudentPassword,
  normalizeCnic,
  TODAY_ISO,
} from './utils/calculations';
import {
  canVerifyPayments,
  DEFAULT_ROLE_PERMISSIONS,
  getAllowedSections,
  isBatchAssignedToTrainer,
} from './utils/permissions';

const DB_STORAGE_KEY = 'mts_academy_os_fresh_v2';
const LEGACY_DB_STORAGE_KEY = 'mts_academy_os_db_v1';
const SHEET_META_STORAGE_KEY = 'mts_academy_os_sheet_meta_v1';

type NavGroup = 'Core Operations' | 'Finance & People' | 'Insights & System';

const NAV_ITEMS: {
  id: NavSection;
  label: string;
  description: string;
  group: NavGroup;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Executive metrics, cashflow, and batch capacity overview',
    group: 'Core Operations',
    icon: LayoutDashboard,
  },
  {
    id: 'inquiries',
    label: 'Admission Inquiries',
    description: 'Prospective student pipeline, follow-ups, and walk-in kiosk',
    group: 'Core Operations',
    icon: ClipboardList,
  },
  {
    id: 'students',
    label: 'Students & Admissions',
    description: 'Enrollments, unique CNIC registry, student photos, and A4 forms',
    group: 'Core Operations',
    icon: Users,
  },
  {
    id: 'batches',
    label: 'Batches & Teachers',
    description: 'Class schedules, seat capacities, and faculty directory',
    group: 'Core Operations',
    icon: BookOpen,
  },
  {
    id: 'attendance',
    label: 'Daily Attendance',
    description: 'Batch-wise daily attendance register and absence alerts',
    group: 'Core Operations',
    icon: CalendarCheck,
  },
  {
    id: 'fees',
    label: 'Fee Management',
    description: 'Vouchers, Accountant payment verification, and automated Gmail receipts',
    group: 'Finance & People',
    icon: CreditCard,
  },
  {
    id: 'hr',
    label: 'HR Department',
    description: 'Staff records, monthly payroll calculation, and printable payslips',
    group: 'Finance & People',
    icon: Briefcase,
  },
  {
    id: 'expenses',
    label: 'Expenses & Finance',
    description: 'Academy operating expenses across all accounting heads',
    group: 'Finance & People',
    icon: Receipt,
  },
  {
    id: 'reports',
    label: 'Reports Center',
    description: 'Role-scoped A4 printable operational, finance, and performance reports',
    group: 'Insights & System',
    icon: BarChart3,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Reminders',
    description: 'Fee reminder templates and direct student/parent outreach log',
    group: 'Insights & System',
    icon: MessageCircle,
  },
  {
    id: 'users',
    label: 'Users & Roles',
    description: 'Staff Gmail credentials and role-based module permissions',
    group: 'Insights & System',
    icon: ShieldCheck,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Institute identity, primary email, and Google Sheets synchronization',
    group: 'Insights & System',
    icon: Settings,
  },
];

const NAV_GROUPS: NavGroup[] = ['Core Operations', 'Finance & People', 'Insights & System'];

export default function App() {
  const [db, setDb] = useState<AcademyDatabase>(() => {
    try {
      localStorage.removeItem(LEGACY_DB_STORAGE_KEY);
      const saved = localStorage.getItem(DB_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AcademyDatabase>;
        const rawUsers =
          Array.isArray(parsed.users) && parsed.users.length > 0
            ? parsed.users
            : INITIAL_ACADEMY_DATA.users;
        const hasPrimaryUser = rawUsers.some(
          (u) => u.email.toLowerCase() === 'mts.training2026@gmail.com'
        );
        const mergedUsers = hasPrimaryUser
          ? rawUsers
          : [
              ...rawUsers,
              ...INITIAL_ACADEMY_DATA.users.filter(
                (u) => u.email.toLowerCase() === 'mts.training2026@gmail.com'
              ),
            ];
        const parsedEmail = parsed.settings?.email;
        const resolvedPrimaryEmail =
          !parsedEmail || parsedEmail === 'admissions@mtstrainings.edu.pk'
            ? 'mts.training2026@gmail.com'
            : parsedEmail;

        return {
          ...INITIAL_ACADEMY_DATA,
          ...parsed,
          settings: {
            ...INITIAL_ACADEMY_DATA.settings,
            ...(parsed.settings || {}),
            email: resolvedPrimaryEmail,
            primaryAdminEmail:
              parsed.settings?.primaryAdminEmail || 'mts.training2026@gmail.com',
            rolePermissions: {
              ...DEFAULT_ROLE_PERMISSIONS,
              ...(parsed.settings?.rolePermissions || {}),
            },
          },
          users: mergedUsers,
          hrStaff: Array.isArray(parsed.hrStaff) ? parsed.hrStaff : [],
          payroll: Array.isArray(parsed.payroll) ? parsed.payroll : [],
          emailLogs: Array.isArray(parsed.emailLogs) ? parsed.emailLogs : [],
        };
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_ACADEMY_DATA;
  });

  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    try {
      const meta = localStorage.getItem(SHEET_META_STORAGE_KEY);
      if (meta) return JSON.parse(meta).id || null;
    } catch {
      // ignore
    }
    return null;
  });

  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string | null>(() => {
    try {
      const meta = localStorage.getItem(SHEET_META_STORAGE_KEY);
      if (meta) return JSON.parse(meta).title || null;
    } catch {
      // ignore
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('Admin');
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const isAuthenticatedRef = React.useRef(false);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const [isKioskMode, setIsKioskMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('kiosk') === 'inquiry';
  });

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingConversion, setPendingConversion] = useState<Inquiry | null>(null);
  const [waPreselectedStudentId, setWaPreselectedStudentId] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingSheetConfirmation | null>(null);
  const [syncBanner, setSyncBanner] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
    } catch {
      // ignore
    }
  }, [db]);

  useEffect(() => {
    try {
      if (spreadsheetId) {
        localStorage.setItem(
          SHEET_META_STORAGE_KEY,
          JSON.stringify({ id: spreadsheetId, title: spreadsheetTitle })
        );
      } else {
        localStorage.removeItem(SHEET_META_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [spreadsheetId, spreadsheetTitle]);

  const resolveGoogleAccount = useCallback(
    (email: string, displayName: string | null): { allowed: boolean; account: UserAccount | null; reason?: string } => {
      const normalized = email.trim().toLowerCase();
      const matched = db.users.find((u) => u.email.toLowerCase() === normalized);
      if (matched) {
        if (matched.status === 'Disabled') {
          return {
            allowed: false,
            account: null,
            reason: 'This user account has been disabled by the Admin.',
          };
        }
        return { allowed: true, account: matched };
      }

      // First-time owner / primary Google sign-in defaults to Admin if not yet added
      const fallbackAdmin: UserAccount = {
        id: 'U-GOOGLE',
        name: displayName || normalized,
        email: normalized,
        password: '',
        role: 'Admin',
        status: 'Active',
        createdAt: TODAY_ISO,
      };
      return { allowed: true, account: fallbackAdmin };
    },
    [db.users]
  );

  useEffect(() => {
    const unsub = initAuth(
      (user) => {
        const email = user.email || '';
        // Preserve active role-based session (e.g. Accountant) if user is already signed in
        if (isAuthenticatedRef.current) {
          setGoogleEmail(email || user.displayName || 'Google User');
          return;
        }
        const resolved = resolveGoogleAccount(email, user.displayName);
        if (!resolved.allowed || !resolved.account) {
          logoutGoogle();
          setGoogleEmail(null);
          setIsAuthenticated(false);
          return;
        }
        setGoogleEmail(email || user.displayName || 'Google User');
        setCurrentUser(resolved.account);
        setUserRole(resolved.account.role);
        setIsAuthenticated(true);
      },
      () => {
        setGoogleEmail(null);
      }
    );
    return () => unsub();
  }, [resolveGoogleAccount]);

  const allowedSections = useMemo(
    () => getAllowedSections(userRole, db.settings.rolePermissions),
    [userRole, db.settings.rolePermissions]
  );

  const visibleNavItems = useMemo(() => {
    if (userRole === 'Student') {
      return [
        {
          id: 'dashboard' as NavSection,
          label: 'Student Portal',
          description: 'Enrolled course details, attendance history, and fee receipts',
          group: 'Core Operations' as NavGroup,
          icon: LayoutDashboard,
        },
      ];
    }
    return NAV_ITEMS.filter((item) => allowedSections.includes(item.id)).map((item) => {
      if (userRole === 'Trainer') {
        if (item.id === 'batches') return { ...item, label: 'My Batches' };
        if (item.id === 'students') return { ...item, label: 'My Students' };
      }
      return item;
    });
  }, [userRole, allowedSections]);

  // Ensure activeSection stays within permitted modules
  useEffect(() => {
    if (!allowedSections.includes(activeSection)) {
      setActiveSection(allowedSections[0] || 'dashboard');
    }
  }, [allowedSections, activeSection]);

  const showToast = (msg: string) => {
    setSyncBanner(msg);
    setTimeout(() => setSyncBanner(null), 3500);
  };

  // Helper: optionally prompt for Google Sheets sync after state mutation
  const queueSheetSync = useCallback(
    (tab: SheetTabName, nextDb: AcademyDatabase, description: string, isDestructive = false) => {
      const token = getAccessToken();
      if (!token || !spreadsheetId) return;
      setPendingConfirmation({
        title: `Sync ${tab} to Google Sheets?`,
        description,
        affectedTab: tab,
        confirmLabel: isDestructive ? 'Confirm & Sync Delete' : 'Confirm & Sync Sheet',
        isDestructive,
        onConfirm: async () => {
          await syncTabToSheet(token, spreadsheetId, tab, nextDb);
          await syncTabToSheet(token, spreadsheetId, 'HOME', nextDb);
          showToast(`Synced ${tab} to Google Sheets.`);
        },
      });
    },
    [spreadsheetId]
  );

  // Auth handlers
  const handleGoogleLogin = async () => {
    const res = await googleSignIn();
    const email = res.user.email || '';
    const resolved = resolveGoogleAccount(email, res.user.displayName);
    if (!resolved.allowed || !resolved.account) {
      await logoutGoogle();
      throw new Error(resolved.reason || 'Access denied.');
    }
    setGoogleEmail(email || res.user.displayName || 'Google User');
    setCurrentUser(resolved.account);
    setUserRole(resolved.account.role);
    setActiveSection('dashboard');
    setIsAuthenticated(true);
  };

  // Connect Gmail for sending emails without replacing the active role (e.g. Accountant)
  const handleConnectGmailOnly = async () => {
    const res = await googleSignIn();
    const email = res.user.email || res.user.displayName || 'Google User';
    setGoogleEmail(email);
    showToast(`Gmail connected (${email}) for automated student verification emails.`);
  };

  const handleEmailPasswordLogin = (
    emailInput: string,
    passwordInput: string
  ): { ok: boolean; error?: string } => {
    const normalized = emailInput.trim().toLowerCase();
    const matched = db.users.find((u) => u.email.toLowerCase() === normalized);
    if (!matched) {
      return {
        ok: false,
        error: 'No account found for this Gmail. Ask the Admin to add your Gmail in Users & Roles.',
      };
    }
    if (matched.status === 'Disabled') {
      return {
        ok: false,
        error: 'This user account is currently disabled. Contact the Admin.',
      };
    }
    if (matched.password !== passwordInput.trim()) {
      return {
        ok: false,
        error: 'Incorrect password. Please try again.',
      };
    }
    setCurrentUser(matched);
    setUserRole(matched.role);
    setActiveSection('dashboard');
    setIsAuthenticated(true);
    return { ok: true };
  };

  const handleLogout = async () => {
    if (googleEmail) {
      await logoutGoogle();
    }
    setGoogleEmail(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setActiveSection('dashboard');
  };

  // Google Sheets management handlers
  const handleCreateSpreadsheet = async () => {
    const token = getAccessToken();
    if (!token) throw new Error('Please sign in with Google first.');
    const created = await createAcademySpreadsheet(token, db);
    setSpreadsheetId(created.spreadsheetId);
    setSpreadsheetTitle(created.title);
    showToast(`Created "${created.title}" with all tabs including USERS.`);
  };

  const handleConnectSpreadsheet = async (id: string) => {
    const token = getAccessToken();
    if (!token) throw new Error('Please sign in with Google first.');
    const pulled = await pullAcademyDataFromSheet(token, id, db.settings);
    setSpreadsheetId(id);
    setSpreadsheetTitle(pulled.title);
    setDb((prev) => ({
      ...pulled.db,
      users: pulled.db.users.length > 0 ? pulled.db.users : prev.users,
    }));
    showToast(`Connected and synced from "${pulled.title}".`);
  };

  const handlePullFromSheet = async () => {
    const token = getAccessToken();
    if (!token || !spreadsheetId) throw new Error('Connect a Google Sheet first.');
    const pulled = await pullAcademyDataFromSheet(token, spreadsheetId, db.settings);
    setSpreadsheetTitle(pulled.title);
    setDb((prev) => ({
      ...pulled.db,
      users: pulled.db.users.length > 0 ? pulled.db.users : prev.users,
    }));
    showToast(`Pulled latest data from "${pulled.title}".`);
  };

  const handlePushAllToSheet = () => {
    const token = getAccessToken();
    if (!token || !spreadsheetId) return;
    setPendingConfirmation({
      title: 'Push All Tabs to Google Sheets?',
      description: `This will overwrite all tabs in "${spreadsheetTitle || spreadsheetId}" with your current Academy OS records.`,
      affectedTab: 'ALL TABS',
      confirmLabel: 'Overwrite & Sync All Tabs',
      onConfirm: async () => {
        await syncAllTabsToSheet(token, spreadsheetId, db);
        showToast('All tabs synced to Google Sheets.');
      },
    });
  };

  // User & Role Management (Admin Only)
  const handleSaveUser = (userData: Omit<UserAccount, 'id'> & { id?: string }) => {
    const isEdit = Boolean(userData.id);
    const id = userData.id || generateNextId('U', db.users.map((u) => u.id));
    const record: UserAccount = { ...userData, id };
    const nextDb: AcademyDatabase = {
      ...db,
      users: isEdit
        ? db.users.map((u) => (u.id === id ? record : u))
        : [...db.users, record],
    };
    setDb(nextDb);
    showToast(
      isEdit
        ? `Updated ${record.name} (${record.role}).`
        : `Added ${record.email} as ${record.role}.`
    );
    queueSheetSync(
      'USERS',
      nextDb,
      `${isEdit ? 'Update' : 'Add'} user ${record.email} (${record.role}) in Google Sheets?`
    );
  };

  const handleDeleteUser = (id: string) => {
    const target = db.users.find((u) => u.id === id);
    const nextDb: AcademyDatabase = {
      ...db,
      users: db.users.filter((u) => u.id !== id),
    };
    const token = getAccessToken();
    setPendingConfirmation({
      title: `Remove User ${target?.email || id}?`,
      description: `Revoke access for ${target?.name || id} (${target?.role || ''})?`,
      affectedTab: 'USERS',
      confirmLabel: 'Delete User',
      isDestructive: true,
      onConfirm: async () => {
        setDb(nextDb);
        if (token && spreadsheetId) {
          await syncTabToSheet(token, spreadsheetId, 'USERS', nextDb);
        }
      },
    });
  };

  const handleUpdateRolePermissions = (nextMap: RolePermissionsMap) => {
    const nextDb: AcademyDatabase = {
      ...db,
      settings: {
        ...db.settings,
        rolePermissions: nextMap,
      },
    };
    setDb(nextDb);
    showToast('Updated role permissions.');
  };

  // CRUD Mutations
  const handleSaveInquiry = async (
    inqData: Omit<Inquiry, 'id' | 'date' | 'status'> & {
      id?: string;
      date?: string;
      status?: Inquiry['status'];
    }
  ) => {
    const isEdit = Boolean(inqData.id);
    const id = inqData.id || generateNextId('INQ', db.inquiries.map((i) => i.id));
    const entry: Inquiry = {
      id,
      date: inqData.date || TODAY_ISO,
      fullName: inqData.fullName,
      fatherName: inqData.fatherName,
      gender: inqData.gender,
      phone: inqData.phone,
      email: inqData.email,
      interestedCourse: inqData.interestedCourse,
      preferredTiming: inqData.preferredTiming,
      source: inqData.source,
      followUpDate: inqData.followUpDate,
      status: inqData.status || 'New',
      remarks: inqData.remarks,
    };

    const nextDb: AcademyDatabase = {
      ...db,
      inquiries: isEdit
        ? db.inquiries.map((i) => (i.id === id ? entry : i))
        : [entry, ...db.inquiries],
    };
    setDb(nextDb);
    queueSheetSync(
      'INQUIRIES',
      nextDb,
      `${isEdit ? 'Update' : 'Add'} inquiry ${id} (${entry.fullName}) in Google Sheets?`
    );
  };

  const handleDeleteInquiry = (id: string) => {
    const target = db.inquiries.find((i) => i.id === id);
    const nextDb: AcademyDatabase = {
      ...db,
      inquiries: db.inquiries.filter((i) => i.id !== id),
    };
    const token = getAccessToken();
    setPendingConfirmation({
      title: `Delete Inquiry ${id}?`,
      description: `Permanently remove inquiry for ${target?.fullName || id}${
        token && spreadsheetId ? ' and update the INQUIRIES tab in Google Sheets' : ''
      }?`,
      affectedTab: 'INQUIRIES',
      confirmLabel: 'Delete Inquiry',
      isDestructive: true,
      onConfirm: async () => {
        setDb(nextDb);
        if (token && spreadsheetId) {
          await syncTabToSheet(token, spreadsheetId, 'INQUIRIES', nextDb);
        }
      },
    });
  };

  const handleConvertInquiry = (inq: Inquiry) => {
    setPendingConversion(inq);
    setActiveSection('students');
  };

  const handleSaveStudent = (
    studentData: Omit<Student, 'id'> & { id?: string },
    convertedInquiryId?: string,
    initialFeePackage?: {
      feeAmount: number;
      discount: number;
      amountPaid: number;
      paymentMethod: PaymentMethod;
      month: string;
      dueDate: string;
    }
  ): { student: Student; initialFee?: FeeRecord } => {
    const isEdit = Boolean(studentData.id);
    const normalizedCnic = normalizeCnic(studentData.cnic);
    if (normalizedCnic) {
      const duplicate = db.students.find(
        (s) =>
          s.id !== studentData.id &&
          s.cnic &&
          normalizeCnic(s.cnic) === normalizedCnic
      );
      if (duplicate) {
        const msg = `CNIC No. ${studentData.cnic} already exists in student record (${duplicate.id} — ${duplicate.name}).`;
        showToast(msg);
        throw new Error(msg);
      }
    }

    const id = studentData.id || generateNextId('S', db.students.map((s) => s.id));
    const record: Student = {
      ...studentData,
      id,
      email: (studentData.email || '').trim().toLowerCase(),
      cnic: (studentData.cnic || '').trim(),
      photoUrl: studentData.photoUrl || '',
    };

    const nextStudents = isEdit
      ? db.students.map((s) => (s.id === id ? record : s))
      : [...db.students, record];

    const nextInquiries = convertedInquiryId
      ? db.inquiries.map((i) =>
          i.id === convertedInquiryId ? { ...i, status: 'Converted' as const } : i
        )
      : db.inquiries;

    let initialFee: FeeRecord | undefined;
    let nextFees = db.fees;
    if (!isEdit && initialFeePackage) {
      const feeId = generateNextId('F', db.fees.map((f) => f.id));
      initialFee = {
        id: feeId,
        studentId: record.id,
        studentName: record.name,
        batchId: record.batchId,
        month: initialFeePackage.month,
        feeAmount: initialFeePackage.feeAmount,
        discount: initialFeePackage.discount,
        amountPaid: initialFeePackage.amountPaid,
        paymentDate: initialFeePackage.amountPaid > 0 ? record.admissionDate || TODAY_ISO : '',
        paymentMethod: initialFeePackage.amountPaid > 0 ? initialFeePackage.paymentMethod : '',
        dueDate: initialFeePackage.dueDate,
        isAdmissionFee: true,
        verified: false,
      };
      nextFees = [...db.fees, initialFee];
    }

    const nextDb: AcademyDatabase = {
      ...db,
      students: nextStudents,
      inquiries: nextInquiries,
      fees: nextFees,
    };
    setDb(nextDb);

    const token = getAccessToken();
    if (token && spreadsheetId) {
      setPendingConfirmation({
        title: initialFee
          ? 'Sync STUDENTS & FEES to Google Sheets?'
          : 'Sync STUDENTS to Google Sheets?',
        description: `${isEdit ? 'Update' : 'Add'} student ${id} (${record.name})${
          initialFee ? ` and initial fee voucher ${initialFee.id}` : ''
        } in Google Sheets?`,
        affectedTab: 'STUDENTS',
        confirmLabel: 'Confirm & Sync Sheet',
        onConfirm: async () => {
          await syncTabToSheet(token, spreadsheetId, 'STUDENTS', nextDb);
          if (initialFee) {
            await syncTabToSheet(token, spreadsheetId, 'FEES', nextDb);
          }
          await syncTabToSheet(token, spreadsheetId, 'HOME', nextDb);
          showToast(
            initialFee
              ? 'Synced STUDENTS & FEES to Google Sheets.'
              : 'Synced STUDENTS to Google Sheets.'
          );
        },
      });
    }

    return { student: record, initialFee };
  };

  const handleDeleteStudent = (id: string) => {
    const target = db.students.find((s) => s.id === id);
    const nextDb: AcademyDatabase = {
      ...db,
      students: db.students.filter((s) => s.id !== id),
    };
    const token = getAccessToken();
    setPendingConfirmation({
      title: `Delete Student ${id}?`,
      description: `Remove ${target?.name || id} from the student directory${
        token && spreadsheetId ? ' and update the STUDENTS tab in Google Sheets' : ''
      }?`,
      affectedTab: 'STUDENTS',
      confirmLabel: 'Delete Student',
      isDestructive: true,
      onConfirm: async () => {
        setDb(nextDb);
        if (token && spreadsheetId) {
          await syncTabToSheet(token, spreadsheetId, 'STUDENTS', nextDb);
        }
      },
    });
  };

  const handleSaveBatch = (batchData: Omit<Batch, 'id'> & { id?: string }) => {
    const isEdit = Boolean(batchData.id);
    const id = batchData.id || generateNextId('B', db.batches.map((b) => b.id), 2);
    const record: Batch = { ...batchData, id };
    const nextDb: AcademyDatabase = {
      ...db,
      batches: isEdit
        ? db.batches.map((b) => (b.id === id ? record : b))
        : [...db.batches, record],
    };
    setDb(nextDb);
    queueSheetSync('BATCHES', nextDb, `${isEdit ? 'Update' : 'Create'} batch ${id} in Google Sheets?`);
  };

  const handleDeleteBatch = (id: string) => {
    const nextDb: AcademyDatabase = {
      ...db,
      batches: db.batches.filter((b) => b.id !== id),
    };
    const token = getAccessToken();
    setPendingConfirmation({
      title: `Delete Batch ${id}?`,
      description: `Remove batch ${id} from your schedule?`,
      affectedTab: 'BATCHES',
      confirmLabel: 'Delete Batch',
      isDestructive: true,
      onConfirm: async () => {
        setDb(nextDb);
        if (token && spreadsheetId) {
          await syncTabToSheet(token, spreadsheetId, 'BATCHES', nextDb);
        }
      },
    });
  };

  const handleSaveTeacher = (teacherData: Omit<Teacher, 'id'> & { id?: string }) => {
    const isEdit = Boolean(teacherData.id);
    const id = teacherData.id || generateNextId('T', db.teachers.map((t) => t.id));
    const record: Teacher = { ...teacherData, id };
    const nextDb: AcademyDatabase = {
      ...db,
      teachers: isEdit
        ? db.teachers.map((t) => (t.id === id ? record : t))
        : [...db.teachers, record],
    };
    setDb(nextDb);
    queueSheetSync('TEACHERS', nextDb, `${isEdit ? 'Update' : 'Add'} teacher ${id} in Google Sheets?`);
  };

  const handleDeleteTeacher = (id: string) => {
    const nextDb: AcademyDatabase = {
      ...db,
      teachers: db.teachers.filter((t) => t.id !== id),
    };
    const token = getAccessToken();
    setPendingConfirmation({
      title: `Delete Teacher ${id}?`,
      description: `Remove teacher ${id} from faculty records?`,
      affectedTab: 'TEACHERS',
      confirmLabel: 'Delete Teacher',
      isDestructive: true,
      onConfirm: async () => {
        setDb(nextDb);
        if (token && spreadsheetId) {
          await syncTabToSheet(token, spreadsheetId, 'TEACHERS', nextDb);
        }
      },
    });
  };

  const handleGenerateVouchers = (params: {
    scope: 'batch' | 'student';
    batchId: string;
    studentId: string;
    month: string;
    dueDate: string;
  }) => {
    const targetStudents =
      params.scope === 'batch'
        ? db.students.filter((s) => s.batchId === params.batchId && s.status === 'Active')
        : db.students.filter((s) => s.id === params.studentId);

    const existingIds = db.fees.map((f) => f.id);
    const newFees = [...db.fees];
    let createdCount = 0;

    for (const s of targetStudents) {
      const alreadyExists = newFees.some(
        (f) => f.studentId === s.id && f.month.toLowerCase() === params.month.toLowerCase()
      );
      if (alreadyExists) continue;
      const nextId = generateNextId('F', existingIds);
      existingIds.push(nextId);
      newFees.push({
        id: nextId,
        studentId: s.id,
        studentName: s.name,
        batchId: s.batchId,
        month: params.month,
        feeAmount: s.monthlyFee,
        discount: 0,
        amountPaid: 0,
        paymentDate: '',
        paymentMethod: '',
        dueDate: params.dueDate,
      });
      createdCount += 1;
    }

    if (createdCount === 0) {
      showToast('All selected students already have vouchers for this month.');
      return;
    }

    const nextDb: AcademyDatabase = { ...db, fees: newFees };
    setDb(nextDb);
    showToast(`Generated ${createdCount} fee voucher(s) for ${params.month}.`);
    queueSheetSync('FEES', nextDb, `Sync ${createdCount} new fee vouchers for ${params.month} to Google Sheets?`);
  };

  const triggerVerificationAndEmail = (targetFee: FeeRecord, feesSnapshot: FeeRecord[]) => {
    if (!canVerifyPayments(userRole)) {
      showToast('Only Accountant, Manager, or Admin can verify payments and email credentials.');
      return;
    }

    const student = db.students.find((s) => s.id === targetFee.studentId);
    const studentEmail = (student?.email || '').trim().toLowerCase();
    if (!student || !studentEmail || !studentEmail.includes('@')) {
      showToast(
        `Missing student email for ${targetFee.studentName} (${targetFee.studentId}). Please add email in Students & Admissions first.`
      );
      return;
    }

    const primaryEmail =
      db.settings.email || db.settings.primaryAdminEmail || 'mts.training2026@gmail.com';
    const verifierLabel = `${currentUser?.name || googleEmail || userRole} (${userRole})`;
    const currency = db.settings.currency || 'PKR';

    const existingStudentUser = db.users.find(
      (u) =>
        u.role === 'Student' &&
        (u.linkedStudentId === student.id || u.email.toLowerCase() === studentEmail)
    );

    const isAdmissionCredentialIssue = !existingStudentUser;
    const generatedPassword = isAdmissionCredentialIssue ? generateStudentPassword() : '';
    const newStudentUser: UserAccount | null = isAdmissionCredentialIssue
      ? {
          id: generateNextId('U', db.users.map((u) => u.id)),
          name: student.name,
          email: studentEmail,
          password: generatedPassword,
          role: 'Student',
          linkedStudentId: student.id,
          status: 'Active',
          createdAt: TODAY_ISO,
        }
      : null;

    const portalUrl = window.location.origin;
    const emailPayload = isAdmissionCredentialIssue
      ? buildAdmissionCredentialsEmail({
          academyName: db.settings.academyName,
          primaryEmail,
          academyPhone: db.settings.phone,
          currency,
          portalUrl,
          student,
          fee: targetFee,
          loginEmail: studentEmail,
          generatedPassword,
          verifiedBy: verifierLabel,
          verifiedAt: TODAY_ISO,
        })
      : buildPaymentReceiptEmail({
          academyName: db.settings.academyName,
          primaryEmail,
          academyPhone: db.settings.phone,
          currency,
          student,
          fee: targetFee,
          verifiedBy: verifierLabel,
          verifiedAt: TODAY_ISO,
        });

    const balance = computeFeeBalance(targetFee);
    const emailType: EmailDispatchLog['type'] = isAdmissionCredentialIssue
      ? 'Admission Credentials'
      : balance > 0
        ? 'Partial Payment Receipt'
        : 'Full Payment Receipt';

    const currentToken = getAccessToken();

    setPendingConfirmation({
      title: isAdmissionCredentialIssue
        ? `Verify Admission & Email Login to ${student.name}?`
        : `Verify Payment & Email Receipt (${targetFee.id})?`,
      description: isAdmissionCredentialIssue
        ? `Accountant verification for ${student.name} (${student.id}) will activate their Student Portal Login (${studentEmail}) with an auto-generated password and email it to the student.`
        : `Accountant verification for ${targetFee.id} (${targetFee.month}) will email a ${
            balance > 0 ? 'partial payment' : 'full payment'
          } receipt to ${studentEmail}.`,
      affectedTab: 'FEES + GMAIL',
      confirmLabel: currentToken ? 'Verify & Send Email via Gmail' : 'Verify & Save Log',
      emailPreview: {
        to: studentEmail,
        primaryEmail,
        subject: emailPayload.subject,
        textBody: emailPayload.textBody,
        gmailConnected: Boolean(currentToken),
        highlights: isAdmissionCredentialIssue
          ? [
              { label: 'Login ID (Email)', value: studentEmail },
              { label: 'Auto-Generated Password', value: generatedPassword },
              { label: 'Amount Paid', value: formatCurrency(targetFee.amountPaid, currency) },
              { label: 'Balance Remaining', value: formatCurrency(balance, currency) },
            ]
          : [
              { label: 'Payment Type', value: balance > 0 ? 'Partial Payment' : 'Full Payment' },
              { label: 'Amount Paid', value: formatCurrency(targetFee.amountPaid, currency) },
              { label: 'Remaining Balance', value: formatCurrency(balance, currency) },
              { label: 'Verified By', value: verifierLabel },
            ],
      },
      onConnectGmail: handleConnectGmailOnly,
      onConfirm: async () => {
        const liveToken = getAccessToken();
        const connectedSender = getSignedInGoogleEmail() || googleEmail;
        let deliveryStatus: EmailDispatchLog['deliveryStatus'] = 'Saved (No API / Offline)';

        if (liveToken) {
          await sendGmailMessage(liveToken, {
            to: studentEmail,
            replyTo: primaryEmail,
            senderName: db.settings.academyName,
            senderEmail: connectedSender || undefined,
            subject: emailPayload.subject,
            htmlBody: emailPayload.htmlBody,
            textBody: emailPayload.textBody,
          });
          deliveryStatus = 'Sent via Gmail';
        }

        const verifiedFee: FeeRecord = {
          ...targetFee,
          verified: true,
          verifiedBy: verifierLabel,
          verifiedAt: TODAY_ISO,
          lastEmailSentAt: liveToken ? TODAY_ISO : targetFee.lastEmailSentAt,
        };

        const logEntry: EmailDispatchLog = {
          id: generateNextId('EM', (db.emailLogs || []).map((l) => l.id)),
          date: TODAY_ISO,
          studentId: student.id,
          studentName: student.name,
          toEmail: studentEmail,
          primaryEmail,
          type: emailType,
          subject: emailPayload.subject,
          textBody: emailPayload.textBody,
          verifiedBy: verifierLabel,
          deliveryStatus,
        };

        const nextDb: AcademyDatabase = {
          ...db,
          fees: feesSnapshot.map((f) => (f.id === targetFee.id ? verifiedFee : f)),
          users: newStudentUser ? [...db.users, newStudentUser] : db.users,
          emailLogs: [...(db.emailLogs || []), logEntry],
        };
        setDb(nextDb);

        if (liveToken && spreadsheetId) {
          await syncTabToSheet(liveToken, spreadsheetId, 'FEES', nextDb);
          if (newStudentUser) {
            await syncTabToSheet(liveToken, spreadsheetId, 'USERS', nextDb);
          }
          await syncTabToSheet(liveToken, spreadsheetId, 'HOME', nextDb);
        }

        showToast(
          liveToken
            ? `Verified & emailed ${emailType} to ${studentEmail}.`
            : `Verified ${targetFee.id}. Connect Gmail to dispatch email to ${studentEmail}.`
        );
      },
    });
  };

  const handleVerifyAndEmailFee = (feeId: string) => {
    const targetFee = db.fees.find((f) => f.id === feeId);
    if (!targetFee) return;
    triggerVerificationAndEmail(targetFee, db.fees);
  };

  const handleRecordPayment = (
    feeId: string,
    updates: {
      discount: number;
      amountPaid: number;
      paymentDate: string;
      paymentMethod: PaymentMethod;
      verifyAndEmail?: boolean;
    }
  ) => {
    const { verifyAndEmail, ...feeUpdates } = updates;
    const nextFees = db.fees.map((f) =>
      f.id === feeId
        ? {
            ...f,
            ...feeUpdates,
            verified: false,
          }
        : f
    );
    const nextDb: AcademyDatabase = {
      ...db,
      fees: nextFees,
    };
    setDb(nextDb);

    if (verifyAndEmail && canVerifyPayments(userRole)) {
      const updatedFee = nextFees.find((f) => f.id === feeId);
      if (updatedFee) {
        triggerVerificationAndEmail(updatedFee, nextFees);
        return;
      }
    }

    queueSheetSync('FEES', nextDb, `Update payment for invoice ${feeId} in Google Sheets?`);
  };

  const handleDeleteFee = (id: string) => {
    const nextDb: AcademyDatabase = {
      ...db,
      fees: db.fees.filter((f) => f.id !== id),
    };
    const token = getAccessToken();
    setPendingConfirmation({
      title: `Delete Fee Invoice ${id}?`,
      description: `Remove fee record ${id} from the ledger?`,
      affectedTab: 'FEES',
      confirmLabel: 'Delete Invoice',
      isDestructive: true,
      onConfirm: async () => {
        setDb(nextDb);
        if (token && spreadsheetId) {
          await syncTabToSheet(token, spreadsheetId, 'FEES', nextDb);
        }
      },
    });
  };

  const handleSaveBatchAttendance = (
    batchId: string,
    date: string,
    entries: AttendanceRecord[]
  ) => {
    if (userRole === 'Trainer') {
      const targetBatch = db.batches.find((b) => b.id === batchId);
      if (!targetBatch || !isBatchAssignedToTrainer(targetBatch, currentUser)) {
        return;
      }
    }
    const remaining = db.attendance.filter(
      (a) => !(a.batchId === batchId && a.date === date)
    );
    const nextDb: AcademyDatabase = {
      ...db,
      attendance: [...remaining, ...entries],
    };
    setDb(nextDb);
    queueSheetSync(
      'ATTENDANCE',
      nextDb,
      `Sync ${entries.length} attendance entries (${batchId} on ${date}) to Google Sheets?`
    );
  };

  // HR Department & Payroll Mutations
  const handleSaveStaff = (staffData: Omit<StaffMember, 'id'> & { id?: string }) => {
    const isEdit = Boolean(staffData.id);
    const id = staffData.id || generateNextId('EMP', db.hrStaff.map((s) => s.id));
    const record: StaffMember = { ...staffData, id };
    const nextDb: AcademyDatabase = {
      ...db,
      hrStaff: isEdit
        ? db.hrStaff.map((s) => (s.id === id ? record : s))
        : [...db.hrStaff, record],
    };
    setDb(nextDb);
    showToast(isEdit ? `Updated staff ${record.name}.` : `Added ${record.name} (${id}) to HR Staff.`);
    queueSheetSync('HR_STAFF', nextDb, `${isEdit ? 'Update' : 'Add'} staff ${id} (${record.name}) in Google Sheets?`);
  };

  const handleDeleteStaff = (id: string) => {
    const target = db.hrStaff.find((s) => s.id === id);
    const nextDb: AcademyDatabase = {
      ...db,
      hrStaff: db.hrStaff.filter((s) => s.id !== id),
    };
    const token = getAccessToken();
    setPendingConfirmation({
      title: `Remove Staff ${id}?`,
      description: `Delete ${target?.name || id} from HR Staff Directory?`,
      affectedTab: 'HR_STAFF',
      confirmLabel: 'Delete Staff',
      isDestructive: true,
      onConfirm: async () => {
        setDb(nextDb);
        if (token && spreadsheetId) {
          await syncTabToSheet(token, spreadsheetId, 'HR_STAFF', nextDb);
          await syncTabToSheet(token, spreadsheetId, 'HOME', nextDb);
        }
      },
    });
  };

  const handleImportTeachersToHR = (): number => {
    const existingIds = db.hrStaff.map((s) => s.id);
    const newStaff: StaffMember[] = [];

    for (const t of db.teachers) {
      const alreadyLinked = db.hrStaff.some(
        (s) => s.linkedTeacherId === t.id || s.name.toLowerCase() === t.name.toLowerCase()
      );
      if (alreadyLinked) continue;
      const nextId = generateNextId('EMP', existingIds);
      existingIds.push(nextId);
      newStaff.push({
        id: nextId,
        name: t.name,
        fatherName: '',
        phone: t.phone,
        email: '',
        cnic: '',
        designation: `${t.subject} Trainer`,
        department: 'Academic / Faculty',
        employmentType: 'Full-Time',
        joiningDate: TODAY_ISO,
        baseSalary: t.monthlySalary,
        defaultAllowance: 0,
        bankAccount: '',
        linkedTeacherId: t.id,
        status: t.status === 'Active' ? 'Active' : 'Resigned',
        emergencyContact: '',
      });
    }

    if (newStaff.length === 0) return 0;

    const nextDb: AcademyDatabase = {
      ...db,
      hrStaff: [...db.hrStaff, ...newStaff],
    };
    setDb(nextDb);
    queueSheetSync(
      'HR_STAFF',
      nextDb,
      `Sync ${newStaff.length} imported faculty profile(s) to HR_STAFF in Google Sheets?`
    );
    return newStaff.length;
  };

  const handleGeneratePayroll = (params: {
    scope: 'all' | 'single';
    staffId: string;
    month: string;
    workingDays: number;
    remarks: string;
  }) => {
    const targets =
      params.scope === 'all'
        ? db.hrStaff.filter((s) => s.status === 'Active')
        : db.hrStaff.filter((s) => s.id === params.staffId);

    const existingIds = db.payroll.map((p) => p.id);
    const nextPayroll = [...db.payroll];
    let createdCount = 0;

    for (const s of targets) {
      const exists = nextPayroll.some(
        (p) => p.staffId === s.id && p.month.toLowerCase() === params.month.toLowerCase()
      );
      if (exists) continue;
      const nextId = generateNextId('PAY', existingIds);
      existingIds.push(nextId);
      const netSalary = Math.max(0, (s.baseSalary || 0) + (s.defaultAllowance || 0));
      nextPayroll.push({
        id: nextId,
        staffId: s.id,
        staffName: s.name,
        designation: s.designation,
        department: s.department,
        month: params.month,
        workingDays: params.workingDays,
        presentDays: params.workingDays,
        leaveDays: 0,
        baseSalary: s.baseSalary || 0,
        allowances: s.defaultAllowance || 0,
        bonuses: 0,
        overtimePay: 0,
        deductions: 0,
        advanceRecovery: 0,
        netSalary,
        status: 'Draft',
        paymentDate: '',
        paymentMethod: '',
        remarks: params.remarks,
      });
      createdCount += 1;
    }

    if (createdCount === 0) {
      showToast('Payroll slips already exist for the selected staff & month.');
      return;
    }

    const nextDb: AcademyDatabase = { ...db, payroll: nextPayroll };
    setDb(nextDb);
    showToast(`Generated ${createdCount} payroll slip(s) for ${params.month}.`);
    queueSheetSync(
      'PAYROLL',
      nextDb,
      `Sync ${createdCount} payroll entries for ${params.month} to Google Sheets?`
    );
  };

  const handleSavePayroll = (updated: PayrollRecord) => {
    const nextDb: AcademyDatabase = {
      ...db,
      payroll: db.payroll.map((p) => (p.id === updated.id ? updated : p)),
    };
    setDb(nextDb);
    showToast(`Updated payroll ${updated.id} (${updated.staffName}).`);
    queueSheetSync('PAYROLL', nextDb, `Update payroll ${updated.id} in Google Sheets?`);
  };

  const handlePayPayroll = (
    payrollId: string,
    payment: {
      paymentDate: string;
      paymentMethod: PaymentMethod;
      logExpense: boolean;
    }
  ) => {
    const target = db.payroll.find((p) => p.id === payrollId);
    if (!target) return;

    const nextPayroll = db.payroll.map((p) =>
      p.id === payrollId
        ? {
            ...p,
            status: 'Paid' as const,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
          }
        : p
    );

    let nextExpenses = db.expenses;
    if (payment.logExpense) {
      const expId = generateNextId('E', db.expenses.map((e) => e.id));
      nextExpenses = [
        {
          id: expId,
          date: payment.paymentDate,
          category: 'Salary',
          description: `Payroll ${target.id} — ${target.staffName} (${target.month})`,
          amount: target.netSalary,
          paidBy: currentUser?.name || 'Admin',
        },
        ...db.expenses,
      ];
    }

    const nextDb: AcademyDatabase = {
      ...db,
      payroll: nextPayroll,
      expenses: nextExpenses,
    };
    setDb(nextDb);
    showToast(
      `Paid ${target.staffName} (${target.month})${payment.logExpense ? ' & logged Salary expense.' : '.'}`
    );

    const token = getAccessToken();
    if (token && spreadsheetId) {
      setPendingConfirmation({
        title: payment.logExpense
          ? 'Sync PAYROLL & EXPENSES to Google Sheets?'
          : 'Sync PAYROLL to Google Sheets?',
        description: `Mark payroll ${target.id} (${target.staffName}) as Paid${
          payment.logExpense ? ' and log Salary expense' : ''
        } in Google Sheets?`,
        affectedTab: 'PAYROLL',
        confirmLabel: 'Confirm & Sync Sheet',
        onConfirm: async () => {
          await syncTabToSheet(token, spreadsheetId, 'PAYROLL', nextDb);
          if (payment.logExpense) {
            await syncTabToSheet(token, spreadsheetId, 'EXPENSES', nextDb);
          }
          await syncTabToSheet(token, spreadsheetId, 'HOME', nextDb);
        },
      });
    }
  };

  const handleDeletePayroll = (id: string) => {
    const target = db.payroll.find((p) => p.id === id);
    const nextDb: AcademyDatabase = {
      ...db,
      payroll: db.payroll.filter((p) => p.id !== id),
    };
    const token = getAccessToken();
    setPendingConfirmation({
      title: `Delete Payroll Entry ${id}?`,
      description: `Remove salary record ${id} for ${target?.staffName || id}?`,
      affectedTab: 'PAYROLL',
      confirmLabel: 'Delete Payroll',
      isDestructive: true,
      onConfirm: async () => {
        setDb(nextDb);
        if (token && spreadsheetId) {
          await syncTabToSheet(token, spreadsheetId, 'PAYROLL', nextDb);
          await syncTabToSheet(token, spreadsheetId, 'HOME', nextDb);
        }
      },
    });
  };

  const handleSaveExpense = (expData: Omit<Expense, 'id'> & { id?: string }) => {
    const isEdit = Boolean(expData.id);
    const id = expData.id || generateNextId('E', db.expenses.map((e) => e.id));
    const record: Expense = { ...expData, id };
    const nextDb: AcademyDatabase = {
      ...db,
      expenses: isEdit
        ? db.expenses.map((e) => (e.id === id ? record : e))
        : [record, ...db.expenses],
    };
    setDb(nextDb);
    queueSheetSync('EXPENSES', nextDb, `${isEdit ? 'Update' : 'Add'} expense ${id} in Google Sheets?`);
  };

  const handleDeleteExpense = (id: string) => {
    const nextDb: AcademyDatabase = {
      ...db,
      expenses: db.expenses.filter((e) => e.id !== id),
    };
    const token = getAccessToken();
    setPendingConfirmation({
      title: `Delete Expense ${id}?`,
      description: `Remove expense ${id} from financial records?`,
      affectedTab: 'EXPENSES',
      confirmLabel: 'Delete Expense',
      isDestructive: true,
      onConfirm: async () => {
        setDb(nextDb);
        if (token && spreadsheetId) {
          await syncTabToSheet(token, spreadsheetId, 'EXPENSES', nextDb);
        }
      },
    });
  };

  const handleLogWhatsApp = (entry: {
    studentId: string;
    studentName: string;
    phone: string;
    messageType: WhatsAppMessageType;
  }) => {
    const id = generateNextId('WA', db.whatsappLogs.map((w) => w.id));
    const nextDb: AcademyDatabase = {
      ...db,
      whatsappLogs: [
        ...db.whatsappLogs,
        {
          id,
          date: TODAY_ISO,
          studentId: entry.studentId,
          studentName: entry.studentName,
          phone: entry.phone,
          messageType: entry.messageType,
          status: 'Opened',
        },
      ],
    };
    setDb(nextDb);
  };

  const handleSaveSettings = (nextSettings: AcademySettings) => {
    const nextDb: AcademyDatabase = {
      ...db,
      settings: {
        ...nextSettings,
        rolePermissions: db.settings.rolePermissions || DEFAULT_ROLE_PERMISSIONS,
      },
    };
    setDb(nextDb);
    queueSheetSync('SETTINGS', nextDb, 'Save updated institute settings to Google Sheets?');
  };

  const handleImportDatabase = (imported: AcademyDatabase) => {
    const merged: AcademyDatabase = {
      ...INITIAL_ACADEMY_DATA,
      ...imported,
      settings: {
        ...INITIAL_ACADEMY_DATA.settings,
        ...(imported.settings || {}),
        rolePermissions: {
          ...DEFAULT_ROLE_PERMISSIONS,
          ...(imported.settings?.rolePermissions || {}),
        },
      },
      hrStaff: Array.isArray(imported.hrStaff) ? imported.hrStaff : [],
      payroll: Array.isArray(imported.payroll) ? imported.payroll : [],
      emailLogs: Array.isArray(imported.emailLogs) ? imported.emailLogs : [],
    };
    setPendingConfirmation({
      title: 'Restore Backup Data?',
      description: `Replace current local workspace data with backup (${merged.students.length} students, ${merged.fees.length} fees, ${merged.batches.length} batches)?`,
      affectedTab: 'ALL DATA',
      confirmLabel: 'Restore Backup',
      isDestructive: true,
      onConfirm: async () => {
        setDb(merged);
        showToast('Backup restored successfully.');
      },
    });
  };

  const handleResetFreshData = () => {
    const token = getAccessToken();
    const freshDb: AcademyDatabase = {
      ...INITIAL_ACADEMY_DATA,
      settings: db.settings,
      users: db.users.filter((u) => u.role === 'Admin'),
    };
    setPendingConfirmation({
      title: 'Reset to Fresh Institute Copy?',
      description:
        'This will clear all students, inquiries, batches, teachers, HR staff, payroll, fees, attendance, expenses, and logs while keeping your Institute Settings and Admin accounts.',
      affectedTab: 'ALL DATA',
      confirmLabel: 'Clear All Entries',
      isDestructive: true,
      onConfirm: async () => {
        setDb(freshDb);
        if (token && spreadsheetId) {
          await syncAllTabsToSheet(token, spreadsheetId, freshDb);
        }
        showToast('All operational entries cleared — fresh institute copy ready.');
      },
    });
  };

  const handleOpenWhatsAppForStudent = (studentId: string) => {
    if (!allowedSections.includes('whatsapp')) return;
    setWaPreselectedStudentId(studentId);
    setActiveSection('whatsapp');
  };

  // Kiosk Public Form Mode
  if (isKioskMode) {
    return (
      <KioskInquiryView
        settings={db.settings}
        batches={db.batches}
        onSubmitInquiry={async (data) => {
          await handleSaveInquiry(data);
        }}
        onExitKiosk={() => setIsKioskMode(false)}
      />
    );
  }

  // Login Gate
  if (!isAuthenticated) {
    return (
      <LoginScreen
        academyName={db.settings.academyName}
        users={db.users}
        onGoogleLogin={handleGoogleLogin}
        onEmailPasswordLogin={handleEmailPasswordLogin}
        onOpenKiosk={() => setIsKioskMode(true)}
      />
    );
  }

  const currentNavObj =
    visibleNavItems.find((n) => n.id === activeSection) || visibleNavItems[0];

  const activeUserDisplay = currentUser?.name || googleEmail || `${userRole} Session`;
  const activeUserEmail = currentUser?.email || googleEmail || '';
  const userInitials = activeUserDisplay
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'MT';

  return (
    <div className="flex min-h-screen bg-[#f4f6f9] text-slate-900">
      {/* Desktop Midnight Navy Sidebar */}
      <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-slate-800/80 bg-[#071526] text-slate-200 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <MTSLogo size="sm" className="border border-white/15 shadow-sm" />
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-semibold tracking-tight text-white">
              {db.settings.academyName}
            </div>
            <div className="text-[11px] text-sky-300/80">Academy OS</div>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {NAV_GROUPS.map((group) => {
            const groupItems = visibleNavItems.filter((item) => item.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={group}>
                <div className="mb-1.5 px-3 text-[11px] font-medium text-slate-400">
                  {group}
                </div>
                <div className="space-y-0.5">
                  {groupItems.map((item) => {
                    const Icon = item.icon;
                    const active = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-white/12 text-white ring-1 ring-white/10'
                            : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            active
                              ? 'text-sky-400'
                              : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3.5">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 font-mono text-xs font-semibold text-sky-300">
                {userInitials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-white">
                  {activeUserDisplay}
                </div>
                <div className="truncate text-[11px] text-sky-300/90">{userRole}</div>
              </div>
            </div>
            {activeUserEmail && (
              <div className="mt-2 truncate font-mono text-[11px] text-slate-400">
                {activeUserEmail}
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-50 flex w-64 flex-col bg-[#071526] text-slate-200 shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
              <div className="flex items-center gap-2.5">
                <MTSLogo size="xs" className="border border-white/15" />
                <span className="text-sm font-semibold text-white">
                  {db.settings.academyName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
              {NAV_GROUPS.map((group) => {
                const groupItems = visibleNavItems.filter((item) => item.group === group);
                if (groupItems.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="mb-1 px-3 text-[11px] font-medium text-slate-400">
                      {group}
                    </div>
                    <div className="space-y-0.5">
                      {groupItems.map((item) => {
                        const Icon = item.icon;
                        const active = activeSection === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveSection(item.id);
                              setMobileMenuOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium ${
                              active
                                ? 'bg-white/12 text-white'
                                : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                            }`}
                          >
                            <Icon
                              className={`h-4 w-4 shrink-0 ${
                                active ? 'text-sky-400' : 'text-slate-400'
                              }`}
                            />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>
            <div className="border-t border-white/10 p-4">
              <div className="mb-2 text-xs font-medium text-slate-300">
                {activeUserDisplay} · {userRole}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-medium text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 truncate text-sm text-slate-500">
              <span className="font-medium text-slate-600">{db.settings.academyName}</span>
              <span className="mx-2 text-slate-300">/</span>
              <span className="font-semibold text-slate-900">
                {userRole === 'Student' ? 'Student Portal' : currentNavObj.label}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {userRole === 'Admin' && (
              <button
                type="button"
                onClick={() => setActiveSection('settings')}
                className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:inline-flex whitespace-nowrap"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                {spreadsheetId ? 'Google Sheet Synced' : 'Connect Google Sheet'}
              </button>
            )}

            {allowedSections.includes('reports') && (
              <button
                type="button"
                onClick={() => setActiveSection('reports')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#071526] px-3.5 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#0e2644] whitespace-nowrap"
              >
                <BarChart3 className="h-3.5 w-3.5 text-sky-400" />
                Reports
              </button>
            )}
          </div>
        </header>

        {/* Sync Notification Toast */}
        {syncBanner && (
          <div className="no-print border-b border-emerald-200 bg-emerald-50 px-6 py-2 text-xs font-medium text-emerald-800">
            {syncBanner}
          </div>
        )}

        {/* Active View Viewport */}
        <main className="app-main-viewport mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6">
          {userRole !== 'Student' && activeSection !== 'dashboard' && (
            <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                  {currentNavObj.label}
                </h1>
                <p className="mt-0.5 text-xs text-slate-500">{currentNavObj.description}</p>
              </div>
              <div className="text-xs text-slate-500">
                <span>{currentNavObj.group}</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span className="font-medium text-slate-700">{userRole} Access</span>
              </div>
            </div>
          )}

          {userRole === 'Student' && currentUser ? (
            <StudentPortalView db={db} currentUser={currentUser} />
          ) : (
            <>
              {activeSection === 'dashboard' && (
                <DashboardHome
                  db={db}
                  userRole={userRole}
                  currentUser={currentUser}
                  allowedSections={allowedSections}
                  onNavigate={setActiveSection}
                />
              )}

              {activeSection === 'inquiries' && allowedSections.includes('inquiries') && (
                <InquiriesView
                  inquiries={db.inquiries}
                  batches={db.batches}
                  onSaveInquiry={handleSaveInquiry}
                  onDeleteInquiry={handleDeleteInquiry}
                  onConvertInquiry={handleConvertInquiry}
                  onOpenKiosk={() => setIsKioskMode(true)}
                />
              )}

              {activeSection === 'students' && allowedSections.includes('students') && (
                <StudentsView
                  db={db}
                  userRole={userRole}
                  currentUser={currentUser}
                  pendingConversion={pendingConversion}
                  onClearPendingConversion={() => setPendingConversion(null)}
                  onSaveStudent={handleSaveStudent}
                  onDeleteStudent={handleDeleteStudent}
                  onOpenWhatsAppForStudent={handleOpenWhatsAppForStudent}
                />
              )}

              {activeSection === 'batches' && allowedSections.includes('batches') && (
                <BatchesTeachersView
                  db={db}
                  userRole={userRole}
                  currentUser={currentUser}
                  onSaveBatch={handleSaveBatch}
                  onDeleteBatch={handleDeleteBatch}
                  onSaveTeacher={handleSaveTeacher}
                  onDeleteTeacher={handleDeleteTeacher}
                />
              )}

              {activeSection === 'fees' && allowedSections.includes('fees') && (
                <FeesView
                  db={db}
                  userRole={userRole}
                  googleEmail={googleEmail}
                  hasGmailToken={Boolean(getAccessToken())}
                  onConnectGmail={handleConnectGmailOnly}
                  onGenerateVouchers={handleGenerateVouchers}
                  onRecordPayment={handleRecordPayment}
                  onVerifyAndEmailFee={handleVerifyAndEmailFee}
                  onDeleteFee={handleDeleteFee}
                  onOpenWhatsAppForStudent={handleOpenWhatsAppForStudent}
                />
              )}

              {activeSection === 'attendance' && allowedSections.includes('attendance') && (
                <AttendanceView
                  db={db}
                  userRole={userRole}
                  currentUser={currentUser}
                  canSendWhatsApp={allowedSections.includes('whatsapp')}
                  onSaveBatchAttendance={handleSaveBatchAttendance}
                  onOpenWhatsAppForStudent={handleOpenWhatsAppForStudent}
                />
              )}

              {activeSection === 'hr' && allowedSections.includes('hr') && (
                <HRDepartmentView
                  db={db}
                  onSaveStaff={handleSaveStaff}
                  onDeleteStaff={handleDeleteStaff}
                  onImportTeachersToHR={handleImportTeachersToHR}
                  onGeneratePayroll={handleGeneratePayroll}
                  onSavePayroll={handleSavePayroll}
                  onPayPayroll={handlePayPayroll}
                  onDeletePayroll={handleDeletePayroll}
                />
              )}

              {activeSection === 'expenses' && allowedSections.includes('expenses') && (
                <ExpensesView
                  db={db}
                  onSaveExpense={handleSaveExpense}
                  onDeleteExpense={handleDeleteExpense}
                />
              )}

              {activeSection === 'reports' && allowedSections.includes('reports') && (
                <ReportsCenter
                  db={db}
                  userRole={userRole}
                  currentUser={currentUser}
                  onLogWhatsApp={handleLogWhatsApp}
                />
              )}

              {activeSection === 'whatsapp' && allowedSections.includes('whatsapp') && (
                <WhatsAppView
                  db={db}
                  preselectedStudentId={waPreselectedStudentId}
                  onLogWhatsApp={handleLogWhatsApp}
                />
              )}

              {activeSection === 'users' && userRole === 'Admin' && (
                <UsersRolesView
                  db={db}
                  currentUserEmail={currentUser?.email || googleEmail}
                  onSaveUser={handleSaveUser}
                  onDeleteUser={handleDeleteUser}
                  onUpdateRolePermissions={handleUpdateRolePermissions}
                />
              )}

              {activeSection === 'settings' && userRole === 'Admin' && (
                <SettingsView
                  db={db}
                  settings={db.settings}
                  onSaveSettings={handleSaveSettings}
                  googleUserEmail={googleEmail}
                  spreadsheetId={spreadsheetId}
                  spreadsheetTitle={spreadsheetTitle}
                  onSignInGoogle={handleGoogleLogin}
                  onCreateSpreadsheet={handleCreateSpreadsheet}
                  onConnectSpreadsheet={handleConnectSpreadsheet}
                  onPullFromSheet={handlePullFromSheet}
                  onPushAllToSheet={handlePushAllToSheet}
                  onImportDatabase={handleImportDatabase}
                  onResetFreshData={handleResetFreshData}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mandatory Confirmation Dialog for Mutations / Google Sheets Writes */}
      <ConfirmModal
        pending={pendingConfirmation}
        onClose={() => setPendingConfirmation(null)}
      />
    </div>
  );
}
