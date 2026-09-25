"use client";

import { Eye, ShieldCheck, Cpu, GitBranch, Zap, CheckCircle2, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { TraceStep } from "@/lib/nova/types";

interface Stage {
  key: string;
  label: string;
  icon: LucideIcon;
  altKeys?: string[];
}

const STAGES: Stage[] = [
  { key: "scout_classified", label: "Scout", icon: Eye },
  { key: "guardian_scan", label: "Guardian", icon: ShieldCheck },
  { key: "thinker_profile", label: "Thinker", icon: Cpu },
  { key: "router_decision", label: "Router", icon: GitBranch },
  { key: "execution", label: "Executor", icon: Zap, altKeys: ["pdf_extraction"] },
  { key: "verification", label: "Verifier", icon: CheckCircle2 },
];

interface PipelineFlowProps {
  trace: TraceStep[] | null;
  active: boolean;
}

/**
 * Live visualization of NOVA's own 6-stage pipeline, lit up from the real
 * trace of the most recent (or in-flight) request — not decorative, an
 * actual readout of which stage the request is/was in.
 */
export function PipelineFlow({ trace, active }: PipelineFlowProps) {
  const reducedMotion = useReducedMotion();
  const stepNames = new Set((trace ?? []).map((s) => s.step));

  return (
    <div className="flex items-center justify-between gap-1">
      {STAGES.map((stage, i) => {
        const reached = stepNames.has(stage.key) || (stage.altKeys?.some((k) => stepNames.has(k)) ?? false);
        const Icon = stage.icon;
        return (
          <div key={stage.key} className="flex flex-1 items-center">
            <div className="flex flex-1 flex-col items-center gap-1.5">
              <motion.div
                animate={
                  reducedMotion
                    ? undefined
                    : { scale: reached ? [1, 1.15, 1] : 1, opacity: reached ? 1 : active ? 0.35 : 0.5 }
                }
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                  reached
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                    : "border-white/10 bg-white/[0.03] text-zinc-600"
                }`}
              >
                <Icon className="h-4 w-4" />
              </motion.div>
              <span className={`text-[10px] uppercase tracking-wide ${reached ? "text-emerald-400" : "text-zinc-600"}`}>
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`mx-0.5 mb-4 h-px w-full flex-1 ${reached ? "bg-emerald-500/30" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
