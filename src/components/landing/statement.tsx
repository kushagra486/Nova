"use client";

import { Reveal } from "@/components/motion/reveal";

export function Statement({ eyebrow, children }: { eyebrow: string; children: string }) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
      <Reveal trigger="scroll">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">{eyebrow}</p>
      </Reveal>
      <Reveal trigger="scroll" delay={0.08}>
        <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          {children}
        </h2>
      </Reveal>
    </section>
  );
}
