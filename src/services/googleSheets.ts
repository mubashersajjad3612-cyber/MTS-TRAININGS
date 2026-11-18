import {
  AcademyDatabase,
  AcademySettings,
  AttendanceRecord,
  Batch,
  EmploymentType,
  Expense,
  FeeRecord,
  Inquiry,
  PayrollRecord,
  PayrollStatus,
  StaffDepartment,
  StaffMember,
  StaffStatus,
  Student,
  Teacher,
  UserAccount,
  UserRole,
  WhatsAppLog,
} from '../types/academy';
import {
  computeBatchMetrics,
  computeFeeBalance,
  computeFeeStatus,
  computeStudentAttendancePct,
  computeStudentOutstanding,
} from '../utils/calculations';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export const REQUIRED_SHEET_TABS = [
  'HOME',
  'SETTINGS',
  'USERS',
  'INQUIRIES',
  'STUDENTS',
  'BATCHES',
  'TEACHERS',
  'HR_STAFF',
  'PAYROLL',
  'FEES',
  'ATTENDANCE',
  'EXPENSES',
  'WHATSAPP_LOGS',
] as const;

export type SheetTabName = (typeof REQUIRED_SHEET_TABS)[number];

export function parseSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];
  return trimmed;
}

async function sheetsFetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const errBody = await res.text();
    let msg = `Google Sheets API error (${res.status})`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      // keep generic
    }
    throw new Error(msg);
  }
  return res.json();
}

function serializeTabRows(tab: SheetTabName, db: AcademyDatabase): (string | number)[][] {
  switch (tab) {
    case 'HOME': {
      const totalStudents = db.students.length;
      const activeStudents = db.students.filter((s) => s.status === 'Active').length;
      const leftStudents = db.students.filter((s) => s.status === 'Left').length;
      const totalBilled = db.fees.reduce((s, f) => s + Math.max(0, f.feeAmount - f.discount), 0);
      const totalCollected = db.fees.reduce((s, f) => s + f.amountPaid, 0);
      const outstanding = db.fees.reduce((s, f) => s + computeFeeBalance(f), 0);
      const totalExpenses = db.expenses.reduce((s, e) => s + e.amount, 0);
      return [
        ['ACADEMY OS — MANAGEMENT DASHBOARD', db.settings.academyName],
        ['Last Synced', new Date().toISOString()],
        [],
        ['METRIC', 'VALUE'],
        ['Total Students', totalStudents],
        ['Active Students', activeStudents],
        ['Left Students', leftStudents],
        ['Total Fee Billed', totalBilled],
        ['Total Collected', totalCollected],
        ['Outstanding Fees', outstanding],
        ['Total Expenses', totalExpenses],
        ['Net (All Time)', totalCollected - totalExpenses],
        ['Active Batches', db.batches.length],
        ['Total Teachers', db.teachers.length],
        ['Active HR Staff', db.hrStaff.filter((s) => s.status === 'Active').length],
        ['Payroll Disbursed (Paid)', db.payroll.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.netSalary, 0)],
        ['Total Inquiries', db.inquiries.length],
      ];
    }
    case 'SETTINGS':
      return [
        ['Key', 'Value'],
        ['Academy Name', db.settings.academyName],
        ['Phone', db.settings.phone],
        ['WhatsApp', db.settings.whatsapp],
        ['Email', db.settings.email],
        ['Address', db.settings.address],
        ['Currency', db.settings.currency],
        ['Default Due Day', db.settings.defaultDueDay],
        ['Low Attendance Alert %', db.settings.lowAttendanceAlertPct],
        ['Admin PIN', db.settings.adminPin],
        ['Staff PIN', db.settings.staffPin],
      ];
    case 'USERS':
      return [
        [
          'User ID',
          'Name',
          'Gmail',
          'Password',
          'Role',
          'Linked Student ID',
          'Linked Teacher',
          'Status',
          'Created At',
        ],
        ...db.users.map((u) => [
          u.id,
          u.name,
          u.email,
          u.password,
          u.role,
          u.linkedStudentId || '',
          u.linkedTeacherName || '',
          u.status,
          u.createdAt,
        ]),
      ];
    case 'INQUIRIES':
      return [
        [
          'Inquiry ID',
          'Date',
          'Full Name',
          'Father Name',
          'Gender',
          'Phone',
          'Email',
          'Interested Course',
          'Preferred Timing',
          'Source',
          'Follow-up Date',
          'Status',
          'Remarks',
        ],
        ...db.inquiries.map((i) => [
          i.id,
          i.date,
          i.fullName,
          i.fatherName,
          i.gender,
          i.phone,
          i.email,
          i.interestedCourse,
          i.preferredTiming,
          i.source,
          i.followUpDate,
          i.status,
          i.remarks,
        ]),
      ];
    case 'STUDENTS':
      return [
        [
          'Student ID',
          'Name',
          'Father Name',
          'Gender',
          'Student Phone',
          'Parent Phone',
          'Course',
          'Batch ID',
          'Teacher',
          'Monthly Fee',
          'Status',
          'Admission Date',
          'Left Date',
          'Left Reason',
          'Attendance %',
          'Total Outstanding Balance',
          'CNIC No.',
          'Photo URL',
          'Email',
        ],
        ...db.students.map((s) => {
          const att = computeStudentAttendancePct(s.id, db.attendance);
          const out = computeStudentOutstanding(s.id, db.fees);
          const safePhoto = s.photoUrl && s.photoUrl.length <= 45000 ? s.photoUrl : '';
          return [
            s.id,
            s.name,
            s.fatherName,
            s.gender,
            s.studentPhone,
            s.parentPhone,
            s.course,
            s.batchId,
            s.teacher,
            s.monthlyFee,
            s.status,
            s.admissionDate,
            s.leftDate,
            s.leftReason,
            att === null ? '' : `${att}%`,
            out,
            s.cnic || '',
            safePhoto,
            s.email || '',
          ];
        }),
      ];
    case 'BATCHES':
      return [
        [
          'Batch ID',
          'Batch Name',
          'Course',
          'Assigned Teacher',
          'Days',
          'Time',
          'Max Capacity',
          'Enrolled Students Count',
          'Seats Left',
          'Occupancy %',
          'Default Fee',
        ],
        ...db.batches.map((b) => {
          const m = computeBatchMetrics(b, db);
          return [
            b.id,
            b.batchName,
            b.course,
            b.assignedTeacher,
            b.days,
            b.time,
            b.maxCapacity,
            m.activeCount,
            m.seatsLeft,
            `${m.occupancyPct}%`,
            b.defaultFee,
          ];
        }),
      ];
    case 'TEACHERS':
      return [
        ['Teacher ID', 'Name', 'Phone', 'Subject', 'Monthly Salary', 'Status'],
        ...db.teachers.map((t) => [t.id, t.name, t.phone, t.subject, t.monthlySalary, t.status]),
      ];
    case 'HR_STAFF':
      return [
        [
          'Staff ID',
          'Full Name',
          'Father Name',
          'Phone',
          'Email',
          'CNIC',
          'Designation',
          'Department',
          'Employment Type',
          'Joining Date',
          'Base Salary',
          'Default Allowance',
          'Bank / Payment Account',
          'Linked Teacher ID',
          'Status',
          'Emergency Contact',
        ],
        ...db.hrStaff.map((s) => [
          s.id,
          s.name,
          s.fatherName,
          s.phone,
          s.email,
          s.cnic,
          s.designation,
          s.department,
          s.employmentType,
          s.joiningDate,
          s.baseSalary,
          s.defaultAllowance,
          s.bankAccount,
          s.linkedTeacherId || '',
          s.status,
          s.emergencyContact,
        ]),
      ];
    case 'PAYROLL':
      return [
        [
          'Payroll ID',
          'Staff ID',
          'Staff Name',
          'Designation',
          'Department',
          'Month',
          'Working Days',
          'Present Days',
          'Leave Days',
          'Base Salary',
          'Allowances',
          'Bonuses',
          'Overtime Pay',
          'Deductions',
          'Advance Recovery',
          'Net Salary',
          'Status',
          'Payment Date',
          'Payment Method',
          'Remarks',
        ],
        ...db.payroll.map((p) => [
          p.id,
          p.staffId,
          p.staffName,
          p.designation,
          p.department,
          p.month,
          p.workingDays,
          p.presentDays,
          p.leaveDays,
          p.baseSalary,
          p.allowances,
          p.bonuses,
          p.overtimePay,
          p.deductions,
          p.advanceRecovery,
          p.netSalary,
          p.status,
          p.paymentDate,
          p.paymentMethod,
          p.remarks,
        ]),
      ];
    case 'FEES':
      return [
        [
          'Fee ID',
          'Student ID',
          'Student Name',
          'Batch',
          'Month',
          'Fee Amount',
          'Discount',
          'Amount Paid',
          'Payment Date',
          'Payment Method',
          'Balance',
          'Status',
          'Due Date',
          'Is Admission Fee',
          'Accountant Verified',
          'Verified By',
          'Verified At',
          'Last Email Sent At',
        ],
        ...db.fees.map((f) => [
          f.id,
          f.studentId,
          f.studentName,
          f.batchId,
          f.month,
          f.feeAmount,
          f.discount,
          f.amountPaid,
          f.paymentDate,
          f.paymentMethod,
          computeFeeBalance(f),
          computeFeeStatus(f),
          f.dueDate,
          f.isAdmissionFee ? 'Yes' : 'No',
          f.verified ? 'Yes' : 'No',
          f.verifiedBy || '',
          f.verifiedAt || '',
          f.lastEmailSentAt || '',
        ]),
      ];
    case 'ATTENDANCE':
      return [
        ['Date', 'Student ID', 'Student Name', 'Batch', 'Status', 'Remarks'],
        ...db.attendance.map((a) => [a.date, a.studentId, a.studentName, a.batchId, a.status, a.remarks]),
      ];
    case 'EXPENSES':
      return [
        ['Expense ID', 'Date', 'Category', 'Description', 'Amount', 'Paid By'],
        ...db.expenses.map((e) => [e.id, e.date, e.category, e.description, e.amount, e.paidBy]),
      ];
    case 'WHATSAPP_LOGS':
      return [
        ['Log ID', 'Date', 'Student ID', 'Student Name', 'Phone', 'Message Type', 'Status'],
        ...db.whatsappLogs.map((w) => [
          w.id,
          w.date,
          w.studentId,
          w.studentName,
          w.phone,
          w.messageType,
          w.status,
        ]),
      ];
  }
}

export async function createAcademySpreadsheet(
  accessToken: string,
  db: AcademyDatabase
): Promise<{ spreadsheetId: string; title: string; url: string }> {
  const title = `${db.settings.academyName || 'MTS Trainings'} — Academy OS Database`;
  const created = await sheetsFetch(SHEETS_BASE, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: REQUIRED_SHEET_TABS.map((t) => ({ properties: { title: t } })),
    }),
  });

  const spreadsheetId = created.spreadsheetId as string;
  await syncAllTabsToSheet(accessToken, spreadsheetId, db);

  return {
    spreadsheetId,
    title,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

export async function inspectAndEnsureTabs(
  accessToken: string,
  spreadsheetId: string
): Promise<{ title: string; existingTabs: string[] }> {
  const meta = await sheetsFetch(
    `${SHEETS_BASE}/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
    accessToken
  );

  const title: string = meta.properties?.title || 'Connected Spreadsheet';
  const existingTabs: string[] = (meta.sheets || []).map(
    (s: { properties?: { title?: string } }) => s.properties?.title || ''
  );

  const missingTabs = REQUIRED_SHEET_TABS.filter((tab) => !existingTabs.includes(tab));

  if (missingTabs.length > 0) {
    await sheetsFetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        requests: missingTabs.map((t) => ({
          addSheet: { properties: { title: t } },
        })),
      }),
    });
  }

  return {
    title,
    existingTabs: [...existingTabs, ...missingTabs],
  };
}

export async function syncTabToSheet(
  accessToken: string,
  spreadsheetId: string,
  tabName: SheetTabName,
  db: AcademyDatabase
): Promise<void> {
  const values = serializeTabRows(tabName, db);
  const encodedTab = encodeURIComponent(`'${tabName}'!A:Z`);
  await sheetsFetch(`${SHEETS_BASE}/${spreadsheetId}/values/${encodedTab}:clear`, accessToken, {
    method: 'POST',
  });

  const targetRange = encodeURIComponent(`'${tabName}'!A1`);
  await sheetsFetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${targetRange}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({ values }),
    }
  );
}

export async function syncAllTabsToSheet(
  accessToken: string,
  spreadsheetId: string,
  db: AcademyDatabase
): Promise<void> {
  await inspectAndEnsureTabs(accessToken, spreadsheetId);

  // Batch clear all tabs
  await sheetsFetch(`${SHEETS_BASE}/${spreadsheetId}/values:batchClear`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      ranges: REQUIRED_SHEET_TABS.map((t) => `'${t}'!A:Z`),
    }),
  });

  // Batch update all tabs in one API call
  await sheetsFetch(`${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: REQUIRED_SHEET_TABS.map((tab) => ({
        range: `'${tab}'!A1`,
        values: serializeTabRows(tab, db),
      })),
    }),
  });
}

export async function pullAcademyDataFromSheet(
  accessToken: string,
  spreadsheetId: string,
  fallbackSettings: AcademySettings
): Promise<{ db: AcademyDatabase; title: string }> {
  const { title } = await inspectAndEnsureTabs(accessToken, spreadsheetId);

  const rangesQuery = REQUIRED_SHEET_TABS.filter((t) => t !== 'HOME')
    .map((t) => `ranges=${encodeURIComponent(`'${t}'!A:Z`)}`)
    .join('&');

  const res = await sheetsFetch(
    `${SHEETS_BASE}/${spreadsheetId}/values:batchGet?${rangesQuery}`,
    accessToken
  );

  const byTab: Record<string, string[][]> = {};
  for (const vr of res.valueRanges || []) {
    const rawRange: string = vr.range || '';
    const tabTitle = rawRange.split('!')[0].replace(/^'|'$/g, '');
    byTab[tabTitle] = vr.values || [];
  }

  const parseNum = (v: unknown, def = 0) => {
    const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : def;
  };

  // SETTINGS
  const settings = { ...fallbackSettings };
  for (const row of (byTab['SETTINGS'] || []).slice(1)) {
    const k = (row[0] || '').trim().toLowerCase();
    const val = (row[1] || '').trim();
    if (!k) continue;
    if (k.includes('academy name')) settings.academyName = val || settings.academyName;
    else if (k === 'phone') settings.phone = val;
    else if (k.includes('whatsapp')) settings.whatsapp = val;
    else if (k === 'email') settings.email = val;
    else if (k === 'address') settings.address = val;
    else if (k === 'currency') settings.currency = val || 'PKR';
    else if (k.includes('due day')) settings.defaultDueDay = parseNum(val, 10);
    else if (k.includes('low attendance')) {
      const pct = parseNum(val, 75);
      settings.lowAttendanceAlertPct = pct <= 1 ? Math.round(pct * 100) : pct;
    } else if (k.includes('admin pin')) settings.adminPin = val || settings.adminPin;
    else if (k.includes('staff pin')) settings.staffPin = val || settings.staffPin;
  }

  const teachers: Teacher[] = (byTab['TEACHERS'] || [])
    .slice(1)
    .filter((r) => r[0] || r[1])
    .map((r, idx) => ({
      id: r[0] || `T-${String(idx + 1).padStart(3, '0')}`,
      name: r[1] || '',
      phone: r[2] || '',
      subject: r[3] || '',
      monthlySalary: parseNum(r[4], 0),
      status: (r[5] === 'Inactive' ? 'Inactive' : 'Active') as Teacher['status'],
    }));

  const batches: Batch[] = (byTab['BATCHES'] || [])
    .slice(1)
    .filter((r) => r[0] || r[1])
    .map((r, idx) => ({
      id: r[0] || `B-${String(idx + 1).padStart(2, '0')}`,
      batchName: r[1] || '',
      course: r[2] || '',
      assignedTeacher: r[3] || '',
      days: r[4] || '',
      time: r[5] || '',
      maxCapacity: parseNum(r[6], 20),
      defaultFee: parseNum(r[10], 8000),
    }));

  const students: Student[] = (byTab['STUDENTS'] || [])
    .slice(1)
    .filter((r) => r[0] || r[1])
    .map((r, idx) => ({
      id: r[0] || `S-${String(idx + 1).padStart(3, '0')}`,
      name: r[1] || '',
      fatherName: r[2] || '',
      gender: (r[3] === 'Female' ? 'Female' : r[3] === 'Other' ? 'Other' : 'Male') as Student['gender'],
      studentPhone: r[4] || '',
      parentPhone: r[5] || '',
      course: r[6] || '',
      batchId: r[7] || '',
      teacher: r[8] || '',
      monthlyFee: parseNum(r[9], 0),
      status: (r[10] === 'Left' ? 'Left' : r[10] === 'Completed' ? 'Completed' : 'Active') as Student['status'],
      admissionDate: (r[11] || '').slice(0, 10),
      leftDate: (r[12] || '').slice(0, 10),
      leftReason: r[13] || '',
      cnic: r[16] || '',
      photoUrl: r[17] || '',
      email: r[18] || '',
    }));

  const inquiries: Inquiry[] = (byTab['INQUIRIES'] || [])
    .slice(1)
    .filter((r) => r[0] || r[2])
    .map((r, idx) => ({
      id: r[0] || `INQ-${String(idx + 1).padStart(3, '0')}`,
      date: (r[1] || '').slice(0, 10),
      fullName: r[2] || '',
      fatherName: r[3] || '',
      gender: (r[4] === 'Female' ? 'Female' : r[4] === 'Other' ? 'Other' : 'Male') as Inquiry['gender'],
      phone: r[5] || '',
      email: r[6] || '',
      interestedCourse: r[7] || '',
      preferredTiming: r[8] || '',
      source: (['Walk-in', 'Social Media', 'Referral', 'Call'].includes(r[9]) ? r[9] : 'Walk-in') as Inquiry['source'],
      followUpDate: (r[10] || '').slice(0, 10),
      status: (['New', 'Contacted', 'Demo Scheduled', 'Converted', 'Closed'].includes(r[11])
        ? r[11]
        : 'New') as Inquiry['status'],
      remarks: r[12] || '',
    }));

  const fees: FeeRecord[] = (byTab['FEES'] || [])
    .slice(1)
    .filter((r) => r[0] || r[1])
    .map((r, idx) => ({
      id: r[0] || `F-${String(idx + 1).padStart(3, '0')}`,
      studentId: r[1] || '',
      studentName: r[2] || '',
      batchId: r[3] || '',
      month: r[4] || '',
      feeAmount: parseNum(r[5], 0),
      discount: parseNum(r[6], 0),
      amountPaid: parseNum(r[7], 0),
      paymentDate: (r[8] || '').slice(0, 10),
      paymentMethod: (['Cash', 'Bank Transfer', 'JazzCash', 'EasyPaisa'].includes(r[9])
        ? r[9]
        : '') as FeeRecord['paymentMethod'],
      dueDate: (r[12] || '').slice(0, 10),
      isAdmissionFee: r[13] === 'Yes',
      verified: r[14] === 'Yes',
      verifiedBy: r[15] || '',
      verifiedAt: r[16] || '',
      lastEmailSentAt: r[17] || '',
    }));

  const attendance: AttendanceRecord[] = (byTab['ATTENDANCE'] || [])
    .slice(1)
    .filter((r) => r[0] && r[1])
    .map((r) => ({
      date: (r[0] || '').slice(0, 10),
      studentId: r[1] || '',
      studentName: r[2] || '',
      batchId: r[3] || '',
      status: (r[4] === 'Absent' ? 'Absent' : r[4] === 'Late' ? 'Late' : 'Present') as AttendanceRecord['status'],
      remarks: r[5] || '',
    }));

  const expenses: Expense[] = (byTab['EXPENSES'] || [])
    .slice(1)
    .filter((r) => r[0] || r[3])
    .map((r, idx) => ({
      id: r[0] || `E-${String(idx + 1).padStart(3, '0')}`,
      date: (r[1] || '').slice(0, 10),
      category: (['Rent', 'Salary', 'Electricity', 'Internet', 'Marketing', 'Equipment', 'Misc'].includes(r[2])
        ? r[2]
        : 'Misc') as Expense['category'],
      description: r[3] || '',
      amount: parseNum(r[4], 0),
      paidBy: r[5] || 'Admin',
    }));

  const whatsappLogs: WhatsAppLog[] = (byTab['WHATSAPP_LOGS'] || [])
    .slice(1)
    .filter((r) => r[0] || r[2])
    .map((r, idx) => ({
      id: r[0] || `WA-${String(idx + 1).padStart(3, '0')}`,
      date: (r[1] || '').slice(0, 10),
      studentId: r[2] || '',
      studentName: r[3] || '',
      phone: r[4] || '',
      messageType: (['Fee Reminder', 'Overdue Fee', 'Payment Received', 'Low Attendance Alert'].includes(r[5])
        ? r[5]
        : 'Fee Reminder') as WhatsAppLog['messageType'],
      status: (r[6] === 'Opened' ? 'Opened' : 'Sent') as WhatsAppLog['status'],
    }));

  const validRoles: UserRole[] = [
    'Admin',
    'Manager',
    'Admission Officer',
    'Coordinator',
    'Accountant',
    'Trainer',
    'Student',
  ];

  const users: UserAccount[] = (byTab['USERS'] || [])
    .slice(1)
    .filter((r) => r[0] || r[2])
    .map((r, idx) => ({
      id: r[0] || `U-${String(idx + 1).padStart(3, '0')}`,
      name: r[1] || '',
      email: (r[2] || '').trim().toLowerCase(),
      password: r[3] || '',
      role: (validRoles.includes(r[4] as UserRole) ? r[4] : 'Student') as UserRole,
      linkedStudentId: r[5] || undefined,
      linkedTeacherName: r[6] || undefined,
      status: (r[7] === 'Disabled' ? 'Disabled' : 'Active') as UserAccount['status'],
      createdAt: (r[8] || '').slice(0, 10),
    }));

  const validDepartments: StaffDepartment[] = [
    'Academic / Faculty',
    'Admissions',
    'Administration',
    'Finance',
    'Support & Operations',
  ];
  const validEmpTypes: EmploymentType[] = ['Full-Time', 'Part-Time', 'Contract', 'Visiting'];
  const validStaffStatus: StaffStatus[] = ['Active', 'On Leave', 'Resigned'];
  const validPayrollStatus: PayrollStatus[] = ['Draft', 'Approved', 'Paid'];

  const hrStaff: StaffMember[] = (byTab['HR_STAFF'] || [])
    .slice(1)
    .filter((r) => r[0] || r[1])
    .map((r, idx) => ({
      id: r[0] || `EMP-${String(idx + 1).padStart(3, '0')}`,
      name: r[1] || '',
      fatherName: r[2] || '',
      phone: r[3] || '',
      email: r[4] || '',
      cnic: r[5] || '',
      designation: r[6] || '',
      department: (validDepartments.includes(r[7] as StaffDepartment)
        ? r[7]
        : 'Administration') as StaffDepartment,
      employmentType: (validEmpTypes.includes(r[8] as EmploymentType)
        ? r[8]
        : 'Full-Time') as EmploymentType,
      joiningDate: (r[9] || '').slice(0, 10),
      baseSalary: parseNum(r[10], 0),
      defaultAllowance: parseNum(r[11], 0),
      bankAccount: r[12] || '',
      linkedTeacherId: r[13] || undefined,
      status: (validStaffStatus.includes(r[14] as StaffStatus) ? r[14] : 'Active') as StaffStatus,
      emergencyContact: r[15] || '',
    }));

  const payroll: PayrollRecord[] = (byTab['PAYROLL'] || [])
    .slice(1)
    .filter((r) => r[0] || r[1])
    .map((r, idx) => ({
      id: r[0] || `PAY-${String(idx + 1).padStart(3, '0')}`,
      staffId: r[1] || '',
      staffName: r[2] || '',
      designation: r[3] || '',
      department: r[4] || '',
      month: r[5] || '',
      workingDays: parseNum(r[6], 26),
      presentDays: parseNum(r[7], 26),
      leaveDays: parseNum(r[8], 0),
      baseSalary: parseNum(r[9], 0),
      allowances: parseNum(r[10], 0),
      bonuses: parseNum(r[11], 0),
      overtimePay: parseNum(r[12], 0),
      deductions: parseNum(r[13], 0),
      advanceRecovery: parseNum(r[14], 0),
      netSalary: parseNum(r[15], 0),
      status: (validPayrollStatus.includes(r[16] as PayrollStatus)
        ? r[16]
        : 'Draft') as PayrollStatus,
      paymentDate: (r[17] || '').slice(0, 10),
      paymentMethod: (['Cash', 'Bank Transfer', 'JazzCash', 'EasyPaisa'].includes(r[18])
        ? r[18]
        : '') as PayrollRecord['paymentMethod'],
      remarks: r[19] || '',
    }));

  return {
    title,
    db: {
      settings,
      users,
      inquiries,
      students,
      batches,
      teachers,
      hrStaff,
      payroll,
      fees,
      attendance,
      expenses,
      whatsappLogs,
    },
  };
}

export function generateAppsScriptCode(): string {
  return `// MTS Trainings — Academy OS Google Apps Script Web App Backend (Code.gs)
// Paste into Extensions > Apps Script inside your Google Sheet and Deploy as Web App.

const TABS = [
  'HOME', 'SETTINGS', 'USERS', 'INQUIRIES', 'STUDENTS', 'BATCHES',
  'TEACHERS', 'HR_STAFF', 'PAYROLL', 'FEES', 'ATTENDANCE', 'EXPENSES', 'WHATSAPP_LOGS'
];

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const payload = {};
  TABS.forEach(name => {
    const sheet = ss.getSheetByName(name);
    payload[name] = sheet ? sheet.getDataRange().getValues() : [];
  });
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: payload }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const body = JSON.parse(e.postData.contents);
  const sheet = ss.getSheetByName(body.tab) || ss.insertSheet(body.tab);
  if (body.action === 'replace' && Array.isArray(body.rows)) {
    sheet.clearContents();
    if (body.rows.length > 0) {
      sheet.getRange(1, 1, body.rows.length, body.rows[0].length).setValues(body.rows);
    }
  } else if (body.action === 'append' && Array.isArray(body.row)) {
    sheet.appendRow(body.row);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
}
