"use client";

import { Suspense, useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { Reveal } from "@/components/motion/reveal";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [anonLoading, setAnonLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const emailId = useId();
  const passwordId = useId();

  async function continueAnonymously() {
    setAnonLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase Auth is not configured in this deployment.");
      setAnonLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setError(error.message);
      setAnonLoading(false);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase Auth is not configured in this deployment.");
      setLoading(false);
      return;
    }

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setMessage("Check your email to confirm your account, then sign in.");
      setMode("sign-in");
    }

    setLoading(false);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 font-mono">
      <Reveal className="w-full max-w-sm">
        <Card className="glass border-0">
          <CardHeader>
            <CardTitle>{mode === "sign-in" ? "Sign in to NØVA" : "Create an account"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={emailId} className="text-xs text-zinc-400">
                  Email
                </label>
                <Input
                  id={emailId}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={passwordId} className="text-xs text-zinc-400">
                  Password
                </label>
                <Input
                  id={passwordId}
                  type="password"
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              {message && <p className="text-sm text-emerald-400">{message}</p>}
              <Button type="submit" disabled={loading} className="mt-1">
                {loading ? "Working…" : mode === "sign-in" ? "Sign in" : "Sign up"}
              </Button>
              <button
                type="button"
                className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                onClick={() => {
                  setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                  setError(null);
                  setMessage(null);
                }}
              >
                {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </form>

            <div className="mt-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] uppercase tracking-widest text-zinc-600">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={anonLoading}
              onClick={continueAnonymously}
              className="mt-4 w-full"
            >
              {anonLoading ? "Working…" : "Continue anonymously"}
            </Button>
            <p className="mt-2 text-center text-[11px] text-zinc-600">
              No email, no confirmation — jumps straight into the dashboard with a temporary account.
            </p>
          </CardContent>
        </Card>
      </Reveal>
    </main>
  );
}
