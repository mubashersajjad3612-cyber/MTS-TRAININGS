import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit2,
  Plus,
  Search,
  TabletSmartphone,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  Batch,
  Inquiry,
  InquirySource,
  InquiryStatus,
} from '../types/academy';
import { TODAY_ISO } from '../utils/calculations';

interface InquiriesViewProps {
  inquiries: Inquiry[];
  batches: Batch[];
  onSaveInquiry: (inq: Omit<Inquiry, 'id'> & { id?: string }) => void;
  onDeleteInquiry: (id: string) => void;
  onConvertInquiry: (inq: Inquiry) => void;
  onOpenKiosk: () => void;
}

const STATUS_OPTIONS: ('All' | InquiryStatus)[] = [
  'All',
  'New',
  'Contacted',
  'Demo Scheduled',
  'Converted',
  'Closed',
];

export const InquiriesView: React.FC<InquiriesViewProps> = ({
  inquiries,
  batches,
  onSaveInquiry,
  onDeleteInquiry,
  onConvertInquiry,
  onOpenKiosk,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | InquiryStatus>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Inquiry | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const uniqueCourses = Array.from(new Set(batches.map((b) => b.course)));

  // Form states
  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [interestedCourse, setInterestedCourse] = useState(uniqueCourses[0] || '');
  const [preferredTiming, setPreferredTiming] = useState('Morning (09:00 AM)');
  const [source, setSource] = useState<InquirySource>('Walk-in');
  const [followUpDate, setFollowUpDate] = useState(TODAY_ISO);
  const [status, setStatus] = useState<InquiryStatus>('New');
  const [remarks, setRemarks] = useState('');

  const openNewModal = () => {
    setEditing(null);
    setFullName('');
    setFatherName('');
    setGender('Male');
    setPhone('');
    setEmail('');
    setInterestedCourse(uniqueCourses[0] || '');
    setPreferredTiming('Morning (09:00 AM)');
    setSource('Walk-in');
    setFollowUpDate(TODAY_ISO);
    setStatus('New');
    setRemarks('');
    setModalOpen(true);
  };

  const openEditModal = (inq: Inquiry) => {
    setEditing(inq);
    setFullName(inq.fullName);
    setFatherName(inq.fatherName);
    setGender(inq.gender);
    setPhone(inq.phone);
    setEmail(inq.email);
    setInterestedCourse(inq.interestedCourse);
    setPreferredTiming(inq.preferredTiming);
    setSource(inq.source);
    setFollowUpDate(inq.followUpDate);
    setStatus(inq.status);
    setRemarks(inq.remarks);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveInquiry({
      id: editing?.id,
      date: editing?.date || TODAY_ISO,
      fullName: fullName.trim(),
      fatherName: fatherName.trim(),
      gender,
      phone: phone.trim(),
      email: email.trim(),
      interestedCourse,
      preferredTiming,
      source,
      followUpDate,
      status,
      remarks: remarks.trim(),
    });
    setModalOpen(false);
  };

  const handleCopyKioskUrl = async () => {
    const url = `${window.location.origin}${window.location.pathname}?kiosk=inquiry`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inquiries
      .filter((i) => (statusFilter === 'All' ? true : i.status === statusFilter))
      .filter((i) => {
        if (!q) return true;
        return (
          i.id.toLowerCase().includes(q) ||
          i.fullName.toLowerCase().includes(q) ||
          i.phone.toLowerCase().includes(q) ||
          i.interestedCourse.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [inquiries, statusFilter, search]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, course..."
              className="w-60 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-sky-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {STATUS_OPTIONS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyKioskUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedLink ? 'Link Copied' : 'Copy Public Link'}
          </button>
          <button
            type="button"
            onClick={onOpenKiosk}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <TabletSmartphone className="h-3.5 w-3.5" />
            Kiosk Mode
          </button>
          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Inquiry
          </button>
        </div>
      </div>

      {/* Pipeline Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-5 py-3">ID &amp; Date</th>
                <th className="px-4 py-3">Prospect</th>
                <th className="px-4 py-3">Course &amp; Slot</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Follow-up</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                    No inquiries match your filter. Add a new inquiry or open Kiosk Mode for walk-ins.
                  </td>
                </tr>
              ) : (
                filtered.map((inq) => (
                  <tr key={inq.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="font-mono text-xs font-semibold text-slate-800">{inq.id}</div>
                      <div className="font-mono text-xs text-slate-500">{inq.date}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{inq.fullName}</div>
                      <div className="text-xs text-slate-500">
                        S/D of {inq.fatherName || '—'} · <span className="font-mono">{inq.phone}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-800">{inq.interestedCourse}</div>
                      <div className="text-xs text-slate-500">{inq.preferredTiming}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{inq.source}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {inq.followUpDate || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium ${
                          inq.status === 'Converted'
                            ? 'text-emerald-700'
                            : inq.status === 'Closed'
                              ? 'text-slate-500'
                              : inq.status === 'Demo Scheduled'
                                ? 'text-sky-700'
                                : 'text-amber-700'
                        }`}
                      >
                        {inq.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {inq.status !== 'Converted' && (
                          <button
                            type="button"
                            onClick={() => onConvertInquiry(inq)}
                            className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-blue-100 whitespace-nowrap"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Convert
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(inq)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          title="Edit inquiry"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteInquiry(inq.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                          title="Delete inquiry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editing ? `Edit Inquiry ${editing.id}` : 'Log Admission Inquiry'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Father Name</label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-600"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'Male' | 'Female' | 'Other')}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-600"
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
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-600"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Preferred Timing</label>
                  <input
                    type="text"
                    value={preferredTiming}
                    onChange={(e) => setPreferredTiming(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Source</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as InquirySource)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="Walk-in">Walk-in</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Referral">Referral</option>
                    <option value="Call">Call</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Follow-up Date</label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Pipeline Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as InquiryStatus)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Demo Scheduled">Demo Scheduled</option>
                    <option value="Converted">Converted</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Remarks</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
                >
                  {editing ? 'Update Inquiry' : 'Save Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
