import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
  TabletSmartphone,
} from 'lucide-react';
import { UserAccount } from '../types/academy';
import { MTSLogo } from './MTSLogo';

interface LoginScreenProps {
  academyName: string;
  users: UserAccount[];
  onGoogleLogin: () => Promise<void>;
  onEmailPasswordLogin: (email: string, password: string) => { ok: boolean; error?: string };
  onOpenKiosk: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  academyName,
  users,
  onGoogleLogin,
  onEmailPasswordLogin,
  onOpenKiosk,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showAccountsHelper, setShowAccountsHelper] = useState(false);

  const handleGoogleClick = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await onGoogleLogin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = onEmailPasswordLogin(email, password);
    if (!result.ok && result.error) {
      setError(result.error);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-[#eef2f6] px-4 py-10">
      {/* Subtle architectural grid backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 20%, rgba(14, 165, 233, 0.08), transparent 42%), radial-gradient(circle at 85% 80%, rgba(7, 21, 38, 0.06), transparent 45%)',
        }}
      />

      <div className="relative mx-auto flex w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/[0.06] lg:grid-cols-12">
          {/* Left column — Midnight Navy Academy Showcase */}
          <div className="relative flex flex-col justify-between overflow-hidden bg-[#071526] p-8 text-white sm:p-10 lg:col-span-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-25 blur-3xl"
              style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full opacity-15 blur-3xl"
              style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }}
            />

            <div className="relative">
              <div className="flex items-center gap-4">
                <MTSLogo size="lg" className="border border-white/15 shadow-lg" />
                <div>
                  <span className="block font-display text-xl font-bold tracking-tight text-white">
                    {academyName}
                  </span>
                  <span className="mt-0.5 block text-xs tracking-wide text-sky-300/90">
                    Learn · Grow · Build Your Future
                  </span>
                </div>
              </div>

              <h1 className="mt-9 text-2xl font-semibold leading-snug tracking-tight text-white [text-wrap:balance] sm:text-[26px]">
                Academy Operations &amp; Role-Based Workspace
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Sign in with your assigned Gmail and password—or connect with Google—to access your role-scoped operations console.
              </p>

              <div className="mt-8 space-y-4 border-t border-white/10 pt-6 text-xs text-slate-300">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 font-mono text-[11px] font-semibold text-sky-400">01.</span>
                  <div>
                    <div className="font-medium text-white">Admissions, Batches &amp; A4 Forms</div>
                    <div className="mt-0.5 text-slate-400">
                      Unique CNIC validation, student photos, and printable A4 admission &amp; fee vouchers.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 font-mono text-[11px] font-semibold text-amber-400">02.</span>
                  <div>
                    <div className="font-medium text-white">Accountant Verification &amp; Gmail Receipts</div>
                    <div className="mt-0.5 text-slate-400">
                      Automated portal credentials and payment receipts dispatched directly via Gmail.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 font-mono text-[11px] font-semibold text-emerald-400">03.</span>
                  <div>
                    <div className="font-medium text-white">HR Payroll, Attendance &amp; Analytics</div>
                    <div className="mt-0.5 text-slate-400">
                      Staff payroll slips, trainer-scoped attendance, and live Google Sheets sync.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative mt-9 border-t border-white/10 pt-6">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Reception &amp; Walk-In Desk</span>
                <span>Self-Service Mode</span>
              </div>
              <button
                type="button"
                onClick={onOpenKiosk}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.12]"
              >
                <TabletSmartphone className="h-4 w-4 text-sky-400" />
                Open Public Inquiry Form (Kiosk)
              </button>
            </div>
          </div>

          {/* Right column — Sign-In Panel */}
          <div className="flex flex-col justify-center p-8 sm:p-10 lg:col-span-7">
            <div className="flex items-center gap-2 text-xs font-medium text-sky-700">
              <ShieldCheck className="h-4 w-4" />
              <span>Secure Role-Based Access</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Sign in to Academy OS
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Use Google Sign-In or your Gmail and password configured by the Admin.
            </p>

            {/* Official Google Sign-In */}
            <div className="mt-6">
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={googleLoading}
                className="gsi-material-button"
              >
                <div className="gsi-material-button-state" />
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
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
                  <span className="gsi-material-button-contents">
                    {googleLoading ? 'Connecting Google Account...' : 'Sign in with Google'}
                  </span>
                </div>
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Optional: Connect Google for Sheets sync &amp; Gmail API, or sign in below with Gmail &amp; Password (no API required).
              </p>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium text-slate-400">
                or sign in with Gmail &amp; password
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-medium text-slate-700">
                  Gmail Address
                </label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 py-2.5 pl-10 pr-3.5 font-mono text-sm text-slate-900 outline-none transition-colors focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-600/15"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-medium text-slate-700">
                  Password
                </label>
                <div className="relative mt-1.5">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-password"
                    type={showPwd ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/40 py-2.5 pl-10 pr-10 font-mono text-sm text-slate-900 outline-none transition-colors focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-600/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-[#071526] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0e2644]"
              >
                Sign In to Workspace
              </button>
            </form>

            {/* Quick Role Account Switcher */}
            <div className="mt-6 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowAccountsHelper(!showAccountsHelper)}
                className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                <span>
                  Quick-Fill Configured Role Accounts ({users.filter((u) => u.status === 'Active').length})
                </span>
                {showAccountsHelper ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              {showAccountsHelper && (
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  {users
                    .filter((u) => u.status === 'Active')
                    .map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setEmail(u.email);
                          setPassword(u.password);
                          setError('');
                        }}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-left text-xs transition-colors hover:border-sky-300 hover:bg-sky-50/60"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate font-medium text-slate-900">{u.role}</div>
                          <div className="truncate font-mono text-[11px] text-slate-500">
                            {u.email}
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold text-sky-700">
                          Fill
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
