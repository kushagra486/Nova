import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { createClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";

export default async function Home() {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center font-mono">
      <div>
        <h1 className="text-4xl font-bold tracking-wide">NØVA</h1>
        <p className="mt-2 text-sm text-zinc-500">Autonomous AI Optimization Agent — Think Less. Do More.</p>
      </div>
      <p className="max-w-md text-sm text-zinc-400">
        NØVA decides the minimum sufficient intelligence for every request — deterministic tools,
        a lightweight model, or a full reasoning model — while enforcing a privacy policy on what leaves the process.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className={buttonVariants()}>
          Sign in
        </Link>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Try the dashboard
        </Link>
      </div>
    </main>
  );
}
