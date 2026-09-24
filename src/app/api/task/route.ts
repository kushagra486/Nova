import { NextResponse } from "next/server";
import { novaOrchestrator } from "@/lib/nova/orchestrator";
import { TaskSchema } from "@/lib/nova/schema";
import { isRateLimited } from "@/lib/nova/rate-limit";
import { createClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const clientKey =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "anonymous";

  if (isRateLimited(clientKey)) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = TaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  let userId: string | null = null;
  if (isSupabaseAuthConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  const result = await novaOrchestrator(parsed.data, userId);
  return NextResponse.json(result);
}
