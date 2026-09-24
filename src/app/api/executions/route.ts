import { NextResponse } from "next/server";
import { getSupabaseServiceClient, isSupabaseConfigured } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured; execution history is unavailable in this deployment." },
      { status: 503 }
    );
  }

  const supabase = getSupabaseServiceClient()!;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  const { data, error } = await supabase
    .from("executions")
    .select(
      "id, task_id, executor, latency_ms, input_tokens, output_tokens, success, created_at, providers(name), models(name), tasks(task_type, complexity, privacy_level)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ executions: data });
}
