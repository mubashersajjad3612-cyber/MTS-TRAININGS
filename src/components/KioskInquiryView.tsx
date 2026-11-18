import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { AcademySettings, Batch, Inquiry, InquirySource } from '../types/academy';
import { TODAY_ISO } from '../utils/calculations';
import { MTSLogo } from './MTSLogo';

interface KioskInquiryViewProps {
  settings: AcademySettings;
  batches: Batch[];
  onSubmitInquiry: (data: Omit<Inquiry, 'id' | 'date' | 'status'>) => Promise<void>;
  onExitKiosk: () => void;
}

export const KioskInquiryView: React.FC<KioskInquiryViewProps> = ({
  settings,
  batches,
  onSubmitInquiry,
  onExitKiosk,
}) => {
  const uniqueCourses = Array.from(new Set(batches.map((b) => b.course)));
  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [interestedCourse, setInterestedCourse] = useState(uniqueCourses[0] || '');
  const [preferredTiming, setPreferredTiming] = useState('Morning (09:00 AM)');
  const [source, setSource] = useState<InquirySource>('Walk-in');
  const [remarks, setRemarks] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmitInquiry({
        fullName: fullName.trim(),
        fatherName: fatherName.trim(),
        gender,
        phone: phone.trim(),
        email: email.trim(),
        interestedCourse,
        preferredTiming,
        source,
        followUpDate: TODAY_ISO,
        remarks: remarks.trim(),
      });
      setSubmitted(true);
      setFullName('');
      setFatherName('');
      setPhone('');
      setEmail('');
      setRemarks('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef2f6]">
      {/* Branded Midnight Navy Top Banner */}
      <div className="bg-[#071526] px-4 py-5 text-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <MTSLogo size="md" className="border border-white/15" />
            <div>
              <h1 className="text-lg font-semibold text-white">{settings.academyName}</h1>
              <p className="text-xs text-sky-300/90">
                Walk-In Admission Inquiry Desk · {settings.address}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onExitKiosk}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-white/15 whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Exit Kiosk
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="os-card p-6 sm:p-8">
          {submitted ? (
            <div className="py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-slate-900">
                Inquiry Submitted Successfully
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Thank you for visiting {settings.academyName}. Our admissions counselor will contact you shortly.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-6 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-800"
              >
                Submit Another Inquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-xl font-semibold text-slate-900">Student Admission Inquiry</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Complete your details below for course counseling and batch schedule information.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Zainab Tariq"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-600/15"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Father Name *</label>
                  <input
                    type="text"
                    required
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="e.g. Tariq Mehmood"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-600/15"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Gender *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'Male' | 'Female' | 'Other')}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-600"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Phone / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="03001234567"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="optional@email.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Interested Course *</label>
                  {uniqueCourses.length > 0 ? (
                    <select
                      value={interestedCourse || uniqueCourses[0]}
                      onChange={(e) => setInterestedCourse(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-600"
                    >
                      {uniqueCourses.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={interestedCourse}
                      onChange={(e) => setInterestedCourse(e.target.value)}
                      placeholder="e.g. Web Development, IELTS..."
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Preferred Slot</label>
                  <select
                    value={preferredTiming}
                    onChange={(e) => setPreferredTiming(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-600"
                  >
                    <option value="Morning (09:00 AM)">Morning (09:00 AM)</option>
                    <option value="Afternoon (02:00 PM)">Afternoon (02:00 PM)</option>
                    <option value="Evening (06:30 PM)">Evening (06:30 PM)</option>
                    <option value="Weekend (10:00 AM)">Weekend (10:00 AM)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">How did you hear about us?</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as InquirySource)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-600"
                  >
                    <option value="Walk-in">Walk-in</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Referral">Referral</option>
                    <option value="Call">Call</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Questions or Goals</label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Share any prior experience or preferred start date..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#071526] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0e2644] disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Inquiry'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
