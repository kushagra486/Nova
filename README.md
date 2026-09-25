# NØVA

**Autonomous AI Optimization Agent**
*Think Less. Do More.*

NØVA is a serverless agent that sits between a user request and available
compute, and decides the **minimum sufficient intelligence** needed to
answer it — deterministic computation, a lightweight model, or a full
reasoning model — while enforcing a privacy policy on whatever leaves the
process.

```
USER → GATEWAY (auth + Zod validation + rate limit) → SCOUT → GUARDIAN
     → THINKER → ROUTER → EXECUTE → VERIFY → RESPOND
```

- **Gateway** (`app/api/task`) — authenticates the request (Supabase Auth,
  optional), validates it with Zod, and rate-limits by client before
  anything reaches the pipeline.
- **Scout** — classifies the task (calculation, extraction, coding,
  reasoning, summarization, classification, general query).
- **Guardian** — detects PII/secrets and classifies privacy risk
  (P0 public → P3 highly sensitive). P3 requests are blocked from external
  transmission by default.
- **Thinker** — turns the classification + stated requirements into a task
  profile (reasoning, privacy, accuracy, latency).
- **Router** — scores every configured AI provider's model on the NØVA
  score (capability fit, accuracy fit, privacy compliance, latency fit,
  reliability, minus token cost and failure risk) and routes to the
  highest scorer, or to a deterministic tool when one exists — subject to
  Guardian's hard privacy constraint.
- **Executor** — runs it: a hand-written arithmetic evaluator, a regex
  extractor, a web search, a sandboxed code run, or a call to NVIDIA NIM
  via the OpenAI-compatible `openai` SDK.
- **Verifier** — sanity-checks the output before it's returned. If an AI
  response fails verification, the orchestrator escalates once to a
  stronger model on the same provider before giving up.

Every request returns a full execution trace explaining why that path was
chosen.

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui — frontend & API routes
- Supabase Auth (`@supabase/ssr`) — sign up/in/out, session-protected `/dashboard`
- Zod — request validation at the gateway
- Provider-independent AI abstraction (`src/lib/nova/providers`), on the
  `openai` SDK — NVIDIA NIM (free, no funded account required), behind
  one `AIProvider` interface so another provider can be added later
  without touching the Router or orchestrator
- Supabase/Postgres + pgvector schema (`supabase/migrations`) for tasks,
  providers/models, routing decisions, executions, verification results,
  privacy events and memories — with RLS scoped to `auth.uid()`
- Vitest unit tests + GitHub Actions CI (lint, typecheck, test, build)

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Auth and persistence are both optional in local dev — without Supabase
configured, `/dashboard` stays open and the pipeline just skips writing
history (every API route degrades gracefully rather than erroring). Add
`NVIDIA_API_KEY` to actually execute AI-routed tasks.

Open [http://localhost:3000](http://localhost:3000). Try:

- `92837 * 728` → solved deterministically, zero AI calls.
- `Extract all email addresses from: jane@acme.com, support@nova.dev` →
  regex extractor, zero AI calls.
- `search for the latest Next.js 16 release notes` → a real web search
  (Brave Search API), zero AI calls (requires `BRAVE_SEARCH_API_KEY`).
- ` ```python\nprint(sum(range(1, 11)))\n``` ` with "run this" → executed
  in a real sandbox (Wandbox), zero AI calls, no key needed.
- `Analyze these research papers and identify contradictory conclusions.` →
  routed to whichever configured AI provider scores highest (requires an
  API key to actually execute).
- `My password: hunter2` → blocked by Guardian before any provider is
  called — the same hard block applies to web search and code execution
  too, not just AI.

## API

- `POST /api/task` — `{ task, privacy?, accuracy?, latency? }` (Zod-validated,
  rate-limited) → runs the full pipeline and returns the routing decision,
  output, verification result and trace. Persists under the signed-in
  user's `user_id` when authenticated.
- `GET /api/providers` — configured/health/reliability status of each AI provider.
- `GET /api/executions` / `GET /api/executions/:id` — persisted execution
  history (requires Supabase; `503` otherwise).
- `GET /api/metrics` — aggregate efficiency metrics over the last 500
  persisted executions (requires Supabase).

## Auth

Sign up/in at `/login`; `/dashboard` and `/executions` are read normally
either way, but `/dashboard` redirects to `/login` when Supabase Auth is
configured and no session exists (see `src/proxy.ts` — Next.js 16 renamed
`middleware.ts` to `proxy.ts`). Task rows are scoped to `auth.uid()` via RLS.

## Benchmark

`npm run benchmark` runs the task dataset in `benchmarks/datasets/tasks.json`
through the real orchestrator and compares it against a "conventional AI app"
baseline that sends every request straight to an LLM with no classification
or privacy screening — the architecture NØVA replaces. It prints a summary
and writes a full report to `benchmarks/reports/latest.json`. This measures
*routing decisions* (what NØVA avoided sending to a model, and why), not
model output quality — that comparison needs live provider keys.

## Tests & CI

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

`.github/workflows/ci.yml` runs all four on every push/PR to `main`.

## Project structure

```
src/app/                Next.js routes
  page.tsx                landing page (redirects to /dashboard if signed in)
  login/                   sign up / sign in
  dashboard/               the NØVA console (protected once auth is configured)
  executions/              persisted execution history
  api/                     task / providers / executions / metrics route handlers
src/components/ui/      shadcn/ui components
src/lib/nova/
  scout.ts               task classification
  guardian.ts             PII detection + privacy classification
  thinker.ts              task profile scoring
  router.ts               NØVA-score-based execution-path selection
  scoring.ts               the NØVA score itself
  verifier.ts              output verification
  orchestrator.ts          orchestrates the full agent loop, incl. escalation
  persistence.ts            writes each run to Supabase (best-effort)
  schema.ts                 Zod request schema
  rate-limit.ts              in-memory gateway rate limiter
  executors/                deterministic (Level 0) execution — calculator,
                              regex — plus specialized (Level 2) tools —
                              web search (Brave), code sandbox (Wandbox) —
                              all zero-AI
  providers/                 provider-agnostic AI interface, the NVIDIA
                              adapter (openai SDK), and the health tracker
                              that feeds Router reliability scores
src/lib/supabase/
  client.ts                browser client (publishable key)
  server.ts                 SSR client bound to the request's session
  admin.ts                   service-role client for cross-user persistence
src/proxy.ts             session refresh + auth-gates /dashboard
supabase/migrations/    Postgres schema
supabase/seed.sql        seeds the providers/models reference tables
benchmarks/             adaptive-routing vs. always-AI baseline comparison
tests/                  Vitest unit tests (Scout, Guardian, Router, executors)
```

## Notes on provider claims

NVIDIA's model catalog and free-tier terms can change; this
project does not assume permanently free or unlimited inference. NØVA's
value is in avoiding unnecessary AI calls in the first place — see the
"Computation Efficiency" panel on the dashboard for this session's actual
AI-calls-avoided rate.
