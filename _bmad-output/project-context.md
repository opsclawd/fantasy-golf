---
project_name: 'fantasy-golf'
user_name: 'Gary'
date: '2026-03-28'
sections_completed:
  - technology_stack
  - language_rules
  - framework_rules
  - testing_rules
  - quality_rules
  - workflow_rules
  - anti_patterns
status: 'complete'
rule_count: 14
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- Next.js `14.2.0` with App Router
- React `18` / React DOM `18`
- TypeScript `^5` with `strict: true`
- Supabase: `@supabase/supabase-js ^2.39.0`, `@supabase/ssr ^0.9.0`
- Tailwind CSS `^3.4.0`, PostCSS `^8`, Autoprefixer `^10`
- ESLint `^8` with `eslint-config-next 14.2.0`
- Node type defs `^20`, React type defs `^18`

## Critical Implementation Rules

### Language-Specific Rules

- Keep TypeScript strict; do not weaken `tsconfig.json` to make errors disappear.
- Use `@/*` for imports from `src/*`; avoid deep relative paths when the alias fits.
- Prefer pure functions for domain logic; keep scoring and ranking free of framework or DB code.
- `allowJs` exists, but new project code should stay TypeScript-first.

### Framework-Specific Rules

- Use App Router patterns only: route files live under `src/app`, including route handlers in `src/app/api`.
- Keep mutations in server actions or route handlers; do not push sensitive writes into client components.
- Put shared UI in `src/components` and route-specific UI next to the route segment.
- Treat Supabase helpers in `src/lib/supabase/*` as the only place for auth/client/server wiring.
- Keep leaderboard/scoring refresh logic polling-based and server-driven; realtime is optional, not the source of truth.

### Testing Rules

- Keep scoring tests in `src/lib/__tests__/scoring.test.ts` unless there is a strong reason to split.
- Test the scoring engine at the domain level first: best-ball, ties, birdies, withdrawals, and lock-time behavior.
- Prefer deterministic unit tests for scoring and validation over UI-heavy tests for core rules.

### Code Quality & Style Rules

- Keep business rules in `src/lib/scoring.ts` and related pure utilities; avoid hiding logic in page components.
- Use server-side validation for all pool, pick, and scoring mutations.
- Preserve visible freshness and lock-state messaging in UI; never silently show stale data as current.
- When using Supabase image URLs, rely on the configured remote pattern for `**.supabase.co`.

### Development Workflow Rules

- Use the existing script surface: `dev`, `build`, `start`, `lint`.
- Keep schema/seed changes in `src/lib/db/schema.sql` and `src/lib/db/seed.sql` when touching data shape.
- Favor small vertical slices that connect commissioner flow, pick flow, scoring, and leaderboard display end to end.

### Critical Don't-Miss Rules

- Do not make client UI the source of truth for auth, deadlines, or scoring state.
- Do not couple scoring logic to Next.js route handlers, React components, or Supabase SDK calls.
- Do not depend on realtime updates alone for leaderboard trust; keep polling/snapshots and freshness indicators.
- Do not add paid-play or payout complexity into the MVP core path.
- Do not hide scoring failures; surface stale data, lock state, and fallback behavior explicitly.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code.
- Follow these rules exactly; prefer the more restrictive option when unsure.
- Keep new logic aligned with the existing split: UI in `src/app` / `src/components`, domain logic in `src/lib`, data wiring in `src/lib/supabase`.
- Update this file when a new recurring pattern becomes important.

**For Humans:**

- Keep this file lean and specific to implementation behavior.
- Update it when the stack, folder structure, or core rules change.
- Remove rules once they become obvious or are no longer relevant.

Last Updated: 2026-03-28
