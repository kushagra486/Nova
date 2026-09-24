# NØVA

**Autonomous AI Optimization Agent**
*Think Less. Do More.*

NØVA is a serverless agent that sits between a user request and available
compute, and decides the **minimum sufficient intelligence** needed to
answer it — deterministic computation, a lightweight model, or a full
reasoning model — while enforcing a privacy policy on what ever leaves the
process.

```
USER → SCOUT → GUARDIAN → THINKER → ROUTER → EXECUTE → VERIFY → RESPOND
```

- **Scout** — classifies the task (calculation, extraction, coding,
  reasoning, summarization, classification, general query).
- **Guardian** — detects PII/secrets and classifies privacy risk
  (P0 public → P3 highly sensitive). P3 requests are blocked from external
  transmission by default.
- **Thinker** — turns the classification + stated requirements into a task
  profile (reasoning, privacy, accuracy, latency).
- **Router** — picks the cheapest capable execution path: deterministic
  tools first, then an AI provider/model, subject to Guardian's hard
  privacy constraint.
- **Executor** — runs it: a hand-written arithmetic evaluator, a regex
  extractor, or a call to NVIDIA NIM / DeepSeek.
- **Verifier** — sanity-checks the output before it's returned.

Every request returns a full execution trace explaining why that path was
chosen.

## Stack

- Next.js (App Router) + TypeScript + Tailwind — frontend & API routes
- Provider-independent AI abstraction (`lib/nova/providers`) — NVIDIA NIM
  as primary, DeepSeek as fallback
- Supabase/Postgres + pgvector schema (`supabase/migrations`) for tasks,
  routing decisions, executions, verification results and privacy events

## Getting started

```bash
npm install
cp .env.example .env.local   # add NVIDIA_API_KEY / DEEPSEEK_API_KEY to test AI routing
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Try:

- `92837 * 728` → solved deterministically, zero AI calls.
- `Extract all email addresses from: jane@acme.com, support@nova.dev` →
  regex extractor, zero AI calls.
- `Analyze these research papers and identify contradictory conclusions.` →
  routed to an AI provider (requires an API key to actually execute).
- `My password: hunter2` → blocked by Guardian before any provider is
  called.

## API

- `POST /api/task` — `{ task, privacy?, accuracy?, latency? }` → runs the
  full pipeline and returns the routing decision, output, verification
  result and trace.
- `GET /api/providers` — configured/health status of each AI provider.

## Project structure

```
app/                 Next.js routes + dashboard UI
lib/nova/
  scout.ts           task classification
  guardian.ts         PII detection + privacy classification
  thinker.ts          task profile scoring
  router.ts           execution-path selection
  verifier.ts          output verification
  pipeline.ts          orchestrates the full agent loop
  executors/           deterministic (Level 0) execution
  providers/            provider-agnostic AI interface + NVIDIA/DeepSeek adapters
supabase/migrations/   Postgres schema
```

## Notes on provider claims

NVIDIA's model catalog and DeepSeek's direct API terms can change; this
project does not assume permanently free or unlimited inference. NØVA's
value is in avoiding unnecessary AI calls in the first place — see the
"Computation Efficiency" panel on the dashboard for this session's actual
AI-calls-avoided rate.
