import { NextResponse } from "next/server";
import { runNovaPipeline } from "@/lib/nova/pipeline";
import type { TaskRequest } from "@/lib/nova/types";

export async function POST(request: Request) {
  let body: TaskRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.task || typeof body.task !== "string" || body.task.trim().length === 0) {
    return NextResponse.json({ error: "`task` is required" }, { status: 400 });
  }

  const result = await runNovaPipeline(body);
  return NextResponse.json(result);
}
