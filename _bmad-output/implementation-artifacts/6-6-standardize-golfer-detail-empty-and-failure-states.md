# Story 6.6: Standardize golfer detail, empty, and failure states

Status: ready-for-dev

## Story

As a player or commissioner,
I want golfer detail and fallback states to be polished and consistent,
so that the product stays clear even when data is incomplete or unavailable.

## Acceptance Criteria

1. Given I open a golfer detail view, when the view renders, then the layout uses the same visual system as the rest of the app, and golfer context is easy to scan.
2. Given a screen has no data, partial data, or a failure state, when the UI renders that state, then the empty or fallback treatment is clearly intentional, and it uses the same visual language as the rest of the product.
3. Given data availability changes while I am viewing the screen, when the state updates, then the fallback or detail treatment remains readable and trustworthy.

## Tasks / Subtasks

- [ ] Refresh golfer detail presentation (AC: #1, #3)
  - [ ] Align golfer detail hierarchy with the broader visual system
  - [ ] Make key stats and context easier to scan
- [ ] Standardize empty and failure states (AC: #2, #3)
  - [ ] Build or update shared fallback patterns
  - [ ] Ensure no empty state looks like a broken UI
- [ ] Verify consistency across player and commissioner contexts (AC: #1, #2, #3)
  - [ ] Check the same visual language is used in all relevant surfaces
  - [ ] Confirm fallback states remain readable on mobile

## Dev Notes

- Preserve the trust model: stale or missing data should be explicit, never hidden.
- Reuse shared empty/fallback treatments instead of inventing one-off screen states.
- This story touches both player and commissioner views, so keep the styling system generic.
- Source story: [Source: _bmad-output/planning-artifacts/epics.md#Story 6.6]

### Project Structure Notes

- Likely touch points: `src/components/score-display.tsx`, `src/components/leaderboard.tsx`, golfer detail views, and shared empty-state components.
- Keep support/oversight presentation in the same UI language as player-facing states.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.6]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Anti-Patterns to Avoid]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Emotional Design Principles]
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns]
- [Source: _bmad-output/project-context.md#Critical Don't-Miss Rules]

## Dev Agent Record

### Agent Model Used

GPT-5.4-mini

### Debug Log References

- None yet.

### Completion Notes List

- Story file generated from Epic 6 and project context.

### File List

- _bmad-output/implementation-artifacts/6-6-standardize-golfer-detail-empty-and-failure-states.md
