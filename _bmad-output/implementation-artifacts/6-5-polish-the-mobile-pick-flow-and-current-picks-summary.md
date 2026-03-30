# Story 6.5: Polish the mobile pick flow and current picks summary

Status: ready-for-dev

## Story

As a player,
I want the pick flow to feel clean and reassuring on mobile,
so that I can submit my entry quickly and confidently.

## Acceptance Criteria

1. Given I am selecting golfers on mobile, when I add or remove picks, then the remaining-picks indicator updates immediately, and the current entry summary stays visible and readable.
2. Given I submit a valid entry, when the save completes, then the confirmation state is unmistakable, and my saved picks remain visible in the updated design.
3. Given I revisit the entry before lock, when I review the flow, then the mobile layout makes editability and completion status obvious at a glance.

## Tasks / Subtasks

- [ ] Refine the mobile pick entry hierarchy (AC: #1, #3)
  - [ ] Keep slot progress and current picks in a stable visual position
  - [ ] Improve tap-friendly spacing and scanability
- [ ] Strengthen submission and confirmation states (AC: #2)
  - [ ] Make successful saves visually unmistakable
  - [ ] Preserve the saved entry summary after submission
- [ ] Verify small-screen readability and touch behavior (AC: #1, #2, #3)
  - [ ] Check that the UI remains usable on narrow mobile screens
  - [ ] Confirm no interaction depends on hover-only affordances

## Dev Notes

- Keep the pick flow mobile-first, but do not create a separate mobile-only codepath.
- Preserve the existing lock/edit rules and server-backed entry state.
- Favor clear progress, immediate feedback, and low-friction scanning over dense list layouts.
- Source story: [Source: _bmad-output/planning-artifacts/epics.md#Story 6.5]

### Project Structure Notes

- Likely touch points: `src/app/(app)/participant/picks/[poolId]`, `src/components/golfer-picker.tsx`, and shared summary/status components.
- Keep the entry flow aligned with the existing App Router structure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.5]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Effortless Interactions]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Target Users]
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements to Structure Mapping]
- [Source: _bmad-output/project-context.md#Critical Don't-Miss Rules]

## Dev Agent Record

### Agent Model Used

GPT-5.4-mini

### Debug Log References

- None yet.

### Completion Notes List

- Story file generated from Epic 6 and project context.

### File List

- _bmad-output/implementation-artifacts/6-5-polish-the-mobile-pick-flow-and-current-picks-summary.md
