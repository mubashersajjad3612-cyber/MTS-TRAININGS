import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Mail, X } from 'lucide-react';
import { PendingSheetConfirmation } from '../types/academy';

interface ConfirmModalProps {
  pending: PendingSheetConfirmation | null;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ pending, onClose }) => {
  const [busy, setBusy] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [gmailNowConnected, setGmailNowConnected] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setGmailNowConnected(false);
    setCopiedEmail(false);
    setError('');
    setBusy(false);
    setConnectingGmail(false);
  }, [pending]);

  if (!pending) return null;

  const isGmailConnected = Boolean(pending.emailPreview?.gmailConnected || gmailNowConnected);

  const mailtoHref = pending.emailPreview
    ? `mailto:${encodeURIComponent(pending.emailPreview.to)}?subject=${encodeURIComponent(
        pending.emailPreview.subject
      )}&body=${encodeURIComponent(pending.emailPreview.textBody || '')}`
    : '';

  const handleCopyEmailBody = async () => {
    if (!pending.emailPreview?.textBody) return;
    try {
      await navigator.clipboard.writeText(
        `To: ${pending.emailPreview.to}\nSubject: ${pending.emailPreview.subject}\n\n${pending.emailPreview.textBody}`
      );
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    setError('');
    try {
      await pending.onConfirm();
      setGmailNowConnected(false);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleConnectGmail = async () => {
    if (!pending.onConnectGmail) return;
    setConnectingGmail(true);
    setError('');
    try {
      await pending.onConnectGmail();
      setGmailNowConnected(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google / Gmail sign-in failed.');
    } finally {
      setConnectingGmail(false);
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="os-modal-enter w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                pending.isDestructive
                  ? 'bg-red-50 text-red-700 ring-1 ring-red-200/70'
                  : pending.emailPreview
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70'
                    : 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/70'
              }`}
            >
              {pending.emailPreview ? (
                <Mail className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-base font-semibold text-slate-900">
                {pending.title}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Workspace Action ·{' '}
                <span className="font-mono font-medium text-slate-700">{pending.affectedTab}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setGmailNowConnected(false);
              onClose();
            }}
            disabled={busy || connectingGmail}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close confirmation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">{pending.description}</p>

        {pending.emailPreview && (
          <div className="mt-4 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <span className="font-semibold text-slate-800">Automated Email Details</span>
              {isGmailConnected ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Gmail API Ready
                </span>
              ) : (
                <span className="font-medium text-slate-600">Standalone Mode (No API)</span>
              )}
            </div>
            <div className="space-y-1">
              <div>
                <span className="text-slate-500">To: </span>
                <span className="font-mono font-semibold text-slate-900">
                  {pending.emailPreview.to}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Primary Reply-To: </span>
                <span className="font-mono text-slate-800">
                  {pending.emailPreview.primaryEmail}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Subject: </span>
                <span className="font-medium text-slate-900">{pending.emailPreview.subject}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 border-t border-slate-200 pt-2.5">
              {pending.emailPreview.highlights.map((item) => (
                <div key={item.label}>
                  <div className="text-[11px] text-slate-500">{item.label}</div>
                  <div className="font-mono text-xs font-semibold text-slate-900 break-all tabular-nums">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            {!isGmailConnected && (
              <div className="space-y-2 border-t border-slate-200 pt-2.5">
                <p className="text-[11px] text-slate-600">
                  No API needed: send directly via your device Mail app or copy the formatted message, or optionally connect Gmail ({pending.emailPreview.primaryEmail}).
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {pending.emailPreview.textBody && (
                    <>
                      <a
                        href={mailtoHref}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-sky-700" />
                        Open Mail App
                      </a>
                      <button
                        type="button"
                        onClick={handleCopyEmailBody}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100"
                      >
                        {copiedEmail ? (
                          <Check className="h-3.5 w-3.5 text-emerald-700" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-slate-500" />
                        )}
                        {copiedEmail ? 'Copied Text' : 'Copy Message'}
                      </button>
                    </>
                  )}
                  {pending.onConnectGmail && (
                    <button
                      type="button"
                      onClick={handleConnectGmail}
                      disabled={connectingGmail || busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-50 disabled:opacity-50"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {connectingGmail ? 'Connecting...' : 'Connect Gmail (Optional)'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setGmailNowConnected(false);
              onClose();
            }}
            disabled={busy || connectingGmail}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || connectingGmail}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              pending.isDestructive
                ? 'bg-red-700 hover:bg-red-800'
                : 'bg-sky-700 hover:bg-sky-800'
            }`}
          >
            {busy ? 'Processing...' : pending.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
