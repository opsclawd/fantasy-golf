# Story 4.2: See how a golfer affects my standing

Status: ready-for-dev

## Story

As a player,
I want to see how a golfer affects my standing,
so that I understand the impact of my picks.

## Acceptance Criteria

1. Given I have selected golfers in my entry, when I view my picks, then I can see how those golfers contribute to my current standing, and the contribution is shown in a clear, understandable way.

## Tasks / Subtasks

- [ ] Implement the user-facing flow or domain update (AC: #1)
- [ ] Add server-side validation and persistence where applicable (AC: #1, #2)
- [ ] Surface explicit status, confirmation, or failure messaging in the UI (AC: #1, #2)
- [ ] Add deterministic tests for the rules touched by this story (AC: #1, #2)

## Dev Notes

- Use Next.js App Router patterns only; route files live under `src/app`.
- Keep mutations in server actions or route handlers; no sensitive writes from client components.
- Keep Supabase wiring isolated to `src/lib/supabase/*`.
- Keep scoring and lock logic in shared pure TypeScript domain logic.
- Preserve visible freshness and lock-state messaging; never present stale data as current.
- Keep tests deterministic at the domain level, especially for scoring and lock behavior.
- App Router + TypeScript strictness + Tailwind are the baseline stack.
- Server-backed state must remain the source of truth for auth, deadlines, and scoring.
- Polling-based leaderboard refresh with explicit freshness indicators is required.
- Accessibility and mobile responsiveness are first-class constraints.
- Trust cues must be visible: lock state, freshness, confirmation, fallback states.
- Commissioner flows should feel like a guided launch sequence.
- Player flows must be mobile-friendly with immediate pick counts and confirmation.
- This story maps to Epic 4: Understand golfer choices and impact.
- Story source: [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2]
- Keep the implementation aligned to the existing App Router / Supabase split.

### Project Structure Notes

- Align with `src/app` for routes and `src/lib` for domain logic and data wiring.
- Keep story-specific UI near the route segment when it is clearly scoped.
- Preserve existing naming and avoid introducing a new architectural pattern for a single story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2]
- [Source: _bmad-output/project-context.md#Technology Stack & Versions]
- [Source: _bmad-output/planning-artifacts/prd.md#Executive Summary]
- [Source: _bmad-output/planning-artifacts/architecture.md#Technical Constraints & Dependencies]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Core User Experience]

## Dev Agent Record

### Agent Model Used

GPT-5.4-mini

### Debug Log References

- None yet.

### Completion Notes List

- Story file generated from epics and project context.

### File List

- _bmad-output/implementation-artifacts/4-2-see-how-a-golfer-affects-my-standing.md
