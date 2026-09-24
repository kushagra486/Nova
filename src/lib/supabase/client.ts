import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client using the publishable (anon) key. Safe to
 * import from client components — this key is meant to be public and RLS
 * is what actually restricts access.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
