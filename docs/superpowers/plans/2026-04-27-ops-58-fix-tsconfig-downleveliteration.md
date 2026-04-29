# OPS-58 Fix tsconfig downlevelIteration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `"downlevelIteration": true` to tsconfig.json compilerOptions to fix Map iteration in scoring.ts

**Architecture:** Single-line tsconfig change to enable proper transpilation of `for...of` loops iterating over `Map` entries.

**Tech Stack:** TypeScript, Next.js

---

### Task 1: Add downlevelIteration to tsconfig.json

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Add downlevelIteration to compilerOptions**

Open `tsconfig.json` and add `"downlevelIteration": true` to the `compilerOptions` object. Place it after `"jsx": "preserve"` on line 13.

The resulting `compilerOptions` section should look like:

```json
"compilerOptions": {
  "lib": ["dom", "dom.iterable", "esnext"],
  "allowJs": true,
  "skipLibCheck": true,
  "strict": true,
  "noEmit": true,
  "esModuleInterop": true,
  "module": "esnext",
  "moduleResolution": "bundler",
  "resolveJsonModule": true,
  "isolatedModules": true,
  "jsx": "preserve",
  "incremental": true,
  "downlevelIteration": true,
  "plugins": [{ "name": "next" }],
  "paths": { "@/*": ["./src/*"] }
}
```

- [ ] **Step 2: Verify the change**

Run: `cat tsconfig.json | grep downlevelIteration`
Expected: `"downlevelIteration": true,`

- [ ] **Step 3: Run build to verify fix**

Run: `npm run build`
Expected: Build completes without errors related to Map iteration

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: No new warnings or errors

- [ ] **Step 5: Run tests**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json
git commit -m "fix: add downlevelIteration for Map iteration in scoring.ts"
```

---

## Spec Coverage

- [x] Add `"downlevelIteration": true` to tsconfig.json - Task 1, Step 1
- [x] Verify `npm run build` passes - Task 1, Step 3
- [x] Verify `npm run lint` passes - Task 1, Step 4
- [x] Verify existing tests pass - Task 1, Step 5

## Placeholder Scan

No placeholders found. All steps have exact code and expected outputs.

## Type Consistency

Not applicable - this is a configuration-only change with no code modifications.