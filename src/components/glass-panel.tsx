import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function GlassPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("glass rounded-2xl p-4", className)}>{children}</section>;
}
