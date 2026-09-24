import { NextResponse } from "next/server";
import { getSupabaseServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET(_request: Request, ctx: RouteContext<"/api/executions/[id]">) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured; execution history is unavailable in this deployment." },
      { status: 503 }
    );
  }

  const { id } = await ctx.params;
  const supabase = getSupabaseServiceClient()!;

  const { data: execution, error } = await supabase
    .from("executions")
    .select(
      "id, task_id, provider_id, model_id, executor, latency_ms, tokens_input, tokens_output, success, created_at, tasks(*), verification_results(*)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!execution) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  const [{ data: routingDecisions }, { data: privacyEvents }] = await Promise.all([
    supabase.from("routing_decisions").select("*").eq("task_id", execution.task_id),
    supabase.from("privacy_events").select("*").eq("task_id", execution.task_id),
  ]);

  return NextResponse.json({ execution, routingDecisions, privacyEvents });
}
