import { redirect } from "next/navigation";
import { createClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";
import { Hero } from "@/components/landing/hero";
import { Statement } from "@/components/landing/statement";

export default async function Home() {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <main className="flex-1 font-mono">
      <Hero />
      <Statement eyebrow="01 — The problem">
        Not every request needs a language model.
      </Statement>
      <Statement eyebrow="02 — The router">
        NØVA scores every deterministic tool and AI provider on capability, accuracy,
        privacy, latency and reliability — then routes to whichever actually wins.
      </Statement>
      <Statement eyebrow="03 — The guardrail">
        Privacy is a hard constraint, never just a score.
      </Statement>
    </main>
  );
}
