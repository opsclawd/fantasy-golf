# Story 6.2: Make status and freshness states impossible to miss

Status: ready-for-dev

## Story

As a player or commissioner,
I want lock state, freshness, and confirmation to stand out clearly,
so that I always know what is current and what I can do.

## Acceptance Criteria

1. Given I view a pool, leaderboard, or entry screen, when lock state or freshness changes, then the UI shows a clear chip, label, or icon alongside the text state, and the state is understandable without relying on color alone.
2. Given a score feed is stale or unavailable, when I view the leaderboard, then the stale or fallback state is visually prominent, and it does not look like current live data.
3. Given a submission or edit completes, when the state changes, then confirmation is immediate and visually distinct from ordinary content.

## Tasks / Subtasks

- [ ] Standardize status presentation patterns across the product (AC: #1, #2, #3)
  - [ ] Define the shared visual treatment for lock, freshness, confirmation, and failure states
  - [ ] Ensure text/icon cues always accompany color
- [ ] Apply the state system to pool, leaderboard, and entry screens (AC: #1, #2, #3)
  - [ ] Update current screens to use the shared state treatment
  - [ ] Keep stale/fallback states visually distinct from healthy live data
- [ ] Validate trust cues on mobile and desktop (AC: #1, #2, #3)
  - [ ] Check readability and hierarchy on small screens
  - [ ] Confirm the status model works in both commissioner and player contexts

## Dev Notes

- Keep lock/freshness state derived from server data, not client assumptions.
- Reuse shared UI primitives from `src/components` where possible instead of creating screen-specific status variants.
- Make stale, fallback, and confirmation states read as trust signals, not errors hidden in the layout.
- Source story: [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2]

### Project Structure Notes

- Likely touch points: `src/components`, `src/app/(app)/commissioner`, `src/app/(app)/participant`, `src/components/leaderboard.tsx`.
- Keep any new state primitives generic enough to use across multiple screens.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design Opportunities]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Considerations]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns Identified]
- [Source: _bmad-output/project-context.md#Code Quality & Style Rules]

## Dev Agent Record

### Agent Model Used

GPT-5.4-mini

### Debug Log References

- None yet.

### Completion Notes List

- Story file generated from Epic 6 and project context.

### File List

- _bmad-output/implementation-artifacts/6-2-make-status-and-freshness-states-impossible-to-miss.md
