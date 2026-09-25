import Link from "next/link";
import { Eye, ShieldCheck, Cpu, GitBranch, Zap, CheckCircle2, ArrowLeft } from "lucide-react";
import { GlassPanel } from "@/components/glass-panel";
import { Reveal } from "@/components/motion/reveal";

const PRIVACY_LEVELS = [
  {
    tag: "P0",
    label: "Public",
    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    desc: "No PII or secrets detected. Routed freely — to a deterministic tool, a specialized tool, or an AI provider — with no confirmation needed.",
  },
  {
    tag: "P1",
    label: "Low sensitivity",
    color: "border-sky-500/40 bg-sky-500/10 text-sky-400",
    desc: "Minor identifiers, like an email address or phone number. Deterministic tools still run freely; an AI-routed answer asks for your explicit approval first.",
  },
  {
    tag: "P2",
    label: "Elevated sensitivity",
    color: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    desc: "Financial or card-like numbers. Same as P1 — approval is required before this reaches an AI provider.",
  },
  {
    tag: "P3",
    label: "Highly sensitive",
    color: "border-red-500/40 bg-red-500/10 text-red-400",
    desc: "Passwords, API keys, credentials. Blocked from external transmission by default. You can still approve sending it anyway — NØVA never decides that for you — but detected values stay redacted with placeholders regardless of approval.",
  },
];

const STAGES = [
  { icon: Eye, name: "Scout", desc: "Classifies the task type — calculation, extraction, coding, reasoning, and so on — before anything else runs." },
  { icon: ShieldCheck, name: "Guardian", desc: "Scans for PII and secrets, assigns the P0–P3 privacy class above, and enforces (or asks about) the transmission rule." },
  { icon: Cpu, name: "Thinker", desc: "Turns the classification into a task profile: how much reasoning, privacy sensitivity, accuracy, and latency this request needs." },
  { icon: GitBranch, name: "Router", desc: "Scores every configured AI provider/model on the NØVA score, or picks a deterministic/specialized tool when one exists — whichever is the minimum sufficient intelligence." },
  { icon: Zap, name: "Executor", desc: "Actually runs it: a calculator, a regex extractor, a web search, a code sandbox, a PDF text extractor, or a real AI provider call." },
  { icon: CheckCircle2, name: "Verifier", desc: "Sanity-checks the output. A failed AI response escalates once to a stronger model before giving up." },
];

const EXECUTION_TIERS = [
  {
    level: "Level 0 — Deterministic",
    zeroAI: true,
    items: ["Arithmetic evaluator", "Regex extractor"],
    desc: "Nothing ever leaves the process. No privacy class can block these — there's nothing to transmit.",
  },
  {
    level: "Level 2 — Specialized",
    zeroAI: true,
    items: ["Web search (Brave)", "Code sandbox", "PDF text extraction"],
    desc: "Real tools, no LLM involved. PDF extraction runs fully locally; web search and the code sandbox do send content to their respective third-party services, so Guardian's block still applies to them.",
  },
  {
    level: "Level 3 — AI-Routed",
    zeroAI: false,
    items: ["NVIDIA NIM (z-ai/glm-5.3, nemotron, deepseek-v4.1-flash)"],
    desc: "Only reached when nothing above can answer the task. This is the tier Guardian's approval flow gates for P1–P3 content.",
  },
];

export default function GuidePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 font-mono">
      <Reveal>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>
      </Reveal>

      <Reveal delay={0.05}>
        <div>
          <h1 className="text-2xl font-bold tracking-wide">Privacy & Security Guide</h1>
          <p className="mt-1 text-sm text-zinc-500">
            What NØVA actually does with your request, in plain terms — every classification, every routing decision.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <GlassPanel>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-zinc-500">Privacy classes</h2>
          <div className="flex flex-col gap-3">
            {PRIVACY_LEVELS.map((level) => (
              <div key={level.tag} className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <span className={`h-fit shrink-0 rounded-md border px-2 py-1 text-xs font-bold ${level.color}`}>
                  {level.tag}
                </span>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">{level.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{level.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </Reveal>

      <Reveal delay={0.15}>
        <GlassPanel>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-zinc-500">The pipeline</h2>
          <div className="flex flex-col gap-3">
            {STAGES.map((stage, i) => (
              <div key={stage.name} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <stage.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">
                    {i + 1}. {stage.name}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{stage.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </Reveal>

      <Reveal delay={0.2}>
        <GlassPanel>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-zinc-500">What&apos;s zero-AI vs. AI-routed</h2>
          <div className="flex flex-col gap-3">
            {EXECUTION_TIERS.map((tier) => (
              <div key={tier.level} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-200">{tier.level}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      tier.zeroAI ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {tier.zeroAI ? "Zero AI" : "Uses AI"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">{tier.items.join(" · ")}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{tier.desc}</p>
              </div>
            ))}
          </div>
        </GlassPanel>
      </Reveal>

      <Reveal delay={0.25}>
        <GlassPanel>
          <h2 className="mb-2 text-xs uppercase tracking-widest text-zinc-500">On approving a flagged request</h2>
          <p className="text-xs leading-relaxed text-zinc-500">
            When Guardian flags a request P1 or higher and you choose to send it to an AI provider anyway, NØVA still
            redacts the specific values it detected — an email becomes <code className="text-zinc-300">[EMAIL]</code>,
            a password becomes <code className="text-zinc-300">[CREDENTIAL]</code> — before anything leaves the
            process. Your approval changes whether the request is routed at all; it does not disable redaction. This
            is a deliberate design choice: you stay in control of the decision, and the raw sensitive value stays out
            of the request either way.
          </p>
        </GlassPanel>
      </Reveal>

      <Reveal delay={0.3}>
        <GlassPanel>
          <h2 className="mb-2 text-xs uppercase tracking-widest text-zinc-500">Chat history</h2>
          <p className="text-xs leading-relaxed text-zinc-500">
            Your recent prompts and results are saved in this browser&apos;s local storage only — they are never sent
            to or stored on NØVA&apos;s servers. This matches how the rest of the app treats your input: the backend
            only ever persists a one-way hash of a task, never the raw text. History stays on this device, is capped
            at the 50 most recent entries, and clearing it (or your browser storage) removes it for good.
          </p>
        </GlassPanel>
      </Reveal>
    </main>
  );
}
