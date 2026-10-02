'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useTelegram } from './telegram-init';
import {
  getAttendanceForDate,
  getGroups,
  getStudents,
  saveAttendance,
} from '@/lib/actions/attendance-actions';
import type { AttendanceStatus } from '@/types/database';

interface GroupOption {
  id: string;
  name: string;
}

interface StudentRow {
  id: string;
  full_name: string;
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Keldi',
  absent: "Yo'q",
  late: 'Kechikdi',
};

const STATUS_STYLES: Record<AttendanceStatus, { active: string; idle: string }> = {
  present: {
    active: 'bg-green-500 text-white border-green-500',
    idle: 'bg-white text-green-600 border-green-300',
  },
  absent: {
    active: 'bg-red-500 text-white border-red-500',
    idle: 'bg-white text-red-600 border-red-300',
  },
  late: {
    active: 'bg-yellow-400 text-white border-yellow-400',
    idle: 'bg-white text-yellow-600 border-yellow-300',
  },
};

function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function AttendanceClient() {
  const { webApp, isAuthenticating, authError, role } = useTelegram();

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [date, setDate] = useState<string>(todayIso());
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = role === 'owner' || role === 'admin' || role === 'teacher';

  // Guruhlarni yuklash (autentifikatsiya tugagach)
  useEffect(() => {
    if (isAuthenticating || authError) return;

    let cancelled = false;
    setLoadingGroups(true);

    getGroups()
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setGroups(result.data);
          if (result.data.length > 0) {
            setSelectedGroupId((prev) => prev || result.data![0].id);
          }
        } else {
          setErrorMessage(result.error ?? 'Guruhlarni yuklab bo\'lmadi');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingGroups(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticating, authError]);

  // Tanlangan guruh/sana bo'yicha o'quvchilar va mavjud davomatni yuklash
  useEffect(() => {
    if (!selectedGroupId) {
      setStudents([]);
      return;
    }

    let cancelled = false;
    setLoadingStudents(true);
    setErrorMessage(null);

    Promise.all([getStudents(selectedGroupId), getAttendanceForDate(selectedGroupId, date)]).then(
      ([studentsResult, attendanceResult]) => {
        if (cancelled) return;

        if (studentsResult.success && studentsResult.data) {
          setStudents(studentsResult.data);
        } else {
          setErrorMessage(studentsResult.error ?? "O'quvchilarni yuklab bo'lmadi");
        }

        if (attendanceResult.success && attendanceResult.data) {
          setStatuses(attendanceResult.data);
        } else {
          setStatuses({});
        }

        setLoadingStudents(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [selectedGroupId, date]);

  const handleStatusChange = useCallback(
    (studentId: string, status: AttendanceStatus) => {
      if (!canEdit) return;
      webApp?.HapticFeedback.impactOccurred('light');
      setStatuses((prev) => ({ ...prev, [studentId]: status }));
    },
    [canEdit, webApp]
  );

  const handleSave = useCallback(async () => {
    if (!selectedGroupId || isSaving) return;

    const records = Object.entries(statuses).map(([studentId, status]) => ({
      studentId,
      status,
    }));

    if (records.length === 0) {
      webApp?.showAlert("Kamida bitta o'quvchi statusini belgilang");
      return;
    }

    setIsSaving(true);
    webApp?.MainButton.showProgress(true);

    const result = await saveAttendance(selectedGroupId, date, records);

    webApp?.MainButton.hideProgress();
    setIsSaving(false);

    if (result.success) {
      webApp?.HapticFeedback.notificationOccurred('success');
      webApp?.showAlert('Davomat saqlandi ✅');
    } else {
      webApp?.HapticFeedback.notificationOccurred('error');
      webApp?.showAlert(result.error ?? 'Xatolik yuz berdi');
    }
  }, [selectedGroupId, date, statuses, isSaving, webApp]);

  // Telegram MainButton'ni sozlash
  useEffect(() => {
    if (!webApp || !canEdit) return;

    webApp.MainButton.setText('Saqlash').show();
    webApp.MainButton.onClick(handleSave);

    return () => {
      webApp.MainButton.offClick(handleSave);
      webApp.MainButton.hide();
    };
  }, [webApp, canEdit, handleSave]);

  if (isAuthenticating) {
    return <CenteredMessage text="Yuklanmoqda..." />;
  }

  if (authError) {
    return <CenteredMessage text={authError} isError />;
  }

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4 pb-24">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-[var(--tg-text-color,#111827)]">
          EduMemory — Davomat
        </h1>
        {role && (
          <span className="w-fit rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            {role}
          </span>
        )}
      </header>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Sinf / guruh</label>
          <select
            value={selectedGroupId}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setSelectedGroupId(event.target.value)}
            disabled={loadingGroups || groups.length === 0}
            className="rounded-lg border border-gray-200 p-2 text-sm"
          >
            {groups.length === 0 && <option value="">Guruh topilmadi</option>}
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Sana</label>
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setDate(event.target.value)}
            className="rounded-lg border border-gray-200 p-2 text-sm"
          />
        </div>
      </section>

      {errorMessage && (
        <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{errorMessage}</p>
      )}

      <section className="flex flex-col gap-2">
        {loadingStudents && <CenteredMessage text="O'quvchilar yuklanmoqda..." />}

        {!loadingStudents && students.length === 0 && (
          <CenteredMessage text="Bu guruhda o'quvchi topilmadi" />
        )}

        {!loadingStudents &&
          students.map((student) => (
            <div
              key={student.id}
              className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm"
            >
              <span className="text-sm font-medium text-gray-800">{student.full_name}</span>
              <div className="flex gap-1.5">
                {(Object.keys(STATUS_LABELS) as AttendanceStatus[]).map((status) => {
                  const isActive = statuses[student.id] === status;
                  const style = isActive
                    ? STATUS_STYLES[status].active
                    : STATUS_STYLES[status].idle;
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleStatusChange(student.id, status)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${style} disabled:opacity-50`}
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
      </section>

      {!canEdit && students.length > 0 && (
        <p className="text-center text-xs text-gray-400">
          Siz faqat ko&apos;rish huquqiga egasiz
        </p>
      )}
    </div>
  );
}

function CenteredMessage({ text, isError = false }: { text: string; isError?: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className={`text-center text-sm ${isError ? 'text-red-500' : 'text-gray-400'}`}>{text}</p>
    </div>
  );
}
