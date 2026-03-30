# Story 6.7: Finalize responsive motion and accessibility polish

Status: ready-for-dev

## Story

As a player or commissioner,
I want the upgraded UI to work smoothly on desktop and mobile,
so that the app feels polished and usable everywhere.

## Acceptance Criteria

1. Given I use the app on desktop or mobile, when I navigate the primary screens, then the layout adapts cleanly to the viewport, and touch targets, spacing, and typography remain usable.
2. Given I use keyboard navigation or focus states, when I move through interactive controls, then focus is clearly visible, and motion or transitions do not block usability or clarity.
3. Given I encounter status chips, confirmation states, or errors on a small screen, when the screen renders, then the text remains legible and the meaning remains clear without relying on color alone.

## Tasks / Subtasks

- [ ] Tune responsive layout behavior across core screens (AC: #1)
  - [ ] Check stacking, spacing, and hierarchy at mobile and desktop widths
  - [ ] Keep tap targets comfortable on small screens
- [ ] Standardize motion and focus treatment (AC: #2)
  - [ ] Ensure transitions are purposeful and subtle
  - [ ] Preserve strong visible focus states for keyboard users
- [ ] Validate accessibility basics across status-heavy UI (AC: #2, #3)
  - [ ] Verify contrast and readable text sizes
  - [ ] Confirm status messaging remains perceivable without color alone

## Dev Notes

- Accessibility and responsiveness are product requirements, not polish-only extras.
- Keep motion restrained; it should support clarity, not distract from it.
- Maintain the same server-backed trust signals while refining presentation.
- Source story: [Source: _bmad-output/planning-artifacts/epics.md#Story 6.7]

### Project Structure Notes

- Likely touch points: `src/app/globals.css`, `src/app/layout.tsx`, shared UI components, and any route-specific layout wrappers.
- Avoid adding a new animation framework unless it is already present in the app.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.7]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Considerations]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Spacing & Layout Foundation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns Identified]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]

## Dev Agent Record

### Agent Model Used

GPT-5.4-mini

### Debug Log References

- None yet.

### Completion Notes List

- Story file generated from Epic 6 and project context.

### File List

- _bmad-output/implementation-artifacts/6-7-finalize-responsive-motion-and-accessibility-polish.md
