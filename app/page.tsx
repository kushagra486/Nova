"use client";

import { useEffect, useState } from "react";
import type { NovaResponse } from "@/lib/nova/types";

interface AggregateMetrics {
  sampleSize: number;
  aiCallsAvoidedPct: number;
  deterministicPct: number;
  successRatePct: number;
  tokensUsed: number;
  avgLatencyMs: number;
}

const EXAMPLES = [
  "92837 * 728",
  "Extract all email addresses from: contact jane@acme.com or support@nova.dev",
  "Analyze these research papers and identify contradictory conclusions.",
  "Analyze this confidential document. My password: hunter2, card 4111 1111 1111 1111",
];

interface SessionStats {
  totalTasks: number;
  aiCalls: number;
  deterministicTasks: number;
  tokensUsed: number;
}

export default function Home() {
  const [task, setTask] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NovaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SessionStats>({
    totalTasks: 0,
    aiCalls: 0,
    deterministicTasks: 0,
    tokensUsed: 0,
  });
  const [aggregate, setAggregate] = useState<AggregateMetrics | null>(null);
  const [aggregateVersion, setAggregateVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/metrics")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setAggregate(data);
      })
      .catch(() => {
        // Best-effort; the dashboard works fine on session stats alone.
      });
    return () => {
      cancelled = true;
    };
  }, [aggregateVersion]);

  async function execute() {
    if (!task.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data: NovaResponse = await res.json();
      setResult(data);
      setStats((s) => ({
        totalTasks: s.totalTasks + 1,
        aiCalls: s.aiCalls + data.aiCallsUsed,
        deterministicTasks: s.deterministicTasks + (data.selectedExecutor === "deterministic" ? 1 : 0),
        tokensUsed: s.tokensUsed + data.tokensUsed,
      }));
      if (data.taskId) setAggregateVersion((v) => v + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const aiAvoidedPct =
    stats.totalTasks > 0 ? Math.round(((stats.totalTasks - stats.aiCalls) / stats.totalTasks) * 100) : 0;
  const deterministicPct =
    stats.totalTasks > 0 ? Math.round((stats.deterministicTasks / stats.totalTasks) * 100) : 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 font-mono">
      <header className="flex items-center justify-between border border-zinc-800 rounded-lg px-4 py-3">
        <div>
          <h1 className="text-xl font-bold tracking-wide">NØVA</h1>
          <p className="text-xs text-zinc-500">Autonomous AI Optimization Agent — Think Less. Do More.</p>
        </div>
        <span className="flex items-center gap-2 text-xs text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> SYSTEM LIVE
        </span>
      </header>

      <section className="border border-zinc-800 rounded-lg p-4">
        <label className="text-sm text-zinc-400">What should I handle?</label>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) execute();
          }}
          rows={3}
          placeholder="e.g. 92837 * 728, or: analyze this confidential financial document..."
          className="mt-2 w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-zinc-600"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setTask(ex)}
              className="rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
            >
              {ex.length > 40 ? ex.slice(0, 40) + "…" : ex}
            </button>
          ))}
        </div>
        <button
          onClick={execute}
          disabled={loading || !task.trim()}
          className="mt-4 w-full rounded-md bg-zinc-100 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "EXECUTING..." : "EXECUTE"}
        </button>
      </section>

      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>
      )}

      {result && (
        <>
          <section className="border border-zinc-800 rounded-lg p-4">
            <h2 className="mb-3 text-xs uppercase tracking-widest text-zinc-500">Live Intelligence</h2>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-zinc-500">Task Type</dt>
              <dd>{result.taskType}</dd>
              <dt className="text-zinc-500">Task Complexity</dt>
              <dd>{Math.round(result.complexity * 100)}%</dd>
              <dt className="text-zinc-500">Privacy Class</dt>
              <dd className={result.privacyClass === "P3" ? "text-red-400" : result.privacyClass === "P0" ? "text-emerald-400" : "text-amber-400"}>
                {result.privacyClass}
              </dd>
              <dt className="text-zinc-500">Selected Executor</dt>
              <dd>{result.selectedExecutor} / {result.executorName}</dd>
              <dt className="text-zinc-500">Provider</dt>
              <dd>{result.provider ?? "—"}</dd>
              <dt className="text-zinc-500">Model</dt>
              <dd>{result.model ?? "—"}</dd>
              <dt className="text-zinc-500">Verification</dt>
              <dd className={result.verified ? "text-emerald-400" : "text-red-400"}>
                {result.verified ? "PASSED" : "FAILED"}
              </dd>
              <dt className="text-zinc-500">Latency</dt>
              <dd>{result.latencyMs}ms</dd>
            </dl>
          </section>

          <section className="border border-zinc-800 rounded-lg p-4">
            <h2 className="mb-2 text-xs uppercase tracking-widest text-zinc-500">Result</h2>
            <pre className="whitespace-pre-wrap break-words text-sm text-zinc-200">{result.output}</pre>
          </section>

          <section className="border border-zinc-800 rounded-lg p-4">
            <h2 className="mb-2 text-xs uppercase tracking-widest text-zinc-500">Execution Trace</h2>
            <ol className="space-y-1 text-xs text-zinc-400">
              {result.trace.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-zinc-600">[{String(i + 1).padStart(2, "0")}]</span>
                  <span className="text-zinc-500">+{step.timestampMs}ms</span>
                  <span className="text-zinc-300">{step.step}</span>
                  <span className="text-zinc-600">— {step.detail}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      <section className="border border-zinc-800 rounded-lg p-4">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-zinc-500">Computation Efficiency (this session)</h2>
        <dl className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <dd className="text-2xl font-bold text-emerald-400">{aiAvoidedPct}%</dd>
            <dt className="text-xs text-zinc-500">AI Calls Avoided</dt>
          </div>
          <div>
            <dd className="text-2xl font-bold">{deterministicPct}%</dd>
            <dt className="text-xs text-zinc-500">Deterministic Tasks</dt>
          </div>
          <div>
            <dd className="text-2xl font-bold">{stats.tokensUsed}</dd>
            <dt className="text-xs text-zinc-500">Tokens Used</dt>
          </div>
        </dl>
      </section>

      {aggregate && (
        <section className="border border-zinc-800 rounded-lg p-4">
          <h2 className="mb-3 text-xs uppercase tracking-widest text-zinc-500">
            Computation Efficiency (all-time, last {aggregate.sampleSize} tasks — persisted in Supabase)
          </h2>
          <dl className="grid grid-cols-4 gap-4 text-center text-sm">
            <div>
              <dd className="text-2xl font-bold text-emerald-400">{aggregate.aiCallsAvoidedPct}%</dd>
              <dt className="text-xs text-zinc-500">AI Calls Avoided</dt>
            </div>
            <div>
              <dd className="text-2xl font-bold">{aggregate.deterministicPct}%</dd>
              <dt className="text-xs text-zinc-500">Deterministic Tasks</dt>
            </div>
            <div>
              <dd className="text-2xl font-bold">{aggregate.successRatePct}%</dd>
              <dt className="text-xs text-zinc-500">Success Rate</dt>
            </div>
            <div>
              <dd className="text-2xl font-bold">{aggregate.avgLatencyMs}ms</dd>
              <dt className="text-xs text-zinc-500">Avg Latency</dt>
            </div>
          </dl>
        </section>
      )}
    </main>
  );
}
