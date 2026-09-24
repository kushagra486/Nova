import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side (SSR) Supabase client bound to the current request's session
 * cookies, used in Server Components and Route Handlers to read the
 * authenticated user. This respects RLS as that user — for privileged,
 * cross-user writes (e.g. persisting an execution regardless of who owns
 * it) use lib/supabase/admin.ts instead.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — the middleware refreshes
            // the session instead, so this can be safely ignored.
          }
        },
      },
    }
  );
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
