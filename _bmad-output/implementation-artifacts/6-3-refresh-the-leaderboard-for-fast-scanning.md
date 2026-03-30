# Story 6.3: Refresh the leaderboard for fast scanning

Status: ready-for-dev

## Story

As a player or commissioner,
I want the leaderboard to be easier to scan at a glance,
so that standings feel immediate and trustworthy.

## Acceptance Criteria

1. Given I open the leaderboard on desktop or mobile, when the standings render, then rank, team/player name, and score are visually prioritized, and the top entries are easy to compare quickly.
2. Given score changes occur during refresh, when the leaderboard updates, then the change is visible without creating layout confusion, and the update remains readable on small screens.
3. Given the leaderboard has no score data yet, when I view it, then the empty or pending state is still structured and readable rather than looking broken.

## Tasks / Subtasks

- [ ] Rework leaderboard hierarchy for scanability (AC: #1, #2)
  - [ ] Prioritize rank, name, and score in the layout
  - [ ] Reduce visual noise around secondary metadata
- [ ] Improve change and refresh treatment (AC: #2, #3)
  - [ ] Make score updates easy to notice without shifting the layout excessively
  - [ ] Keep pending and empty states visually intentional
- [ ] Verify responsiveness and readability (AC: #1, #2, #3)
  - [ ] Check mobile stacking and spacing
  - [ ] Confirm trust cues remain visible during live refreshes

## Dev Notes

- Keep the leaderboard backed by the existing polling/freshness model; this is a UI refresh, not a data model change.
- Favor concise row density and strong alignment so users can scan standings quickly.
- Preserve current server-derived ranking and stale-state behavior.
- Source story: [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3]

### Project Structure Notes

- Likely touch points: `src/components/leaderboard.tsx`, route surfaces that render leaderboard state, and shared status primitives.
- Avoid moving leaderboard data logic into client state.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX Pattern Analysis & Inspiration]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Visual Design Foundation]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/project-context.md#Critical Don't-Miss Rules]

## Dev Agent Record

### Agent Model Used

GPT-5.4-mini

### Debug Log References

- None yet.

### Completion Notes List

- Story file generated from Epic 6 and project context.

### File List

- _bmad-output/implementation-artifacts/6-3-refresh-the-leaderboard-for-fast-scanning.md
