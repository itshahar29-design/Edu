import { NextRequest, NextResponse } from 'next/server';
import { verifySignedPayload } from '@/lib/auth/crypto';

export const config = {
  matcher: ['/owner/:path*'],
};

// Edge runtime cheklovi: bu yerda `next/headers`dan foydalanib bo'lmaydi.
// Cookie'lar to'g'ridan-to'g'ri NextRequest orqali o'qiladi.
export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('edumemory_session')?.value;

  if (!sessionCookie) {
    return redirectToHome(request, 'no_session');
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return redirectToHome(request, 'server_misconfigured');
  }

  const payloadJson = await verifySignedPayload(sessionCookie, secret);
  if (!payloadJson) {
    return redirectToHome(request, 'invalid_session');
  }

  let role: string | undefined;
  try {
    const payload = JSON.parse(payloadJson) as { role?: string };
    role = payload.role;
  } catch {
    return redirectToHome(request, 'corrupt_session');
  }

  if (role !== 'owner') {
    return redirectToHome(request, 'forbidden');
  }

  return NextResponse.next();
}

function redirectToHome(request: NextRequest, reason: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/';
  url.searchParams.set('deny_reason', reason);
  return NextResponse.redirect(url);
}
