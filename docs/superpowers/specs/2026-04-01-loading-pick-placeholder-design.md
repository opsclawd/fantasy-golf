# Loading Pick Placeholder Bug Fix Design

> **Goal:** Selected golfers on the participant picks page should display their names immediately in the current entry summary instead of showing `Loading pick...`.

**Bug Ticket:**
- When a user selects golfers on `/participant/picks/[poolId]`, the current entry summary sometimes renders `Loading pick...` for each selected golfer.
- The page already knows the roster golfer names on the server, so the summary should not depend on an additional client-side lookup for the selected golfers.
- This is a UX bug only. It does not change pick validation, submission, or roster filtering behavior.

**Design:**
- Use the roster names loaded on the server in `src/app/(app)/participant/picks/[poolId]/page.tsx` as the source of truth for selected golfer names.
- Pass a simple `Record<string, string>` name map into `PicksForm`.
- Remove the client-side Supabase fetch from `PicksForm` that tries to hydrate missing golfer names after selection.
- Render the current entry summary directly from the passed-in name map so the display updates immediately when a golfer is selected.
- Keep a minimal fallback for unexpected missing names, but it should not be the normal path for selected golfers.

**Why this approach:**
- It eliminates the async delay that produces the placeholder text.
- It removes a redundant network request from the client.
- It keeps the fix small and localized to the participant picks flow.

**Acceptance Criteria:**
- Selecting a golfer on the participant picks page immediately updates the current entry summary with that golfer’s name.
- The summary no longer shows `Loading pick...` for newly selected golfers during normal use.
- Existing entries still render names correctly when the page loads.
- Submission behavior and pick limits remain unchanged.

**Files In Scope:**
- `src/app/(app)/participant/picks/[poolId]/page.tsx`
- `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx`
- `src/components/SelectionSummaryCard.tsx` if a fallback rendering tweak is needed
- `src/app/(app)/participant/picks/[poolId]/PicksForm.test.tsx` or the nearest existing test coverage for this flow

**Implementation Notes:**
- Prefer the roster map that is already built in the server page.
- Avoid adding a second data source for golfer names in the client.
- Preserve current selection state handling and form submission behavior.

**Testing Notes:**
- Add a test that confirms selected golfer names appear immediately in the current entry summary when the picker state changes.
- Verify the page still renders existing picks with names on first load.
