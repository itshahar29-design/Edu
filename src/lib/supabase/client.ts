import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Brauzer (Client Component) tomonida ishlatiladigan Supabase client.
 * Faqat NEXT_PUBLIC_* kalitlardan foydalanadi, RLS anon roli ostida ishlaydi.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
