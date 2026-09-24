"use client";

import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PIPELINE = ["Scout", "Guardian", "Thinker", "Router", "Execute", "Verify"];

export function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[92vh] max-w-4xl flex-col items-center justify-center px-6 text-center">
      <Reveal>
        <span className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Adaptive Intelligence Routing
        </span>
      </Reveal>

      <Reveal delay={0.06}>
        <h1 className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-6xl font-bold tracking-tight text-transparent sm:text-8xl">
          NØVA
        </h1>
      </Reveal>

      <Reveal delay={0.14}>
        <p className="mt-4 text-xl font-medium text-zinc-300 sm:text-2xl">Think Less. Do More.</p>
      </Reveal>

      <Reveal delay={0.22}>
        <p className="mt-6 max-w-xl text-balance text-sm text-zinc-400 sm:text-base">
          NØVA decides the minimum sufficient intelligence for every request — deterministic tools, a
          lightweight model, or a full reasoning model — while enforcing a privacy policy on what ever
          leaves the process.
        </p>
      </Reveal>

      <Reveal delay={0.3}>
        <div className="mt-8 flex gap-3">
          <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }), "glass rounded-full px-6")}
          >
            Try the dashboard
          </Link>
        </div>
      </Reveal>

      <Reveal delay={0.4}>
        <div className="glass mt-14 flex flex-wrap items-center justify-center gap-2 rounded-full px-3 py-2">
          {PIPELINE.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-medium text-zinc-300">{step}</span>
              {i < PIPELINE.length - 1 && <span className="text-zinc-600">→</span>}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
