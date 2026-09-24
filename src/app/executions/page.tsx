"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { GlassPanel } from "@/components/glass-panel";
import { Reveal } from "@/components/motion/reveal";

interface ExecutionRow {
  id: string;
  executor: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  success: boolean;
  created_at: string;
  providers: { name: string } | null;
  models: { name: string } | null;
  tasks: { task_type: string; complexity: number; privacy_level: string } | null;
}

export default function ExecutionsPage() {
  const reducedMotion = useReducedMotion();
  const [rows, setRows] = useState<ExecutionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/executions?limit=50")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((data) => setRows(data.executions))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10 font-mono">
      <Reveal>
        <header className="glass flex items-center justify-between rounded-2xl px-4 py-3">
          <h1 className="text-lg font-bold tracking-wide">Execution History</h1>
          <Link href="/dashboard" className="text-xs text-zinc-500 transition-colors hover:text-zinc-300">
            ← Back to dashboard
          </Link>
        </header>
      </Reveal>

      {error && (
        <div className="glass rounded-2xl border-red-900/50 p-3 text-sm text-red-300">{error}</div>
      )}

      {!error && rows === null && <p className="text-sm text-zinc-500">Loading…</p>}
      {!error && rows?.length === 0 && (
        <GlassPanel>
          <p className="text-sm text-zinc-500">No persisted executions yet — run a task on the dashboard.</p>
        </GlassPanel>
      )}

      {rows && rows.length > 0 && (
        <Reveal delay={0.05}>
          <div className="glass overflow-x-auto rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Task Type</th>
                  <th className="px-3 py-2">Executor</th>
                  <th className="px-3 py-2">Provider/Model</th>
                  <th className="px-3 py-2">Privacy</th>
                  <th className="px-3 py-2">Latency</th>
                  <th className="px-3 py-2">Tokens</th>
                  <th className="px-3 py-2">Success</th>
                  <th className="px-3 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <motion.tr
                    key={row.id}
                    initial={reducedMotion ? undefined : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reducedMotion ? 0 : Math.min(i * 0.03, 0.6), duration: 0.25 }}
                    className="border-b border-white/5 text-zinc-300 last:border-0"
                  >
                    <td className="px-3 py-2">{row.tasks?.task_type ?? "—"}</td>
                    <td className="px-3 py-2">{row.executor}</td>
                    <td className="px-3 py-2">
                      {row.providers ? `${row.providers.name}/${row.models?.name ?? "?"}` : "—"}
                    </td>
                    <td className="px-3 py-2">{row.tasks?.privacy_level ?? "—"}</td>
                    <td className="px-3 py-2">{row.latency_ms}ms</td>
                    <td className="px-3 py-2">{row.input_tokens + row.output_tokens}</td>
                    <td className={`px-3 py-2 ${row.success ? "text-emerald-400" : "text-red-400"}`}>
                      {row.success ? "✓" : "✗"}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{new Date(row.created_at).toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      )}
    </main>
  );
}
