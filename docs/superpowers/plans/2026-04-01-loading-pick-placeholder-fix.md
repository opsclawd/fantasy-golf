# Loading Pick Placeholder Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make selected golfers appear by name immediately in the participant picks current entry summary instead of showing `Loading pick...`.

**Architecture:** The participant picks page already loads roster golfers on the server, so the page should pass a name map into `PicksForm` and let the client render from that local data. The client should keep selection state and submission behavior unchanged, but stop issuing a second Supabase request just to hydrate golfer names.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library, Supabase server/client helpers

---

### Task 1: Pass roster names into the form

**Files:**
- Modify: `src/app/(app)/participant/picks/[poolId]/page.tsx`
- Modify: `src/app/(app)/participant/picks/[poolId]/PicksForm.tsx`

- [ ] **Step 1: Update the page prop contract**

```ts
// src/app/(app)/participant/picks/[poolId]/page.tsx
<PicksForm
  poolId={poolId}
  poolName={pool.name}
  picksPerEntry={pool.picks_per_entry}
  existingGolferIds={existingGolferIds}
  existingGolferNames={existingGolferNames}
  rosterGolferNames={existingGolferNames}
  rosterGolfers={rosterGolfers}
  isLocked={isLocked}
/>
```

- [ ] **Step 2: Update `PicksForm` props and name lookup**

```ts
// src/app/(app)/participant/picks/[poolId]/PicksForm.tsx
type PicksFormProps = {
  poolId: string
  poolName: string
  picksPerEntry: number
  existingGolferIds: string[]
  existingGolferNames: Record<string, string>
  rosterGolferNames: Record<string, string>
  rosterGolfers: Golfer[]
  isLocked: boolean
}

export function PicksForm({
  poolId,
  poolName,
  picksPerEntry,
  existingGolferIds,
  existingGolferNames,
  rosterGolferNames,
  rosterGolfers,
  isLocked,
}: PicksFormProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(existingGolferIds)
  const selectedGolferNames = selectedIds.map((id) => rosterGolferNames[id] ?? existingGolferNames[id] ?? 'Unknown golfer')
```

- [ ] **Step 3: Remove the client Supabase name hydration**

```ts
// src/app/(app)/participant/picks/[poolId]/PicksForm.tsx
import { useFormState, useFormStatus } from 'react-dom'

import { GolferPicker, type Golfer } from '@/components/golfer-picker'
import { SelectionSummaryCard } from '@/components/SelectionSummaryCard'
import { SubmissionConfirmation } from '@/components/SubmissionConfirmation'

import { submitPicks, type SubmitPicksState } from './actions'

// delete:
// import { useEffect, useState } from 'react'
// import { createClient } from '@/lib/supabase/client'
// const [golferNames, setGolferNames] = useState<Record<string, string>>(existingGolferNames)
// the useEffect block that fetches missing names
```

- [ ] **Step 4: Keep the summary wired to the selected IDs**

```ts
// src/app/(app)/participant/picks/[poolId]/PicksForm.tsx
<SelectionSummaryCard
  className="sticky top-3 z-10"
  selectedCount={selectedIds.length}
  requiredCount={picksPerEntry}
  selectedGolferNames={selectedGolferNames}
/>
```

- [ ] **Step 5: Verify the relevant test target still compiles conceptually**

Run: `npm test -- src/app/(app)/participant/picks/[poolId]/PicksForm.test.tsx`
Expected: the file still imports and renders `PicksForm` with the new prop.

### Task 2: Update the participant picks test coverage

**Files:**
- Modify: `src/app/(app)/participant/picks/[poolId]/PicksForm.test.tsx`

- [ ] **Step 1: Remove the Supabase client mock from the test**

```ts
// src/app/(app)/participant/picks/[poolId]/PicksForm.test.tsx
// delete the vi.mock('@/lib/supabase/client', ...) block
```

- [ ] **Step 2: Pass roster names into the rendered form**

```tsx
render(
  <PicksForm
    poolId="pool-1"
    poolName="Spring Major Pool"
    picksPerEntry={3}
    existingGolferIds={['g1', 'g2', 'g3']}
    existingGolferNames={{
      g1: 'Scottie Scheffler',
      g2: 'Rory McIlroy',
      g3: 'Nelly Korda',
    }}
    rosterGolferNames={{
      g1: 'Scottie Scheffler',
      g2: 'Rory McIlroy',
      g3: 'Nelly Korda',
      g4: 'Lydia Ko',
    }}
    rosterGolfers={[]}
    isLocked={false}
  />,
)
```

- [ ] **Step 3: Add an assertion for immediate name rendering after selection changes**

```ts
fireEvent.click(screen.getByRole('button', { name: 'Replace final golfer' }))

await waitFor(() => {
  expect(within(summary).getByText('Lydia Ko')).toBeInTheDocument()
})

expect(within(summary).queryByText('Loading pick...')).not.toBeInTheDocument()
```

- [ ] **Step 4: Run the focused test file**

Run: `npm test -- src/app/(app)/participant/picks/[poolId]/PicksForm.test.tsx`
Expected: PASS.

### Task 3: Run verification on the flow

**Files:**
- No code changes

- [ ] **Step 1: Run the participant picks test plus a quick related check**

Run: `npm test -- src/app/(app)/participant/picks/[poolId]/PicksForm.test.tsx src/components/__tests__/PicksFlowPresentation.test.tsx`
Expected: PASS.

- [ ] **Step 2: Review the diff for accidental scope creep**

Run: `git diff -- src/app/(app)/participant/picks/[poolId]/page.tsx src/app/(app)/participant/picks/[poolId]/PicksForm.tsx src/app/(app)/participant/picks/[poolId]/PicksForm.test.tsx`
Expected: only the roster-name propagation, client-fetch removal, and test updates are present.

- [ ] **Step 3: Commit the completed fix**

```bash
git add src/app/(app)/participant/picks/[poolId]/page.tsx src/app/(app)/participant/picks/[poolId]/PicksForm.tsx src/app/(app)/participant/picks/[poolId]/PicksForm.test.tsx docs/superpowers/specs/2026-04-01-loading-pick-placeholder-design.md docs/superpowers/plans/2026-04-01-loading-pick-placeholder-fix.md
git commit -m "fix: show selected golfer names immediately"
```
