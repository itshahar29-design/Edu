'use client';

import { useEffect, useState, useTransition, type ChangeEvent, type FormEvent } from 'react';
import {
  createGroup,
  createSchool,
  createStudent,
  deactivateUser,
  deleteGroup,
  deleteSchool,
  deleteStudent,
  getGroupsForSchool,
  getSchools,
  getStudentsForSchool,
  getUsers,
  updateGroup,
  updateSchool,
  updateStudent,
  updateUserRole,
} from '@/lib/actions/owner-actions';
import type { UserRole } from '@/types/database';

// -----------------------------------------------------------------------
// Ro'yxatlarning himoyasi: har bir Server Action ichida requireRole('owner')
// mustaqil ravishda tekshiriladi (owner-actions.ts). Bundan tashqari,
// middleware.ts /owner/* yo'llarini rol bo'yicha filtrlaydi. Shu sababli bu
// sahifa client component sifatida yozilgan — qo'shimcha server tekshiruvi
// shart emas, ikkala qatlam allaqachon mavjud.
// -----------------------------------------------------------------------

interface School {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
}

interface Group {
  id: string;
  name: string;
  teacher_id: string | null;
}

interface Student {
  id: string;
  full_name: string;
  phone: string | null;
  group_id: string | null;
  is_active: boolean;
}

interface UserRow {
  id: string;
  full_name: string;
  username: string | null;
  role: UserRole;
  school_id: string | null;
  telegram_id: number;
}

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  teacher: "O'qituvchi",
  parent: 'Ota-ona',
  student: "O'quvchi",
};
const ROLE_OPTIONS = Object.keys(ROLE_LABELS) as UserRole[];

type TabKey = 'overview' | 'schools' | 'groups' | 'students' | 'users';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Umumiy' },
  { key: 'schools', label: 'Maktablar' },
  { key: 'groups', label: 'Guruhlar' },
  { key: 'students', label: "O'quvchilar" },
  { key: 'users', label: 'Foydalanuvchilar' },
];

export default function OwnerPanelPage() {
  const [tab, setTab] = useState<TabKey>('overview');

  // umumiy holat — bo'limlar orasida ulashiladi
  const [schools, setSchools] = useState<School[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groupsBySchool, setGroupsBySchool] = useState<Record<string, Group[]>>({});
  const [studentsBySchool, setStudentsBySchool] = useState<Record<string, Student[]>>({});
  const [selectedSchoolId, setSelectedSchoolId] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeSchools = schools.filter((s) => s.is_active);

  // ilk yuklash: maktablar va foydalanuvchilar
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([getSchools(), getUsers()]).then(([schoolsResult, usersResult]) => {
      if (cancelled) return;
      if (schoolsResult.success && schoolsResult.data) {
        setSchools(schoolsResult.data);
        const firstActive = schoolsResult.data.find((s) => s.is_active);
        if (firstActive) setSelectedSchoolId(firstActive.id);
      } else {
        setError(schoolsResult.error ?? "Maktablar yuklanmadi");
      }
      if (usersResult.success && usersResult.data) {
        setUsers(usersResult.data);
      } else if (usersResult.error) {
        setError(usersResult.error);
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // tanlangan maktab uchun guruh/o'quvchi keshini yuklash (bo'sh bo'lsa)
  useEffect(() => {
    if (!selectedSchoolId) return;
    if (groupsBySchool[selectedSchoolId] && studentsBySchool[selectedSchoolId]) return;

    let cancelled = false;
    Promise.all([
      getGroupsForSchool(selectedSchoolId),
      getStudentsForSchool(selectedSchoolId),
    ]).then(([groupsResult, studentsResult]) => {
      if (cancelled) return;
      if (groupsResult.success && groupsResult.data) {
        setGroupsBySchool((prev) => ({ ...prev, [selectedSchoolId]: groupsResult.data! }));
      }
      if (studentsResult.success && studentsResult.data) {
        setStudentsBySchool((prev) => ({ ...prev, [selectedSchoolId]: studentsResult.data! }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedSchoolId, groupsBySchool, studentsBySchool]);

  const groups = groupsBySchool[selectedSchoolId] ?? [];
  const students = studentsBySchool[selectedSchoolId] ?? [];

  function setGroupsFor(schoolId: string, updater: (prev: Group[]) => Group[]) {
    setGroupsBySchool((prev) => ({ ...prev, [schoolId]: updater(prev[schoolId] ?? []) }));
  }

  function setStudentsFor(schoolId: string, updater: (prev: Student[]) => Student[]) {
    setStudentsBySchool((prev) => ({ ...prev, [schoolId]: updater(prev[schoolId] ?? []) }));
  }

  // ---------------- Maktablar ----------------
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');

  function handleCreateSchool(event: FormEvent) {
    event.preventDefault();
    if (!schoolName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createSchool(schoolName.trim(), schoolAddress.trim() || undefined);
      if (!result.success || !result.data) {
        setError(result.error ?? "Maktab qo'shilmadi");
        return;
      }
      setSchools((prev) => [
        { id: result.data!.id, name: schoolName.trim(), address: schoolAddress.trim() || null, is_active: true },
        ...prev,
      ]);
      setSchoolName('');
      setSchoolAddress('');
    });
  }

  function handleToggleSchoolActive(school: School) {
    setError(null);
    startTransition(async () => {
      const result = await updateSchool(school.id, { is_active: !school.is_active });
      if (!result.success) {
        setError(result.error ?? 'Yangilanmadi');
        return;
      }
      setSchools((prev) => prev.map((s) => (s.id === school.id ? { ...s, is_active: !s.is_active } : s)));
    });
  }

  function handleDeleteSchool(school: School) {
    setError(null);
    startTransition(async () => {
      const result = await deleteSchool(school.id);
      if (!result.success) {
        setError(result.error ?? "O'chirilmadi");
        return;
      }
      setSchools((prev) => prev.map((s) => (s.id === school.id ? { ...s, is_active: false } : s)));
    });
  }

  // ---------------- Guruhlar ----------------
  const [groupName, setGroupName] = useState('');

  function handleCreateGroup(event: FormEvent) {
    event.preventDefault();
    if (!groupName.trim() || !selectedSchoolId) return;
    setError(null);
    startTransition(async () => {
      const result = await createGroup(selectedSchoolId, groupName.trim());
      if (!result.success || !result.data) {
        setError(result.error ?? "Guruh qo'shilmadi");
        return;
      }
      setGroupsFor(selectedSchoolId, (prev) => [
        ...prev,
        { id: result.data!.id, name: groupName.trim(), teacher_id: null },
      ]);
      setGroupName('');
    });
  }

  function handleRenameGroup(group: Group) {
    const newName = window.prompt('Guruh nomi', group.name);
    if (!newName || newName.trim() === group.name) return;
    setError(null);
    startTransition(async () => {
      const result = await updateGroup(group.id, { name: newName.trim() });
      if (!result.success) {
        setError(result.error ?? 'Yangilanmadi');
        return;
      }
      setGroupsFor(selectedSchoolId, (prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, name: newName.trim() } : g))
      );
    });
  }

  function handleDeleteGroup(group: Group) {
    setError(null);
    startTransition(async () => {
      const result = await deleteGroup(group.id);
      if (!result.success) {
        setError(result.error ?? "O'chirilmadi");
        return;
      }
      setGroupsFor(selectedSchoolId, (prev) => prev.filter((g) => g.id !== group.id));
    });
  }

  // ---------------- O'quvchilar ----------------
  const [studentName, setStudentName] = useState('');
  const [studentGroupId, setStudentGroupId] = useState('');

  function handleCreateStudent(event: FormEvent) {
    event.preventDefault();
    if (!studentName.trim() || !selectedSchoolId) return;
    setError(null);
    startTransition(async () => {
      const result = await createStudent(selectedSchoolId, studentName.trim(), studentGroupId || undefined);
      if (!result.success || !result.data) {
        setError(result.error ?? "O'quvchi qo'shilmadi");
        return;
      }
      setStudentsFor(selectedSchoolId, (prev) => [
        ...prev,
        {
          id: result.data!.id,
          full_name: studentName.trim(),
          phone: null,
          group_id: studentGroupId || null,
          is_active: true,
        },
      ]);
      setStudentName('');
      setStudentGroupId('');
    });
  }

  function handleMoveStudentGroup(student: Student, newGroupId: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateStudent(student.id, { group_id: newGroupId || null });
      if (!result.success) {
        setError(result.error ?? 'Yangilanmadi');
        return;
      }
      setStudentsFor(selectedSchoolId, (prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, group_id: newGroupId || null } : s))
      );
    });
  }

  function handleDeleteStudent(student: Student) {
    setError(null);
    startTransition(async () => {
      const result = await deleteStudent(student.id);
      if (!result.success) {
        setError(result.error ?? "O'chirilmadi");
        return;
      }
      setStudentsFor(selectedSchoolId, (prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, is_active: false } : s))
      );
    });
  }

  // ---------------- Foydalanuvchilar ----------------
  function schoolNameById(id: string | null): string {
    if (!id) return '—';
    return schools.find((s) => s.id === id)?.name ?? '—';
  }

  function handleRoleChange(user: UserRow, role: UserRole) {
    setError(null);
    const schoolId = role === 'owner' ? null : user.school_id;
    startTransition(async () => {
      const result = await updateUserRole(user.id, role, schoolId);
      if (!result.success) {
        setError(result.error ?? 'Yangilanmadi');
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role, school_id: schoolId } : u)));
    });
  }

  function handleUserSchoolChange(user: UserRow, schoolId: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateUserRole(user.id, user.role, schoolId || null);
      if (!result.success) {
        setError(result.error ?? 'Yangilanmadi');
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, school_id: schoolId || null } : u)));
    });
  }

  function handleDeactivateUser(user: UserRow) {
    setError(null);
    startTransition(async () => {
      const result = await deactivateUser(user.id);
      if (!result.success) {
        setError(result.error ?? "O'chirilmadi");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    });
  }

  // ---------------- Render ----------------
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-4 pb-24">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-gray-900">EduMemory — Owner panel</h1>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      {isLoading && <p className="text-center text-sm text-gray-400">Yuklanmoqda...</p>}

      {!isLoading && tab === 'overview' && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Maktablar" value={schools.length} hint={`${activeSchools.length} faol`} />
          <StatCard label="Foydalanuvchilar" value={users.length} />
          <StatCard label="Adminlar" value={users.filter((u) => u.role === 'admin').length} />
          <StatCard label="O'qituvchilar" value={users.filter((u) => u.role === 'teacher').length} />
        </div>
      )}

      {!isLoading && tab === 'schools' && (
        <div className="flex flex-col gap-3">
          <form onSubmit={handleCreateSchool} className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm">
            <label className="text-xs font-medium text-gray-500">Yangi maktab</label>
            <input
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Maktab nomi"
              className="rounded-lg border border-gray-200 p-2 text-sm"
              required
            />
            <input
              value={schoolAddress}
              onChange={(e) => setSchoolAddress(e.target.value)}
              placeholder="Manzil (ixtiyoriy)"
              className="rounded-lg border border-gray-200 p-2 text-sm"
            />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Qo&apos;shish
            </button>
          </form>

          <div className="flex flex-col gap-2">
            {schools.length === 0 && <p className="text-center text-sm text-gray-400">Maktablar topilmadi</p>}
            {schools.map((school) => (
              <div key={school.id} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-800">{school.name}</span>
                  {school.address && <span className="text-xs text-gray-400">{school.address}</span>}
                  <span
                    className={`mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
                      school.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {school.is_active ? 'Faol' : 'Nofaol'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSchoolActive(school)}
                    disabled={isPending}
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 disabled:opacity-50"
                  >
                    {school.is_active ? 'Faolsizlantirish' : 'Faollashtirish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSchool(school)}
                    disabled={isPending || !school.is_active}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 disabled:opacity-50"
                  >
                    O&apos;chirish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && (tab === 'groups' || tab === 'students') && (
        <div className="flex flex-col gap-1 rounded-2xl bg-white p-3 shadow-sm">
          <label className="text-xs font-medium text-gray-500">Maktab</label>
          <select
            value={selectedSchoolId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedSchoolId(e.target.value)}
            className="rounded-lg border border-gray-200 p-2 text-sm"
          >
            {activeSchools.length === 0 && <option value="">Maktab topilmadi</option>}
            {activeSchools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!isLoading && tab === 'groups' && (
        <div className="flex flex-col gap-3">
          <form onSubmit={handleCreateGroup} className="flex gap-2 rounded-2xl bg-white p-3 shadow-sm">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Yangi guruh nomi"
              className="flex-1 rounded-lg border border-gray-200 p-2 text-sm"
              required
              disabled={!selectedSchoolId}
            />
            <button
              type="submit"
              disabled={isPending || !selectedSchoolId}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Qo&apos;shish
            </button>
          </form>

          <div className="flex flex-col gap-2">
            {groups.length === 0 && <p className="text-center text-sm text-gray-400">Guruhlar topilmadi</p>}
            {groups.map((group) => (
              <div key={group.id} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                <span className="text-sm font-medium text-gray-800">{group.name}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleRenameGroup(group)}
                    disabled={isPending}
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 disabled:opacity-50"
                  >
                    Tahrirlash
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(group)}
                    disabled={isPending}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 disabled:opacity-50"
                  >
                    O&apos;chirish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && tab === 'students' && (
        <div className="flex flex-col gap-3">
          <form onSubmit={handleCreateStudent} className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm">
            <label className="text-xs font-medium text-gray-500">Yangi o&apos;quvchi</label>
            <input
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Ism familiya"
              className="rounded-lg border border-gray-200 p-2 text-sm"
              required
              disabled={!selectedSchoolId}
            />
            <select
              value={studentGroupId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setStudentGroupId(e.target.value)}
              className="rounded-lg border border-gray-200 p-2 text-sm"
              disabled={!selectedSchoolId}
            >
              <option value="">Guruhsiz</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isPending || !selectedSchoolId}
              className="rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Qo&apos;shish
            </button>
          </form>

          <div className="flex flex-col gap-2">
            {students.length === 0 && <p className="text-center text-sm text-gray-400">O&apos;quvchilar topilmadi</p>}
            {students.map((student) => (
              <div key={student.id} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                <div className="flex flex-col">
                  <span
                    className={`text-sm font-medium ${student.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}
                  >
                    {student.full_name}
                  </span>
                  <select
                    value={student.group_id ?? ''}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => handleMoveStudentGroup(student, e.target.value)}
                    disabled={isPending || !student.is_active}
                    className="mt-1 w-fit rounded-lg border border-gray-200 p-1 text-xs text-gray-500"
                  >
                    <option value="">Guruhsiz</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteStudent(student)}
                  disabled={isPending || !student.is_active}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 disabled:opacity-50"
                >
                  O&apos;chirish
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && tab === 'users' && (
        <div className="flex flex-col gap-2">
          {users.length === 0 && <p className="text-center text-sm text-gray-400">Foydalanuvchilar topilmadi</p>}
          {users.map((user) => (
            <div key={user.id} className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-800">{user.full_name}</span>
                  <span className="text-xs text-gray-400">
                    {user.username ? `@${user.username}` : `ID: ${user.telegram_id}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeactivateUser(user)}
                  disabled={isPending}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 disabled:opacity-50"
                >
                  Faolsizlantirish
                </button>
              </div>

              <div className="flex gap-2">
                <select
                  value={user.role}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => handleRoleChange(user, e.target.value as UserRole)}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-gray-200 p-2 text-xs"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>

                {user.role !== 'owner' && (
                  <select
                    value={user.school_id ?? ''}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => handleUserSchoolChange(user, e.target.value)}
                    disabled={isPending}
                    className="flex-1 rounded-lg border border-gray-200 p-2 text-xs"
                  >
                    <option value="">Maktabsiz</option>
                    {activeSchools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {user.role !== 'owner' && (
                <span className="text-xs text-gray-400">Joriy maktab: {schoolNameById(user.school_id)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm">
      <span className="text-2xl font-semibold text-gray-900">{value}</span>
      <span className="text-sm text-gray-500">{label}</span>
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
  );
}
