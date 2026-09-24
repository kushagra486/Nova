import { createBrowserClient } from "@supabase/ssr";

/** NEXT_PUBLIC_* vars are inlined at build time, so this is safe to check client-side. */
export function isSupabaseAuthConfiguredClient(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

/**
 * Browser-side Supabase client using the publishable (anon) key. Safe to
 * import from client components — this key is meant to be public and RLS
 * is what actually restricts access.
 *
 * Returns null instead of throwing when unconfigured: @supabase/ssr's
 * createBrowserClient throws synchronously without a URL/key, which would
 * otherwise crash any component that constructs one on mount.
 */
export function createClient() {
  if (!isSupabaseAuthConfiguredClient()) return null;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
