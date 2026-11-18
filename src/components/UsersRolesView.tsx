import React, { useMemo, useState } from 'react';
import {
  Edit2,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  AcademyDatabase,
  NavSection,
  RolePermissionsMap,
  UserAccount,
  UserRole,
} from '../types/academy';
import { TODAY_ISO } from '../utils/calculations';
import {
  ALL_ROLES,
  CONFIGURABLE_SECTIONS,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_DESCRIPTIONS,
} from '../utils/permissions';

interface UsersRolesViewProps {
  db: AcademyDatabase;
  currentUserEmail: string | null;
  onSaveUser: (user: Omit<UserAccount, 'id'> & { id?: string }) => void;
  onDeleteUser: (id: string) => void;
  onUpdateRolePermissions: (nextMap: RolePermissionsMap) => void;
}

export const UsersRolesView: React.FC<UsersRolesViewProps> = ({
  db,
  currentUserEmail,
  onSaveUser,
  onDeleteUser,
  onUpdateRolePermissions,
}) => {
  const [subTab, setSubTab] = useState<'users' | 'matrix'>('users');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | UserRole>('All');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showModalPwd, setShowModalPwd] = useState(false);
  const [role, setRole] = useState<UserRole>('Admission Officer');
  const [linkedStudentId, setLinkedStudentId] = useState('');
  const [linkedTeacherName, setLinkedTeacherName] = useState('');
  const [status, setStatus] = useState<'Active' | 'Disabled'>('Active');
  const [formError, setFormError] = useState('');

  const rolePermissions: RolePermissionsMap = {
    ...DEFAULT_ROLE_PERMISSIONS,
    ...(db.settings.rolePermissions || {}),
  };

  const openNewModal = () => {
    setEditing(null);
    setName('');
    setEmail('');
    setPassword('');
    setShowModalPwd(true);
    setRole('Admission Officer');
    setLinkedStudentId(db.students[0]?.id || '');
    setLinkedTeacherName(db.teachers[0]?.name || '');
    setStatus('Active');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (u: UserAccount) => {
    setEditing(u);
    setName(u.name);
    setEmail(u.email);
    setPassword(u.password);
    setShowModalPwd(false);
    setRole(u.role);
    setLinkedStudentId(u.linkedStudentId || db.students[0]?.id || '');
    setLinkedTeacherName(u.linkedTeacherName || db.teachers[0]?.name || '');
    setStatus(u.status);
    setFormError('');
    setModalOpen(true);
  };

  const generatePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
    setShowModalPwd(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      setFormError('Please enter a valid Gmail or email address.');
      return;
    }
    const duplicate = db.users.find(
      (u) => u.email.toLowerCase() === normalizedEmail && u.id !== editing?.id
    );
    if (duplicate) {
      setFormError('A user account with this Gmail already exists.');
      return;
    }
    if (password.trim().length < 4) {
      setFormError('Password must be at least 4 characters.');
      return;
    }

    onSaveUser({
      id: editing?.id,
      name: name.trim(),
      email: normalizedEmail,
      password: password.trim(),
      role,
      linkedStudentId: role === 'Student' ? linkedStudentId : undefined,
      linkedTeacherName: role === 'Trainer' ? linkedTeacherName : undefined,
      status,
      createdAt: editing?.createdAt || TODAY_ISO,
    });
    setModalOpen(false);
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.users
      .filter((u) => (roleFilter === 'All' ? true : u.role === roleFilter))
      .filter((u) => {
        if (!q) return true;
        return (
          u.id.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
        );
      });
  }, [db.users, search, roleFilter]);

  const togglePermission = (targetRole: UserRole, section: NavSection) => {
    if (targetRole === 'Admin' || targetRole === 'Student') return;
    if (section === 'dashboard' || section === 'users' || section === 'settings') {
      if (section === 'dashboard') return; // always visible
      if (section === 'users' || section === 'settings') return; // admin-only
    }
    const current = rolePermissions[targetRole] || [];
    const exists = current.includes(section);
    const updated = exists
      ? current.filter((s) => s !== section)
      : [...current, section];

    onUpdateRolePermissions({
      ...rolePermissions,
      [targetRole]: updated,
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] px-5 py-4">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab('users')}
            className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
              subTab === 'users'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            User Accounts ({db.users.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('matrix')}
            className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
              subTab === 'matrix'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Role Rights Matrix
          </button>
        </div>

        {subTab === 'users' ? (
          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            Add User Account
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onUpdateRolePermissions(DEFAULT_ROLE_PERMISSIONS)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Role Defaults
          </button>
        )}
      </div>

      {subTab === 'users' ? (
        <>
          {/* Search & Role Filter */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] px-5 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, Gmail, role..."
                className="w-60 rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-xs outline-none focus:border-sky-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['All', ...ALL_ROLES] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                    roleFilter === r
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-3">User ID</th>
                    <th className="px-4 py-3">Name &amp; Gmail</th>
                    <th className="px-4 py-3">Assigned Role</th>
                    <th className="px-4 py-3">Linked Profile</th>
                    <th className="px-4 py-3">Password</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                        No users match your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isRevealed = Boolean(revealedIds[u.id]);
                      const isSelf =
                        currentUserEmail &&
                        u.email.toLowerCase() === currentUserEmail.toLowerCase();

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-900">
                            {u.id}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">
                              {u.name}
                              {isSelf && (
                                <span className="ml-2 text-xs font-normal text-sky-700">
                                  (You)
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-xs text-slate-500">{u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-semibold ${
                                u.role === 'Admin' || u.role === 'Manager'
                                  ? 'text-sky-700'
                                  : u.role === 'Accountant'
                                    ? 'text-emerald-700'
                                    : u.role === 'Student'
                                      ? 'text-slate-700'
                                      : 'text-amber-700'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {u.role === 'Student' && u.linkedStudentId ? (
                              <span className="font-mono">{u.linkedStudentId}</span>
                            ) : u.role === 'Trainer' && u.linkedTeacherName ? (
                              <span>{u.linkedTeacherName}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="inline-flex items-center gap-2 font-mono text-xs text-slate-700">
                              <span>{isRevealed ? u.password : '••••••••'}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setRevealedIds((prev) => ({
                                    ...prev,
                                    [u.id]: !prev[u.id],
                                  }))
                                }
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                title={isRevealed ? 'Hide password' : 'Show password'}
                              >
                                {isRevealed ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-medium ${
                                u.status === 'Active' ? 'text-emerald-700' : 'text-red-700'
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(u)}
                                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                title="Edit user & password"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteUser(u.id)}
                                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                                  title="Delete user"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Role Rights Matrix */
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_ROLES.map((r) => (
              <div key={r} className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-sky-700" />
                  <h3 className="text-sm font-semibold text-slate-900">{r}</h3>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  {ROLE_DESCRIPTIONS[r]}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Module Access Rights by Role
              </h3>
              <p className="text-xs text-slate-500">
                Customize which sections staff roles can open. Admin always retains full access; Student opens their dedicated personal portal.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                  <tr>
                    <th className="px-5 py-3">Module</th>
                    {ALL_ROLES.map((r) => (
                      <th key={r} className="px-4 py-3 text-center whitespace-nowrap">
                        {r}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {CONFIGURABLE_SECTIONS.map((sec) => (
                    <tr key={sec.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-medium text-slate-900">{sec.label}</td>
                      {ALL_ROLES.map((r) => {
                        const allowed = (rolePermissions[r] || []).includes(sec.id);
                        const locked =
                          r === 'Admin' ||
                          r === 'Student' ||
                          sec.id === 'dashboard' ||
                          sec.id === 'users' ||
                          sec.id === 'settings';

                        return (
                          <td key={r} className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={allowed}
                              disabled={locked}
                              onChange={() => togglePermission(r, sec.id)}
                              className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`${r} access to ${sec.label}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editing ? `Edit User ${editing.id}` : 'Add User & Set Role Rights'}
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
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sana Tariq"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Gmail Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@gmail.com"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-sky-600"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-700">Password *</label>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:underline"
                    >
                      <KeyRound className="h-3 w-3" />
                      Generate
                    </button>
                  </div>
                  <div className="relative mt-1">
                    <input
                      type={showModalPwd ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Set login password"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-9 font-mono text-sm outline-none focus:border-sky-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPwd(!showModalPwd)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showModalPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Role *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
                <span className="font-medium text-slate-800">{role} Rights: </span>
                {ROLE_DESCRIPTIONS[role]}
              </div>

              {role === 'Student' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Link to Enrolled Student Record
                  </label>
                  <select
                    value={linkedStudentId}
                    onChange={(e) => setLinkedStudentId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Auto-match by name / none</option>
                    {db.students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id} — {s.name} ({s.course})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {role === 'Trainer' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Link to Faculty Profile
                  </label>
                  <select
                    value={linkedTeacherName}
                    onChange={(e) => setLinkedTeacherName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Match by trainer full name ({name || 'user name'})</option>
                    {db.teachers.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.id} — {t.name} ({t.subject})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700">Account Status</label>
                <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                  {(['Active', 'Disabled'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={`rounded-md py-1.5 text-xs font-medium ${
                        status === st
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
                >
                  {editing ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
