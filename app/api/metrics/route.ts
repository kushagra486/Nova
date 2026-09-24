import { NextResponse } from "next/server";
import { getSupabaseServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

const SAMPLE_SIZE = 500;

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured; aggregate metrics are unavailable in this deployment." },
      { status: 503 }
    );
  }

  const supabase = getSupabaseServiceClient()!;

  const { data: executions, error } = await supabase
    .from("executions")
    .select("executor, provider_id, latency_ms, tokens_input, tokens_output, success")
    .order("created_at", { ascending: false })
    .limit(SAMPLE_SIZE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totalTasks = executions.length;
  const aiCalls = executions.filter((e) => e.provider_id !== null).length;
  const deterministicTasks = executions.filter((e) => e.executor.startsWith("deterministic")).length;
  const blockedTasks = executions.filter((e) => e.executor.startsWith("blocked")).length;
  const successfulTasks = executions.filter((e) => e.success).length;
  const tokensUsed = executions.reduce((sum, e) => sum + e.tokens_input + e.tokens_output, 0);
  const avgLatencyMs =
    totalTasks > 0 ? Math.round(executions.reduce((sum, e) => sum + e.latency_ms, 0) / totalTasks) : 0;

  return NextResponse.json({
    sampleSize: totalTasks,
    aiCallsAvoidedPct: totalTasks > 0 ? Math.round(((totalTasks - aiCalls) / totalTasks) * 100) : 0,
    deterministicPct: totalTasks > 0 ? Math.round((deterministicTasks / totalTasks) * 100) : 0,
    blockedPct: totalTasks > 0 ? Math.round((blockedTasks / totalTasks) * 100) : 0,
    successRatePct: totalTasks > 0 ? Math.round((successfulTasks / totalTasks) * 100) : 0,
    tokensUsed,
    avgLatencyMs,
  });
}
