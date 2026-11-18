import React, { useRef, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  RefreshCw,
  RotateCcw,
  Save,
  Upload,
  UploadCloud,
} from 'lucide-react';
import { AcademyDatabase, AcademySettings } from '../types/academy';
import { generateAppsScriptCode, parseSpreadsheetId } from '../services/googleSheets';
import { TODAY_ISO } from '../utils/calculations';

interface SettingsViewProps {
  db: AcademyDatabase;
  settings: AcademySettings;
  onSaveSettings: (next: AcademySettings) => void;
  googleUserEmail: string | null;
  spreadsheetId: string | null;
  spreadsheetTitle: string | null;
  onSignInGoogle: () => Promise<void>;
  onCreateSpreadsheet: () => Promise<void>;
  onConnectSpreadsheet: (id: string) => Promise<void>;
  onPullFromSheet: () => Promise<void>;
  onPushAllToSheet: () => void;
  onImportDatabase: (imported: AcademyDatabase) => void;
  onResetFreshData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  db,
  settings,
  onSaveSettings,
  googleUserEmail,
  spreadsheetId,
  spreadsheetTitle,
  onSignInGoogle,
  onCreateSpreadsheet,
  onConnectSpreadsheet,
  onPullFromSheet,
  onPushAllToSheet,
  onImportDatabase,
  onResetFreshData,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [backupNotice, setBackupNotice] = useState('');
  const [backupError, setBackupError] = useState('');
  const [form, setForm] = useState<AcademySettings>(settings);
  const [savedMsg, setSavedMsg] = useState('');
  const [sheetInput, setSheetInput] = useState(spreadsheetId || '');
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [sheetNotice, setSheetNotice] = useState('');
  const [showAppsScript, setShowAppsScript] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    setSavedMsg('Academy settings updated.');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const runSheetAction = async (fn: () => Promise<void>, successText: string) => {
    setSheetError('');
    setSheetNotice('');
    setSheetBusy(true);
    try {
      await fn();
      setSheetNotice(successText);
    } catch (err: unknown) {
      setSheetError(err instanceof Error ? err.message : 'Google Sheets request failed.');
    } finally {
      setSheetBusy(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generateAppsScriptCode());
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left: Academy Settings */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 lg:col-span-6">
        <h2 className="text-base font-semibold text-slate-900">Academy Settings</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Stored in the SETTINGS tab and applied across receipts, reminders, and alerts.
        </p>

        <form onSubmit={handleSettingsSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">Institute Name</label>
            <input
              type="text"
              required
              value={form.academyName}
              onChange={(e) => setForm({ ...form, academyName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">WhatsApp (92300...)</label>
              <input
                type="text"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Currency</label>
              <input
                type="text"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Default Fee Due Day</label>
              <input
                type="number"
                min={1}
                max={28}
                value={form.defaultDueDay}
                onChange={(e) => setForm({ ...form, defaultDueDay: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Low Attendance Alert %
              </label>
              <input
                type="number"
                min={10}
                max={100}
                value={form.lowAttendanceAlertPct}
                onChange={(e) =>
                  setForm({ ...form, lowAttendanceAlertPct: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Admin PIN</label>
              <input
                type="text"
                value={form.adminPin}
                onChange={(e) => setForm({ ...form, adminPin: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Primary Admin Gmail</label>
              <input
                type="email"
                value={form.primaryAdminEmail || ''}
                onChange={(e) => setForm({ ...form, primaryAdminEmail: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>

          {savedMsg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {savedMsg}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
            >
              <Save className="h-4 w-4" />
              Save Settings
            </button>
          </div>
        </form>
      </div>

      {/* Right: Live Google Sheets Sync */}
      <div className="space-y-6 lg:col-span-6">
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Live Google Sheets Backend
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Sync all 10 tabs (HOME, SETTINGS, INQUIRIES, STUDENTS, BATCHES, TEACHERS, FEES, ATTENDANCE, EXPENSES, WHATSAPP_LOGS).
              </p>
            </div>
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-700" />
          </div>

          {!googleUserEmail ? (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs leading-relaxed text-slate-600">
                Sign in with your Google account to create or connect a live Google Spreadsheet database.
              </p>
              <button
                type="button"
                onClick={() => runSheetAction(onSignInGoogle, 'Google account connected.')}
                disabled={sheetBusy}
                className="gsi-material-button mt-3"
              >
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg viewBox="0 0 48 48" style={{ display: 'block' }}>
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">Sign in with Google</span>
                </div>
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Connected Google Account</span>
                  <span className="font-medium text-slate-900">{googleUserEmail}</span>
                </div>
                {spreadsheetId && (
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
                    <span className="text-slate-500">Active Sheet</span>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
                    >
                      {spreadsheetTitle || spreadsheetId}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  disabled={sheetBusy}
                  onClick={() =>
                    runSheetAction(
                      onCreateSpreadsheet,
                      'Created new MTS Trainings Google Spreadsheet with all 10 tabs.'
                    )
                  }
                  className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {sheetBusy ? 'Working...' : 'Create New Academy Google Spreadsheet (1-Click)'}
                </button>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="block text-xs font-medium text-slate-700">
                  Or Connect Existing Google Sheet URL / ID
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={sheetInput}
                    onChange={(e) => setSheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  />
                  <button
                    type="button"
                    disabled={sheetBusy || !sheetInput.trim()}
                    onClick={() =>
                      runSheetAction(
                        () => onConnectSpreadsheet(parseSpreadsheetId(sheetInput)),
                        'Connected and loaded data from Google Spreadsheet.'
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Connect
                  </button>
                </div>
              </div>

              {spreadsheetId && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    disabled={sheetBusy}
                    onClick={() =>
                      runSheetAction(onPullFromSheet, 'Pulled latest rows from Google Sheets.')
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Pull from Sheet
                  </button>
                  <button
                    type="button"
                    disabled={sheetBusy}
                    onClick={onPushAllToSheet}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-xs font-medium text-white hover:bg-sky-800"
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    Push All Tabs
                  </button>
                </div>
              )}
            </div>
          )}

          {sheetError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {sheetError}
            </div>
          )}
          {sheetNotice && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {sheetNotice}
            </div>
          )}
        </div>

        {/* Apps Script Helper */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Google Apps Script (Code.gs) Export
              </h3>
              <p className="text-xs text-slate-500">
                Optional standalone Apps Script helper for Extensions &gt; Apps Script.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAppsScript(!showAppsScript)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Code2 className="h-3.5 w-3.5" />
              {showAppsScript ? 'Hide Code' : 'View Code.gs'}
            </button>
          </div>

          {showAppsScript && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedCode ? 'Copied' : 'Copy Code.gs'}
                </button>
              </div>
              <pre className="max-h-60 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
                {generateAppsScriptCode()}
              </pre>
            </div>
          )}
        </div>

        {/* Standalone Local Backup & Restore (No API Required) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Local Backup &amp; Restore (No API Required)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Export all students, fees, HR payroll, and settings to a JSON file, or restore a backup onto any browser/computer for free.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBackupError('');
                  const blob = new Blob([JSON.stringify(db, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `MTS-Trainings-Backup-${TODAY_ISO}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  setBackupNotice('Full JSON backup downloaded.');
                  setTimeout(() => setBackupNotice(''), 3000);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#071526] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#0e2644] whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 text-sky-400" />
                Export Backup (.json)
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Upload className="h-3.5 w-3.5" />
                Import Backup
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setBackupError('');
                  setBackupNotice('');
                  try {
                    const raw = await file.text();
                    const parsed = JSON.parse(raw) as AcademyDatabase;
                    if (!parsed || !parsed.settings || !Array.isArray(parsed.students)) {
                      throw new Error('Invalid MTS Academy backup file.');
                    }
                    onImportDatabase(parsed);
                    setBackupNotice('Backup restoration queued for confirmation.');
                  } catch (err) {
                    setBackupError(
                      err instanceof Error ? err.message : 'Failed to read backup file.'
                    );
                  }
                }}
              />
            </div>
          </div>
          {backupNotice && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {backupNotice}
            </div>
          )}
          {backupError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {backupError}
            </div>
          )}
        </div>

        {/* Fresh Copy / Clear Entries */}
        <div className="rounded-2xl border border-red-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Fresh Institute Copy (Clear All Entries)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Removes all students, inquiries, batches, teachers, fees, attendance, HR staff, payroll, expenses, and logs while keeping institute settings and Admin accounts.
              </p>
            </div>
            <button
              type="button"
              onClick={onResetFreshData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to Fresh Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
