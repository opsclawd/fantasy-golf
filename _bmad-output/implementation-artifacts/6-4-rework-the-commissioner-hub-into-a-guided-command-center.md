# Story 6.4: Rework the commissioner hub into a guided command center

Status: ready-for-dev

## Story

As a commissioner,
I want the setup and management screens to feel guided and focused,
so that running a pool feels simple instead of administrative.

## Acceptance Criteria

1. Given I open the commissioner hub, when I review pool status, invite sharing, and participation, then the primary actions are visually grouped in a clear order, and the screen emphasizes next steps instead of dense admin clutter.
2. Given the commissioner view has multiple status blocks, when the layout renders, then the most important status information is visually dominant, and secondary details remain accessible without competing for attention.
3. Given I return to the commissioner hub during the tournament lifecycle, when the pool state changes, then the page still feels like a guided control surface rather than a generic dashboard.

## Tasks / Subtasks

- [ ] Redesign commissioner hub layout and hierarchy (AC: #1, #2, #3)
  - [ ] Group actions into a clearer sequence
  - [ ] Emphasize status, invite, and participation above secondary data
- [ ] Update commissioner surface components (AC: #1, #2)
  - [ ] Align card treatment and spacing with the new system
  - [ ] Keep admin controls clearly separated from general information
- [ ] Verify guided-flow behavior on desktop and mobile (AC: #1, #2, #3)
  - [ ] Confirm the hub still works as the commissioner’s main control surface
  - [ ] Ensure the layout stays readable on smaller screens

## Dev Notes

- Preserve the server-backed commissioner state and existing admin permissions.
- This story should improve presentation and information order, not add new commissioner capabilities.
- Keep the hub consistent with the new scoreboard-inspired visual language, but do not overload it with decorative elements.
- Source story: [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4]

### Project Structure Notes

- Likely touch points: `src/app/(app)/commissioner`, `src/components`, and any pool status subcomponents.
- Keep commissioner-only actions behind the existing auth/permission boundary.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Core User Experience]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design Principles]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/project-context.md#Development Workflow Rules]

## Dev Agent Record

### Agent Model Used

GPT-5.4-mini

### Debug Log References

- None yet.

### Completion Notes List

- Story file generated from Epic 6 and project context.

### File List

- _bmad-output/implementation-artifacts/6-4-rework-the-commissioner-hub-into-a-guided-command-center.md
