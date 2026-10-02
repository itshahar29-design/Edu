'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { getSession, requireRole, type SessionPayload } from '@/lib/auth/session';
import type { AttendanceStatus, UserRole } from '@/types/database';

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface IdentifyResult {
  success: boolean;
  profile?: {
    id: string;
    telegram_id: number;
    full_name: string;
    role: UserRole;
    school_id: string | null;
  };
  error?: string;
}

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHENTICATED') return 'Tizimga kirilmagan';
    if (error.message === 'FORBIDDEN') return 'Bu ma\'lumotga ruxsatingiz yo\'q';
    return error.message;
  }
  return 'Noma\'lum xato';
}

/**
 * Berilgan guruhga joriy sessiya ruxsati bor-yo'qligini tekshiradi.
 * Barcha o'qish/yozish action'lari shu orqali guruh darajasida cheklanadi:
 *   - owner: har doim ruxsat
 *   - admin: faqat o'z maktabidagi guruhlar
 *   - teacher: faqat o'ziga biriktirilgan guruhlar
 *   - parent: faqat farzandi bor guruhlar
 *   - student: faqat o'zi a'zo bo'lgan guruh (full_name orqali moslashtirilgan)
 */
async function assertGroupAccess(
  session: SessionPayload,
  supabase: ReturnType<typeof createServiceClient>,
  groupId: string
): Promise<{ ok: boolean; error?: string }> {
  if (session.role === 'owner') return { ok: true };

  if (session.role === 'admin') {
    if (!session.schoolId) return { ok: false, error: 'FORBIDDEN' };
    const { data, error } = await supabase
      .from('groups')
      .select('id')
      .eq('id', groupId)
      .eq('school_id', session.schoolId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return data ? { ok: true } : { ok: false, error: 'FORBIDDEN' };
  }

  if (session.role === 'teacher') {
    const { data, error } = await supabase
      .from('groups')
      .select('id')
      .eq('id', groupId)
      .eq('teacher_id', session.profileId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return data ? { ok: true } : { ok: false, error: 'FORBIDDEN' };
  }

  if (session.role === 'parent') {
    const { data, error } = await supabase
      .from('students')
      .select('id')
      .eq('group_id', groupId)
      .eq('parent_id', session.profileId)
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return data ? { ok: true } : { ok: false, error: 'FORBIDDEN' };
  }

  // student — bevosita profiles->students bog'lanishi yo'qligi sababli
  // ism + maktab bo'yicha moslashtiramiz (bilinadigan cheklov, quyidagi
  // izohga qarang).
  const { data, error } = await supabase
    .from('students')
    .select('id')
    .eq('group_id', groupId)
    .eq('full_name', session.fullName)
    .eq('school_id', session.schoolId ?? '')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return data ? { ok: true } : { ok: false, error: 'FORBIDDEN' };
}

/**
 * Telegram foydalanuvchisini profiles jadvalida upsert qiladi.
 * Birinchi marta kirgan foydalanuvchi standart 'student' roli bilan yaratiladi;
 * rolni faqat owner/admin keyinchalik o'zgartiradi.
 */
export async function identifyTelegramUser(
  telegramId: number,
  fullName: string,
  username?: string,
  photoUrl?: string
): Promise<IdentifyResult> {
  try {
    const supabase = createServiceClient();

    const { data: existing, error: fetchError } = await supabase
      .from('profiles')
      .select('id, telegram_id, full_name, role, school_id')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          username: username ?? null,
          photo_url: photoUrl ?? null,
        })
        .eq('id', existing.id)
        .select('id, telegram_id, full_name, role, school_id')
        .single();

      if (updateError) return { success: false, error: updateError.message };
      return { success: true, profile: updated };
    }

    const { data: created, error: insertError } = await supabase
      .from('profiles')
      .insert({
        telegram_id: telegramId,
        full_name: fullName,
        username: username ?? null,
        photo_url: photoUrl ?? null,
        role: 'student',
      })
      .select('id, telegram_id, full_name, role, school_id')
      .single();

    if (insertError) return { success: false, error: insertError.message };
    return { success: true, profile: created };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Noma\'lum xato' };
  }
}

/**
 * Rolga qarab ko'rinadigan guruhlar ro'yxatini qaytaradi.
 */
export async function getGroups(): Promise<ActionResult<Array<{ id: string; name: string }>>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'UNAUTHENTICATED' };

    const supabase = createServiceClient();

    if (session.role === 'owner') {
      const { data, error } = await supabase.from('groups').select('id, name').order('name');
      if (error) return { success: false, error: error.message };
      return { success: true, data: data ?? [] };
    }

    if (session.role === 'admin') {
      if (!session.schoolId) return { success: true, data: [] };
      const { data, error } = await supabase
        .from('groups')
        .select('id, name')
        .eq('school_id', session.schoolId)
        .order('name');
      if (error) return { success: false, error: error.message };
      return { success: true, data: data ?? [] };
    }

    if (session.role === 'teacher') {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name')
        .eq('teacher_id', session.profileId)
        .order('name');
      if (error) return { success: false, error: error.message };
      return { success: true, data: data ?? [] };
    }

    if (session.role === 'parent') {
      const { data: children, error: childrenError } = await supabase
        .from('students')
        .select('group_id')
        .eq('parent_id', session.profileId);
      if (childrenError) return { success: false, error: childrenError.message };

      const childGroupIds: Array<string | null> = (children ?? []).map(
        (c: { group_id: string | null }) => c.group_id
      );
      const groupIds = Array.from(new Set<string | null>(childGroupIds)).filter(
        (id): id is string => Boolean(id)
      );
      if (groupIds.length === 0) return { success: true, data: [] };

      const { data, error } = await supabase.from('groups').select('id, name').in('id', groupIds);
      if (error) return { success: false, error: error.message };
      return { success: true, data: data ?? [] };
    }

    // student
    const { data: own, error: ownError } = await supabase
      .from('students')
      .select('group_id, groups(id, name)')
      .eq('full_name', session.fullName)
      .eq('school_id', session.schoolId ?? '')
      .maybeSingle();
    if (ownError) return { success: false, error: ownError.message };
    if (!own?.groups) return { success: true, data: [] };
    return { success: true, data: [own.groups as unknown as { id: string; name: string }] };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Noma\'lum xato' };
  }
}

/**
 * Berilgan guruhdagi o'quvchilar ro'yxati (guruh darajasidagi ruxsat
 * tekshiruvi barcha rollar uchun assertGroupAccess orqali amalga oshadi).
 */
export async function getStudents(
  groupId: string
): Promise<ActionResult<Array<{ id: string; full_name: string }>>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'UNAUTHENTICATED' };

    const supabase = createServiceClient();

    const access = await assertGroupAccess(session, supabase, groupId);
    if (!access.ok) return { success: false, error: access.error ?? 'FORBIDDEN' };

    const { data, error } = await supabase
      .from('students')
      .select('id, full_name')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('full_name');

    if (error) return { success: false, error: error.message };
    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

/**
 * Berilgan sana uchun mavjud davomat yozuvlarini qaytaradi
 * ({ [studentId]: status } ko'rinishida). Guruh darajasida ruxsat tekshiriladi.
 */
export async function getAttendanceForDate(
  groupId: string,
  date: string
): Promise<ActionResult<Record<string, AttendanceStatus>>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'UNAUTHENTICATED' };

    const supabase = createServiceClient();

    const access = await assertGroupAccess(session, supabase, groupId);
    if (!access.ok) return { success: false, error: access.error ?? 'FORBIDDEN' };

    const { data, error } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('group_id', groupId)
      .eq('date', date);

    if (error) return { success: false, error: error.message };

    const map: Record<string, AttendanceStatus> = {};
    (data ?? []).forEach((row: { student_id: string; status: AttendanceStatus }) => {
      map[row.student_id] = row.status;
    });
    return { success: true, data: map };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

/**
 * Guruh uchun davomat belgilangan sanalar ro'yxati (so'nggi 60 tasi).
 * Guruh darajasida ruxsat tekshiriladi.
 */
export async function getAvailableDates(groupId: string): Promise<ActionResult<string[]>> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'UNAUTHENTICATED' };

    const supabase = createServiceClient();

    const access = await assertGroupAccess(session, supabase, groupId);
    if (!access.ok) return { success: false, error: access.error ?? 'FORBIDDEN' };

    const { data, error } = await supabase
      .from('attendance')
      .select('date')
      .eq('group_id', groupId)
      .order('date', { ascending: false })
      .limit(500);

    if (error) return { success: false, error: error.message };

    const allDates: string[] = (data ?? []).map((row: { date: string }) => row.date);
    const uniqueDates: string[] = Array.from(new Set<string>(allDates)).slice(0, 60);
    return { success: true, data: uniqueDates };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

/**
 * Davomatni saqlaydi (upsert). Kelajakdagi sanaga yozishga ruxsat yo'q.
 * Guruh darajasidagi ruxsat owner/admin/teacher uchun bir xil
 * assertGroupAccess funksiyasi orqali tekshiriladi.
 */
export async function saveAttendance(
  groupId: string,
  date: string,
  records: Array<{ studentId: string; status: AttendanceStatus }>
): Promise<ActionResult<{ savedCount: number }>> {
  try {
    const session = await requireRole('owner', 'admin', 'teacher');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(`${date}T00:00:00`);
    if (targetDate.getTime() > today.getTime()) {
      return { success: false, error: 'Kelajakdagi sanaga davomat belgilab bo\'lmaydi' };
    }

    const supabase = createServiceClient();

    const access = await assertGroupAccess(session, supabase, groupId);
    if (!access.ok) {
      return { success: false, error: access.error === 'FORBIDDEN' ? 'Bu guruhga ruxsatingiz yo\'q' : access.error };
    }

    if (records.length === 0) {
      return { success: false, error: 'Belgilangan o\'quvchi yo\'q' };
    }

    const rows = records.map((record) => ({
      student_id: record.studentId,
      group_id: groupId,
      date,
      status: record.status,
      recorded_by: session.profileId,
    }));

    const { error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'student_id,date' });

    if (error) return { success: false, error: error.message };
    return { success: true, data: { savedCount: rows.length } };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}
