# Story 6.1: Establish a unified visual system

Status: ready-for-dev

## Story

As a player or commissioner,
I want the app to use one consistent visual system,
so that every screen feels like part of the same product.

## Acceptance Criteria

1. Given I move between commissioner and player screens, when I view headers, cards, buttons, and status elements, then they use the same spacing, typography, and color treatment, and the layout feels visually consistent across the app.
2. Given a screen uses legacy styling patterns, when the updated UI is applied, then the new design replaces the inconsistent styling, and it preserves the existing user flow.
3. Given I view the app on desktop or mobile, when I move across the main surfaces, then no screen introduces a conflicting visual language or one-off component treatment.

## Tasks / Subtasks

- [ ] Audit shared UI surfaces for inconsistent styling patterns (AC: #1, #3)
  - [ ] Review commissioner, player, leaderboard, and detail screens for mismatched spacing or typography
  - [ ] Identify reusable primitives that should be standardized
- [ ] Implement the unified visual treatment in shared UI pieces (AC: #1)
  - [ ] Update shared cards, buttons, headings, and status surfaces
  - [ ] Align color, radius, spacing, and hierarchy across key screens
- [ ] Apply the visual system to the existing routes without changing flow behavior (AC: #2, #3)
  - [ ] Keep the current navigation and server-backed state intact
  - [ ] Replace only styling and presentation, not business logic
- [ ] Add verification for consistency-sensitive surfaces (AC: #1, #2, #3)
  - [ ] Check responsive behavior on desktop and mobile breakpoints
  - [ ] Confirm the updated UI does not regress accessibility basics

## Dev Notes

- Use the existing App Router structure; keep route logic in `src/app` and shared UI in `src/components`.
- Keep server-backed state authoritative; this story is presentation-focused only.
- Favor a scoreboard-led visual hierarchy with strong contrast, clear labeling, and compact status treatment.
- Preserve lock, freshness, and confirmation messaging from the existing trust model.
- Keep styling changes aligned with Tailwind and the current TypeScript/Next.js stack.
- Source story: [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1]

### Project Structure Notes

- Likely touch points: `src/components`, `src/app/(app)`, `src/app/globals.css`, and route-specific presentation files.
- Avoid introducing a new design system package; standardize what already exists first.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX Design Foundation]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Visual Design Foundation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]

## Dev Agent Record

### Agent Model Used

GPT-5.4-mini

### Debug Log References

- None yet.

### Completion Notes List

- Story file generated from Epic 6 and project context.

### File List

- _bmad-output/implementation-artifacts/6-1-establish-a-unified-visual-system.md
