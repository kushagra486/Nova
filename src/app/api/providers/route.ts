import { NextResponse } from "next/server";
import { providers } from "@/lib/nova/providers/registry";
import { getReliability } from "@/lib/nova/providers/health-tracker";
import type { ProviderHealth } from "@/lib/nova/types";

export async function GET() {
  const health: ProviderHealth[] = await Promise.all(
    providers.map(async (p) => {
      const configured = p.isConfigured();
      const start = Date.now();
      const online = configured ? await p.healthCheck() : false;
      return {
        id: p.id,
        name: p.name,
        online,
        configured,
        latencyMs: configured ? Date.now() - start : null,
        reliability: getReliability(p.id),
      };
    })
  );

  return NextResponse.json({ providers: health });
}
