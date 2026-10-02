import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

/**
 * Server Component / Server Action ichida cookie'larga bog'liq holda
 * ishlaydigan Supabase client (anon key, RLS qoidalariga bo'ysunadi).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component ichidan chaqirilganda cookie yozib bo'lmaydi —
            // bu middleware/Server Action orqali sessiya yangilanganda muammo emas.
          }
        },
      },
    }
  );
}

/**
 * SERVICE ROLE client — RLS'ni chetlab o'tadi.
 *
 * Faqat Server Action'lar ichida ishlatiladi. Telegram initData orqali
 * autentifikatsiya qilingani uchun Supabase Auth mavjud emas, shu sababli
 * barcha yozish/o'qish amallari shu client orqali bajariladi va ruxsatlar
 * Server Action darajasida (session cookie'dagi rol asosida) tekshiriladi.
 *
 * DIQQAT: bu faylni hech qachon Client Component'ga import qilmang —
 * SUPABASE_SERVICE_ROLE_KEY faqat serverda mavjud bo'lishi shart.
 */
export function createServiceClient() {
  return createSupabaseJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
