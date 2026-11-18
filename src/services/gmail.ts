import { FeeRecord, Student } from '../types/academy';
import { computeFeeBalance, formatCurrency } from '../utils/calculations';

const GMAIL_SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeMimeHeader(value: string): string {
  // Use UTF-8 Base64 MIME encoded-word if non-ASCII characters are present
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

export interface SendEmailPayload {
  to: string;
  replyTo?: string;
  senderName?: string;
  senderEmail?: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

export async function sendGmailMessage(
  accessToken: string,
  payload: SendEmailPayload
): Promise<{ id: string }> {
  const boundary = `mts_boundary_${Date.now().toString(36)}`;
  const safeSenderName = (payload.senderName || 'MTS Trainings').replace(/"/g, '');
  const headers: string[] = [
    `To: ${payload.to}`,
    ...(payload.senderEmail
      ? [`From: "${encodeMimeHeader(safeSenderName)}" <${payload.senderEmail}>`]
      : []),
    ...(payload.replyTo ? [`Reply-To: ${payload.replyTo}`] : []),
    `Subject: ${encodeMimeHeader(payload.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const mimeMessage = [
    headers.join('\r\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(payload.textBody))).replace(/(.{76})/g, '$1\r\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(payload.htmlBody))).replace(/(.{76})/g, '$1\r\n'),
    '',
    `--${boundary}--`,
  ].join('\r\n');

  const raw = toBase64Url(mimeMessage);
  const res = await fetch(GMAIL_SEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let msg = `Gmail API Error (${res.status})`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      if (errText) msg = errText;
    }
    throw new Error(msg);
  }

  return res.json();
}

export function buildAdmissionCredentialsEmail(params: {
  academyName: string;
  primaryEmail: string;
  academyPhone: string;
  currency: string;
  portalUrl: string;
  student: Student;
  fee: FeeRecord;
  loginEmail: string;
  generatedPassword: string;
  verifiedBy: string;
  verifiedAt: string;
}): { subject: string; textBody: string; htmlBody: string } {
  const {
    academyName,
    primaryEmail,
    academyPhone,
    currency,
    portalUrl,
    student,
    fee,
    loginEmail,
    generatedPassword,
    verifiedBy,
    verifiedAt,
  } = params;

  const balance = computeFeeBalance(fee);
  const paymentKind = balance > 0 ? 'Partial Admission Payment Verified' : 'Full Admission Payment Verified';
  const subject = `[${academyName}] Admission Confirmed & Student Portal Login (${student.id})`;

  const textBody = [
    `Assalam-o-Alaikum ${student.name},`,
    '',
    `Welcome to ${academyName}! Your admission payment has been verified by our Accounts Department.`,
    '',
    '--- STUDENT ADMISSION DETAILS ---',
    `Student ID: ${student.id}`,
    `Full Name: ${student.name}`,
    `CNIC No.: ${student.cnic || '—'}`,
    `Course & Batch: ${student.course} (${student.batchId})`,
    `Admission Date: ${student.admissionDate}`,
    '',
    '--- STUDENT PORTAL LOGIN CREDENTIALS ---',
    `Portal URL: ${portalUrl}`,
    `Login ID (Email): ${loginEmail}`,
    `Auto-Generated Password: ${generatedPassword}`,
    '(Please keep your password confidential and sign in via Email & Password on the login screen.)',
    '',
    '--- VERIFIED PAYMENT SUMMARY ---',
    `Voucher ID: ${fee.id}`,
    `Status: ${paymentKind}`,
    `Fee Package: ${formatCurrency(fee.feeAmount, currency)}`,
    `Discount: ${formatCurrency(fee.discount, currency)}`,
    `Amount Paid: ${formatCurrency(fee.amountPaid, currency)}`,
    `Remaining Balance: ${formatCurrency(balance, currency)}`,
    `Payment Method: ${fee.paymentMethod || 'Cash'}`,
    `Verified By: ${verifiedBy} (${verifiedAt})`,
    '',
    `For assistance, contact ${primaryEmail} or ${academyPhone}.`,
    `Regards,\n${academyName} Accounts & Admissions`,
  ].join('\n');

  const htmlBody = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;color:#0f172a;background:#ffffff;">
    <div style="background:#0f172a;color:#ffffff;padding:20px 24px;">
      <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#38bdf8;font-weight:700;">${academyName}</div>
      <h2 style="margin:6px 0 0;font-size:19px;">Admission Confirmed &amp; Student Portal Login</h2>
      <div style="margin-top:4px;font-size:12px;color:#cbd5e1;">Primary Contact: ${primaryEmail} · ${academyPhone}</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 14px;font-size:14px;">Assalam-o-Alaikum <strong>${student.name}</strong>,</p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:#334155;">
        Your admission to <strong>${student.course} (${student.batchId})</strong> has been confirmed after payment verification by the Accounts Department. Below are your Student Portal login credentials and verified fee receipt.
      </p>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:18px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#1d4ed8;margin-bottom:8px;">Student Portal Login Credentials</div>
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#475569;width:170px;">Student ID:</td><td style="padding:4px 0;font-family:monospace;font-weight:700;">${student.id}</td></tr>
          <tr><td style="padding:4px 0;color:#475569;">Login ID (Email):</td><td style="padding:4px 0;font-family:monospace;font-weight:700;">${loginEmail}</td></tr>
          <tr><td style="padding:4px 0;color:#475569;">Auto-Generated Password:</td><td style="padding:4px 0;font-family:monospace;font-weight:700;color:#0f172a;">${generatedPassword}</td></tr>
          <tr><td style="padding:4px 0;color:#475569;">Portal Link:</td><td style="padding:4px 0;"><a href="${portalUrl}" style="color:#1d4ed8;">${portalUrl}</a></td></tr>
        </table>
      </div>

      <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:18px;">
        <div style="background:#f8fafc;padding:10px 14px;font-size:12px;font-weight:700;text-transform:uppercase;color:#334155;border-bottom:1px solid #e2e8f0;">
          Verified Admission Fee Summary (${fee.id})
        </div>
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">Status</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#047857;">${paymentKind}</td></tr>
          <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">Fee Package</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-family:monospace;">${formatCurrency(fee.feeAmount, currency)}</td></tr>
          <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">Discount</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-family:monospace;">${formatCurrency(fee.discount, currency)}</td></tr>
          <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">Amount Paid</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-weight:700;color:#047857;">${formatCurrency(fee.amountPaid, currency)}</td></tr>
          <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">Remaining Balance</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-weight:700;color:${balance > 0 ? '#b45309' : '#047857'};">${formatCurrency(balance, currency)}</td></tr>
          <tr><td style="padding:8px 14px;color:#475569;">Verified By</td><td style="padding:8px 14px;font-size:12px;">${verifiedBy} · ${verifiedAt}</td></tr>
        </table>
      </div>

      <p style="margin:0;font-size:12px;color:#64748b;">
        This is an automated verification email from ${academyName} (${primaryEmail}).
      </p>
    </div>
  </div>`;

  return { subject, textBody, htmlBody };
}

export function buildPaymentReceiptEmail(params: {
  academyName: string;
  primaryEmail: string;
  academyPhone: string;
  currency: string;
  student: Student;
  fee: FeeRecord;
  verifiedBy: string;
  verifiedAt: string;
}): { subject: string; textBody: string; htmlBody: string; isPartial: boolean } {
  const {
    academyName,
    primaryEmail,
    academyPhone,
    currency,
    student,
    fee,
    verifiedBy,
    verifiedAt,
  } = params;

  const balance = computeFeeBalance(fee);
  const isPartial = balance > 0;
  const label = isPartial ? 'Partial Fee Payment Verified' : 'Full Fee Payment Verified';
  const subject = `[${academyName}] ${label} — ${fee.month} (${fee.id})`;

  const textBody = [
    `Assalam-o-Alaikum ${student.name},`,
    '',
    `Your fee payment has been verified by the Accounts Department at ${academyName}.`,
    '',
    '--- PAYMENT VERIFICATION RECEIPT ---',
    `Receipt / Voucher ID: ${fee.id}`,
    `Student ID & Name: ${student.id} — ${student.name}`,
    `Course & Batch: ${student.course} (${fee.batchId})`,
    `Billing Month: ${fee.month}`,
    `Verification Type: ${label}`,
    `Billed Tuition Fee: ${formatCurrency(fee.feeAmount, currency)}`,
    `Discount Granted: ${formatCurrency(fee.discount, currency)}`,
    `Total Amount Paid: ${formatCurrency(fee.amountPaid, currency)}`,
    `Remaining Balance: ${formatCurrency(balance, currency)}`,
    `Payment Date & Method: ${fee.paymentDate || verifiedAt} · ${fee.paymentMethod || 'Cash'}`,
    `Verified By: ${verifiedBy} (${verifiedAt})`,
    '',
    `For queries, reply to ${primaryEmail} or call ${academyPhone}.`,
    `Regards,\n${academyName} Accounts Department`,
  ].join('\n');

  const htmlBody = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;color:#0f172a;background:#ffffff;">
    <div style="background:#0f172a;color:#ffffff;padding:20px 24px;">
      <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#38bdf8;font-weight:700;">${academyName}</div>
      <h2 style="margin:6px 0 0;font-size:19px;">${label}</h2>
      <div style="margin-top:4px;font-size:12px;color:#cbd5e1;">Primary Contact: ${primaryEmail} · ${academyPhone}</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 14px;font-size:14px;">Assalam-o-Alaikum <strong>${student.name}</strong> (${student.id}),</p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:#334155;">
        This is to confirm that your ${isPartial ? 'partial ' : ''}fee payment for <strong>${fee.month}</strong> has been verified by our Accounts Department.
      </p>

      <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:18px;">
        <div style="background:#f8fafc;padding:10px 14px;font-size:12px;font-weight:700;text-transform:uppercase;color:#334155;border-bottom:1px solid #e2e8f0;">
          Official Verified Fee Receipt (${fee.id})
        </div>
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;color:#475569;width:180px;">Student &amp; Batch</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-weight:600;">${student.name} (${student.id}) · ${fee.batchId}</td></tr>
          <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">Billing Month</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-family:monospace;">${fee.month}</td></tr>
          <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">Billed Fee</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-family:monospace;">${formatCurrency(fee.feeAmount, currency)}</td></tr>
          <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">Discount</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-family:monospace;">${formatCurrency(fee.discount, currency)}</td></tr>
          <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">Amount Paid</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-weight:700;color:#047857;">${formatCurrency(fee.amountPaid, currency)}</td></tr>
          <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">Remaining Balance</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-weight:700;color:${balance > 0 ? '#b45309' : '#047857'};">${formatCurrency(balance, currency)}</td></tr>
          <tr><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;color:#475569;">Payment Date &amp; Method</td><td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">${fee.paymentDate || verifiedAt} · ${fee.paymentMethod || 'Cash'}</td></tr>
          <tr><td style="padding:8px 14px;color:#475569;">Verified By</td><td style="padding:8px 14px;font-size:12px;">${verifiedBy} · ${verifiedAt}</td></tr>
        </table>
      </div>

      <p style="margin:0;font-size:12px;color:#64748b;">
        Automated accounts receipt from ${academyName} (${primaryEmail}).
      </p>
    </div>
  </div>`;

  return { subject, textBody, htmlBody, isPartial };
}
