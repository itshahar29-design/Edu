import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramInitData } from '@/lib/auth/crypto';
import { setSessionCookie } from '@/lib/auth/session';
import { identifyTelegramUser } from '@/lib/actions/attendance-actions';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { initData } = (await request.json()) as { initData?: string };

    if (!initData) {
      return NextResponse.json({ ok: false, error: 'initData yuborilmadi' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { ok: false, error: 'Server sozlanmagan: TELEGRAM_BOT_TOKEN yo\'q' },
        { status: 500 }
      );
    }

    const verification = await verifyTelegramInitData(initData, botToken);
    if (!verification.valid) {
      return NextResponse.json(
        { ok: false, error: verification.reason ?? 'initData yaroqsiz' },
        { status: 401 }
      );
    }

    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    if (!userJson) {
      return NextResponse.json({ ok: false, error: 'user maydoni topilmadi' }, { status: 400 });
    }

    const telegramUser = JSON.parse(userJson) as {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };

    const fullName = [telegramUser.first_name, telegramUser.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    const result = await identifyTelegramUser(
      telegramUser.id,
      fullName || 'Foydalanuvchi',
      telegramUser.username,
      telegramUser.photo_url
    );

    if (!result.success || !result.profile) {
      return NextResponse.json(
        { ok: false, error: result.error ?? 'Profil aniqlanmadi' },
        { status: 500 }
      );
    }

    await setSessionCookie({
      profileId: result.profile.id,
      telegramId: result.profile.telegram_id,
      role: result.profile.role,
      schoolId: result.profile.school_id,
      fullName: result.profile.full_name,
    });

    return NextResponse.json({ ok: true, profile: result.profile });
  } catch (error) {
    console.error('Telegram auth xatosi:', error);
    return NextResponse.json({ ok: false, error: 'Ichki server xatosi' }, { status: 500 });
  }
}
