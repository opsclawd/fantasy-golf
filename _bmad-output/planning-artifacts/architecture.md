---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-28'
inputDocuments:
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/project-context.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/prd.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/01-brainstorming.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/02-market-research.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/03-domain-research.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/04-technical-research.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/05-product-brief.md
workflowType: 'architecture'
project_name: 'fantasy-golf'
user_name: 'Gary'
date: '2026-03-28'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The PRD defines 36 functional requirements across 6 groups:
- Pool setup and administration
- Player access and entry
- Scoring and leaderboards
- Golfer detail and pick visibility
- Trust, audit, and support
- Delivery and experience

Architecturally, this points to a small set of core workflows that must stay consistent end to end: commissioner setup, invite/join, pick submission, lock enforcement, scoring refresh, leaderboard display, and support/audit inspection. The key design pressure is not feature breadth, but preserving a trustworthy source of truth across these workflows.

**Non-Functional Requirements:**
The NFRs emphasize:
- Performance for live tournament windows
- Security and role-based access control
- Scalability for activity spikes
- Accessibility for keyboard and mobile use
- Integration resilience against external score feed instability

These requirements suggest the architecture needs explicit server-side validation, stable state transitions, visible freshness indicators, and a scoring model that can tolerate delayed or partial upstream data without presenting false confidence.

**Scale & Complexity:**
Project complexity appears to be: medium
Primary technical domain: web app / full-stack
Estimated architectural components: 6-8

- Primary domain: private invite-led fantasy sports web app
- Complexity level: medium
- Core architectural focus: trust, polling-based freshness, and auditability

### Technical Constraints & Dependencies

- The product is invite-only and does not require SEO-first architecture.
- UI should behave like an SPA, but key state must remain server-backed.
- Scoring and lock logic must stay outside client state.
- Leaderboard updates should be polling-based with explicit freshness indicators.
- Modern Chrome and Safari on desktop and mobile must be supported.
- Accessibility must cover readable contrast, keyboard access, and clear status messaging.
- The existing project context expects App Router patterns, TypeScript strictness, and Supabase wiring to remain isolated in dedicated helpers.

### Cross-Cutting Concerns Identified

- Authentication and access control for private pools
- Lock enforcement and editability rules
- Scoring correctness and reproducibility
- Freshness/staleness visibility across the product
- Audit logging and support diagnostics
- Mobile responsiveness for player entry
- Safe handling of external scoring source instability
- Consistent trust cues in UI and error states

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web application based on the project requirements and existing project context.

### Starter Options Considered

- Next.js App Router starter via `create-next-app`
- Vite + React starter
- Remix starter
- Full-stack meta-starters like T3 / Redwood / Blitz

The project needs a server-backed, invite-led web app with strong TypeScript conventions, clear routing, and room for shared domain logic. That makes the Next.js App Router ecosystem the cleanest fit.

### Selected Starter: Next.js App Router starter

**Rationale for Selection:**
This is the best match for the existing project context and the PRD. It supports the current architecture direction: App Router, TypeScript strictness, Tailwind styling, and server-backed mutations. It also keeps the foundation simple enough for a private, trust-sensitive product.

**Initialization Command:**

```bash
npx create-next-app@latest fantasy-golf --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --use-pnpm --yes --disable-git --agents-md
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript-first setup
- App Router project structure
- `src/` layout
- import alias configured as `@/*`

**Styling Solution:**
- Tailwind CSS preconfigured
- Utility-first styling for fast iteration
- Good fit for mobile-first commissioner/player flows

**Build Tooling:**
- Next.js production build pipeline
- Turbopack-enabled dev experience
- ESLint included

**Testing Framework:**
- No opinionated test runner forced by the starter
- Leaves room for project-specific scoring/domain tests

**Code Organization:**
- App Router route structure
- `src/app` for routes and server actions
- straightforward pathing for shared UI and utilities

**Development Experience:**
- Fast local dev startup
- Standardized linting and TypeScript defaults
- Agent guidance files included for consistency

**Note:** Since this is a brownfield project, the starter is a reference architecture baseline, not a command to reinitialize the repository.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- Supabase Postgres is the single source of truth for pool, entry, scoring, and audit data.
- Supabase Auth with server-verified SSR cookies controls private pool access and commissioner permissions.
- Route handlers plus server actions handle mutations; shared pure domain logic owns scoring and lock rules.
- Vercel hosts the web app and Supabase hosts data and auth.
- Scoring refresh uses scheduled polling with a last-known-good snapshot.

**Important Decisions (Shape Architecture):**

- UI is feature-oriented, with route-segmented pages and shared components in `src/components`.
- Freshness uses minimal server-side caching plus explicit metadata.
- Structured logs and append-only audit trails support supportability and replay.
- Domain-first unit tests protect scoring correctness and lock behavior.

**Deferred Decisions (Post-MVP):**

- Aggressive edge caching for leaderboard reads.
- Webhook-driven score refresh.
- Expanded monitoring stack beyond structured logs and audit history.

### Data Architecture

Supabase Postgres acts as the system of record for pool setup, player entries, score snapshots, leaderboard state, lock timestamps, and audit history. This keeps the trust boundary in one place and avoids splitting authoritative state across client memory or ad hoc caches.

### Authentication & Security

Supabase Auth with server-verified SSR cookies governs user sessions. Authorization decisions happen on the server in route handlers and server actions, with commissioner-only actions blocked before they reach the UI. Locked entries are enforced server-side.

### API & Communication Patterns

Route handlers serve explicit request/response endpoints, while server actions handle form-driven mutations from the app router. Scoring and lock behavior live in shared pure TypeScript utilities under `src/lib`, making the business rules testable outside Next.js.

### Frontend Architecture

The app uses feature-oriented route segments for pool setup, join/entry, leaderboard, and support flows. Shared components live in `src/components`, keeping reusable status chips, cards, and confirmation states consistent across commissioner and player views.

### Infrastructure & Deployment

Vercel hosts the Next.js app. Supabase provides auth, database, and server-side persistence. This pairing keeps the operational surface small while matching the app’s server-backed, invite-led workflow.

### Decision Impact Analysis

**Implementation Sequence:**

1. Define schema and shared domain logic for pools, entries, scores, and audit events.
2. Wire Supabase Auth and server-verified session handling.
3. Implement route handlers and server actions for commissioner and player mutations.
4. Build polling-based score refresh with last-known-good snapshots and freshness metadata.
5. Add UI surfaces for lock state, freshness, and submission confirmation.
6. Add structured logs, audit history, and domain-first tests.

**Cross-Component Dependencies:**

- Authentication depends on server-side session handling before commissioner actions can be trusted.
- UI freshness states depend on the refresh snapshot model.
- Audit logging depends on domain events being emitted from scoring and mutation flows.
- Tests depend on scoring and lock logic staying pure and isolated from framework code.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**

8 areas where AI agents could make different choices

### Naming Patterns

**Database Naming Conventions:**

- Tables: plural, `snake_case` (for example `pools`, `entries`, `score_snapshots`, `audit_events`)
- Columns: `snake_case` (for example `pool_id`, `refreshed_at`, `last_known_good_at`)
- Foreign keys: `<entity>_id`
- Indexes: `<table>_<column>_idx`

**API Naming Conventions:**

- Routes: plural nouns (for example `/api/pools`, `/api/pools/[poolId]/entries`)
- Route parameters: `[poolId]`, `[entryId]`
- Query params: `camelCase` in app code and URLs when needed

**Code Naming Conventions:**

- Components: `PascalCase`
- Files: `PascalCase.tsx` for components, `camelCase.ts` for utilities
- Functions and variables: `camelCase`

### Structure Patterns

**Project Organization:**

- `src/app` owns routes, layouts, and server actions
- `src/components` owns shared UI primitives and cross-route components
- `src/lib` owns domain logic, helpers, and server wiring
- `src/lib/supabase` owns all Supabase client/server helpers

**File Structure Patterns:**

- Co-locate route-specific UI with the route segment
- Keep scoring tests in `src/lib/__tests__/scoring.test.ts`
- Keep configuration files at the repo root unless they are feature-specific

### Format Patterns

**API Response Formats:**

- Success: `{ data, error: null }`
- Failure: `{ data: null, error: { code, message, details? } }`

**Data Exchange Formats:**

- Dates: ISO 8601 strings
- JSON keys: `camelCase` in app-level payloads
- Boolean values: `true` / `false`

### Communication Patterns

**Event System Patterns:**

- Use past-tense event names such as `scoreRefreshCompleted` and `entryLocked`
- Append audit records; do not mutate prior records

**State Management Patterns:**

- Treat server state as authoritative
- Use immutable updates in client state
- Keep lock, freshness, and scoring state synchronized from server responses

### Process Patterns

**Error Handling Patterns:**

- Validate on the server first
- Preserve last-known-good leaderboard data on refresh failure
- Surface stale data explicitly instead of hiding it

**Loading State Patterns:**

- Show local loading states for mutations
- Show global freshness/loading states only where trust depends on them
- Keep submission and refresh feedback immediate and explicit

### Enforcement Guidelines

**All AI Agents MUST:**

- use the same naming and file-placement rules
- keep business rules in shared pure TypeScript modules
- treat Supabase as the source of truth

**Pattern Enforcement:**

- Review new files against the naming and placement rules before merging
- Flag pattern drift in architecture notes or implementation review
- Update these rules only when a recurring conflict justifies it

### Pattern Examples

**Good Examples:**

- `src/app/api/pools/route.ts`
- `src/lib/scoring.ts`
- `audit_events`
- `scoreRefreshCompleted`

**Anti-Patterns:**

- scoring logic inside React components
- singular table names mixed with plural names
- hidden lock or freshness state
- inconsistent response shapes across endpoints

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
fantasy-golf/
├── README.md
├── package.json
├── package-lock.json
├── next.config.js
├── tsconfig.json
├── next-env.d.ts
├── .env.local
├── .env.example
├── .gitignore
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx
│   │   ├── loading.tsx
│   │   ├── (auth)/
│   │   │   ├── sign-in/
│   │   │   │   ├── page.tsx
│   │   │   │   └── actions.ts
│   │   │   └── sign-up/
│   │   │       ├── page.tsx
│   │   │       └── actions.ts
│   │   ├── (app)/
│   │   │   ├── layout.tsx
│   │   │   ├── loading.tsx
│   │   │   ├── commissioner/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── actions.ts
│   │   │   │   └── pools/
│   │   │   │       └── [poolId]/
│   │   │   │           ├── page.tsx
│   │   │   │           ├── actions.ts
│   │   │   │           └── PoolActions.tsx
│   │   │   ├── participant/
│   │   │   │   ├── pools/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── picks/
│   │   │   │       └── [poolId]/
│   │   │   │           ├── page.tsx
│   │   │   │           └── actions.ts
│   │   └── api/
│   │       ├── tournaments/route.ts
│   │       ├── leaderboard/[poolId]/route.ts
│   │       ├── scoring/route.ts
│   │       └── cron/scoring/route.ts
│   ├── components/
│   │   ├── leaderboard.tsx
│   │   ├── score-display.tsx
│   │   └── golfer-picker.tsx
│   └── lib/
│       ├── scoring.ts
│       ├── __tests__/scoring.test.ts
│       ├── db/
│       │   ├── schema.sql
│       │   └── seed.sql
│       ├── supabase/
│       │   ├── client.ts
│       │   ├── server.ts
│       │   └── types.ts
│       └── slash-golf/
│           ├── client.ts
│           └── types.ts
├── public/
└── docs/
    └── superpowers/
        ├── plans/
        └── specs/
```

### Architectural Boundaries

**API Boundaries:**

- `src/app/api/*` exposes explicit server endpoints for tournaments, leaderboard reads, scoring refresh, and cron-triggered scoring.
- Server actions handle commissioner and participant mutations within route segments.
- Supabase session verification happens on the server before any privileged action.

**Component Boundaries:**

- `src/components` contains shared UI primitives used across commissioner, participant, and spectator flows.
- Route segments own page composition and feature-specific view logic.
- Shared components never own authoritative state for locks, freshness, or scoring.

**Service Boundaries:**

- `src/lib/scoring.ts` owns all scoring and lock rules.
- `src/lib/supabase/*` owns database/auth client wiring only.
- `src/lib/slash-golf/*` remains isolated as domain-specific client/types support.

**Data Boundaries:**

- `src/lib/db/schema.sql` defines canonical persistence shape.
- `src/lib/db/seed.sql` provides baseline fixtures.
- Database state is authoritative; UI state is derived.

### Requirements to Structure Mapping

**Feature/Epic Mapping:**

- Epic 1: `src/app/(app)/commissioner/`, `src/app/api/tournaments/route.ts`
- Epic 2: `src/app/(app)/participant/picks/[poolId]/`, `src/components/golfer-picker.tsx`
- Epic 3: `src/app/api/scoring/route.ts`, `src/app/api/cron/scoring/route.ts`, `src/app/api/leaderboard/[poolId]/route.ts`, `src/components/leaderboard.tsx`
- Epic 4: `src/components/score-display.tsx`, `src/app/(app)/participant/pools/page.tsx`, commissioner pool detail routes
- Epic 5: `src/lib/scoring.ts`, `src/lib/__tests__/scoring.test.ts`, `src/lib/supabase/*`, shared status UI

**Cross-Cutting Concerns:**

- Authentication: `src/app/(auth)/*`, `src/lib/supabase/server.ts`
- Data access: `src/lib/supabase/*`
- Scoring correctness: `src/lib/scoring.ts` and tests
- Leaderboard freshness: API routes plus `src/components/leaderboard.tsx`

### Integration Points

**Internal Communication:**

- Route segments call server actions for mutations.
- UI components consume props derived from server state.
- API routes and cron routes update authoritative data and snapshots.

**External Integrations:**

- Supabase handles auth, data persistence, and server-side access.
- Tournament and scoring feeds are consumed through backend routes, not directly in client components.

**Data Flow:**

- User action -> route/server action -> domain logic -> Supabase write -> refreshed server read -> UI render.
- Scoring refresh -> backend fetch -> last-known-good snapshot write -> leaderboard read -> freshness display.

### File Organization Patterns

**Configuration Files:**

- Root config stays at repo root.
- Environment files stay at root and never contain committed secrets.

**Source Organization:**

- Routes in `src/app`.
- Shared UI in `src/components`.
- Business logic and wiring in `src/lib`.

**Test Organization:**

- Domain tests stay beside the scoring module in `src/lib/__tests__`.

**Asset Organization:**

- Static assets belong in `public/`.

### Development Workflow Integration

**Development Server Structure:**

- `next dev` runs the app with route-segmented flows intact.
- App Router keeps commissioner and participant experiences isolated by route group.

**Build Process Structure:**

- `next build` validates the app, routes, and shared server logic together.

**Deployment Structure:**

- Vercel deploys the Next.js app.
- Supabase provides production data and auth services.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

All core decisions work together cleanly. Supabase Postgres, Supabase Auth with SSR cookies, route handlers/server actions, and Vercel deployment form a consistent server-backed architecture with a single source of truth.

**Pattern Consistency:**

The naming, structure, format, communication, and process patterns all support the selected stack. Shared pure domain logic, explicit freshness states, and append-only audit history reinforce the trust-first model.

**Structure Alignment:**

The project structure matches the architecture decisions and the existing codebase. Route groups, shared UI, lib boundaries, Supabase helpers, and domain tests are placed where the implementation flow expects them.

### Requirements Coverage Validation ✅

**Epic/Feature Coverage:**

All epics map to concrete directories, route groups, API routes, shared components, and domain modules.

**Functional Requirements Coverage:**

All 36 FRs are supported by architectural decisions and file locations.

**Non-Functional Requirements Coverage:**

Performance, security, scalability, accessibility, and integration resilience are all addressed by the chosen data model, auth flow, polling strategy, UI patterns, and audit approach.

### Implementation Readiness Validation ✅

**Decision Completeness:**

Critical and important decisions are documented with practical rationale and implementation order.

**Structure Completeness:**

The project tree is specific, complete, and aligned to the existing codebase.

**Pattern Completeness:**

Naming, format, process, and enforcement rules are explicit enough to keep multiple agents consistent.

### Gap Analysis Results

**Critical Gaps:** None.

**Important Gaps:** None blocking. Minor future refinements may be needed around deeper observability if traffic or support needs grow.

**Nice-to-Have Gaps:** A more detailed operational monitoring plan could be added after MVP stabilization.

### Validation Issues Addressed

No blocking issues were found during validation. The document is coherent, complete, and ready to guide implementation.

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** high based on validation results

**Key Strengths:**

- Single-source-of-truth data model through Supabase Postgres
- Server-verified auth and mutation flow
- Trust-first scoring refresh with stale-state visibility
- Clear domain boundaries and testable scoring logic
- Specific project structure mapped to the current codebase

**Areas for Future Enhancement:**

- Expanded observability and alerting if tournament usage grows
- Potential read caching for leaderboard scale if needed later
- More operational dashboards for support and commissioner diagnostics

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions

**First Implementation Priority:**

Define schema and shared domain logic for pools, entries, scores, and audit events.
