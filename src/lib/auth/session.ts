import 'server-only';
import { cookies } from 'next/headers';
import type { UserRole } from '@/types/database';
import { signPayload, verifySignedPayload } from './crypto';

export const SESSION_COOKIE_NAME = 'edumemory_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 kun

export interface SessionPayload {
  profileId: string;
  telegramId: number;
  role: UserRole;
  schoolId: string | null;
  fullName: string;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET .env faylida sozlanmagan');
  }
  return secret;
}

/**
 * Berilgan payload uchun imzolangan sessiya qiymatini yaratadi.
 * (cookie'ni faktik o'rnatish Route Handler / Server Action ichida bo'ladi.)
 */
export async function createSessionValue(payload: SessionPayload): Promise<string> {
  return signPayload(JSON.stringify(payload), getSessionSecret());
}

/**
 * Joriy so'rov cookie'laridan sessiyani o'qiydi va tekshiradi.
 * Server Component, Server Action va Route Handler'larda ishlatiladi.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const payloadJson = await verifySignedPayload(raw, getSessionSecret());
  if (!payloadJson) return null;

  try {
    return JSON.parse(payloadJson) as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Sessiya cookie'sini o'rnatadi. Faqat Server Action yoki Route Handler
 * ichida chaqirilishi mumkin (cookie yozish huquqi bor joyda).
 */
export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const value = await createSessionValue(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'none', // Telegram WebView ichida ishlashi uchun
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Berilgan rollardan biriga ega bo'lishini talab qiladi.
 * Mos kelmasa xatolik tashlaydi — Server Action'lar shuni catch qiladi.
 */
export async function requireRole(...roles: UserRole[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHENTICATED');
  }
  if (roles.length > 0 && !roles.includes(session.role)) {
    throw new Error('FORBIDDEN');
  }
  return session;
}
