'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import type { UserRole } from '@/types/database';

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHENTICATED') return 'Tizimga kirilmagan';
    if (error.message === 'FORBIDDEN') return 'Faqat owner uchun ruxsat berilgan';
    return error.message;
  }
  return 'Noma\'lum xato';
}

// ---------------------------------------------------------------------
// Maktablar
// ---------------------------------------------------------------------

export async function getSchools(): Promise<
  ActionResult<Array<{ id: string; name: string; address: string | null; is_active: boolean }>>
> {
  try {
    await requireRole('owner');
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, address, is_active')
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

export async function createSchool(
  name: string,
  address?: string,
  phone?: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole('owner');
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('schools')
      .insert({
        name,
        address: address ?? null,
        phone: phone ?? null,
        owner_id: session.profileId,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: { id: data.id } };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

export async function updateSchool(
  schoolId: string,
  updates: { name?: string; address?: string; phone?: string; is_active?: boolean }
): Promise<ActionResult<null>> {
  try {
    await requireRole('owner');
    const supabase = createServiceClient();
    const { error } = await supabase.from('schools').update(updates).eq('id', schoolId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

export async function deleteSchool(schoolId: string): Promise<ActionResult<null>> {
  try {
    await requireRole('owner');
    const supabase = createServiceClient();
    // Qattiq o'chirish o'rniga faollikni o'chiramiz — tarixiy ma'lumotlar saqlanadi
    const { error } = await supabase
      .from('schools')
      .update({ is_active: false })
      .eq('id', schoolId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

// ---------------------------------------------------------------------
// Foydalanuvchilar / rollar
// ---------------------------------------------------------------------

export async function getUsers(schoolId?: string): Promise<
  ActionResult<
    Array<{
      id: string;
      full_name: string;
      username: string | null;
      role: UserRole;
      school_id: string | null;
      telegram_id: number;
    }>
  >
> {
  try {
    await requireRole('owner');
    const supabase = createServiceClient();

    let query = supabase
      .from('profiles')
      .select('id, full_name, username, role, school_id, telegram_id')
      .order('created_at', { ascending: false });

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

export async function updateUserRole(
  profileId: string,
  role: UserRole,
  schoolId: string | null
): Promise<ActionResult<null>> {
  try {
    await requireRole('owner');
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('profiles')
      .update({ role, school_id: schoolId })
      .eq('id', profileId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

export async function deactivateUser(profileId: string): Promise<ActionResult<null>> {
  try {
    await requireRole('owner');
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', profileId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

// ---------------------------------------------------------------------
// Guruhlar (sinflar)
// ---------------------------------------------------------------------

export async function getGroupsForSchool(schoolId: string): Promise<
  ActionResult<Array<{ id: string; name: string; teacher_id: string | null }>>
> {
  try {
    await requireRole('owner');
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, teacher_id')
      .eq('school_id', schoolId)
      .order('name');

    if (error) return { success: false, error: error.message };
    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

export async function createGroup(
  schoolId: string,
  name: string,
  teacherId?: string
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole('owner');
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('groups')
      .insert({ school_id: schoolId, name, teacher_id: teacherId ?? null })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: { id: data.id } };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

export async function updateGroup(
  groupId: string,
  updates: { name?: string; teacher_id?: string | null; is_active?: boolean }
): Promise<ActionResult<null>> {
  try {
    await requireRole('owner');
    const supabase = createServiceClient();
    const { error } = await supabase.from('groups').update(updates).eq('id', groupId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

export async function deleteGroup(groupId: string): Promise<ActionResult<null>> {
  try {
    await requireRole('owner');
    const supabase = createServiceClient();
    const { error } = await supabase.from('groups').update({ is_active: false }).eq('id', groupId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

// ---------------------------------------------------------------------
// O'quvchilar
// ---------------------------------------------------------------------

export async function getStudentsForSchool(schoolId: string): Promise<
  ActionResult<
    Array<{
      id: string;
      full_name: string;
      phone: string | null;
      group_id: string | null;
      is_active: boolean;
    }>
  >
> {
  try {
    await requireRole('owner');
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, phone, group_id, is_active')
      .eq('school_id', schoolId)
      .order('full_name');

    if (error) return { success: false, error: error.message };
    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

export async function createStudent(
  schoolId: string,
  fullName: string,
  groupId?: string,
  phone?: string
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole('owner');
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('students')
      .insert({
        school_id: schoolId,
        full_name: fullName,
        group_id: groupId || null,
        phone: phone || null,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: { id: data.id } };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

export async function updateStudent(
  studentId: string,
  updates: { full_name?: string; phone?: string | null; group_id?: string | null; is_active?: boolean }
): Promise<ActionResult<null>> {
  try {
    await requireRole('owner');
    const supabase = createServiceClient();
    const { error } = await supabase.from('students').update(updates).eq('id', studentId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}

export async function deleteStudent(studentId: string): Promise<ActionResult<null>> {
  try {
    await requireRole('owner');
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('students')
      .update({ is_active: false })
      .eq('id', studentId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: toMessage(error) };
  }
}
