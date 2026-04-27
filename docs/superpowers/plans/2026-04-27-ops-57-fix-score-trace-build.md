# OPS-57: Fix build failure in score-trace page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix TypeScript type error on line 175 of score-trace page by adding null guards to `ScoreDisplay` call sites.

**Architecture:** Null-coalescing (`?? 0`) on `entry.totalScore` and `row.roundScore` at the two `ScoreDisplay` call sites. No changes to shared `ScoreDisplay` component or to type definitions.

**Tech Stack:** TypeScript, Next.js App Router, React

---

## Task 1: Add null guard on line 175

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx:175`

- [ ] **Step 1: Verify current line 175 content**

Run: `sed -n '175p' src/app/\(app\)/commissioner/pools/\[poolId\]/audit/score-trace/page.tsx`

Expected output:
```
                      Leaderboard score <span className="font-semibold text-gray-900"><ScoreDisplay score={entry.totalScore} /></span>
```

- [ ] **Step 2: Add null guard**

```typescript
                      Leaderboard score <span className="font-semibold text-gray-900"><ScoreDisplay score={entry.totalScore ?? 0} /></span>
```

- [ ] **Step 3: Verify change**

Run: `sed -n '175p' src/app/\(app\)/commissioner/pools/\[poolId\]/audit/score-trace/page.tsx`

Expected output:
```
                      Leaderboard score <span className="font-semibold text-gray-900"><ScoreDisplay score={entry.totalScore ?? 0} /></span>
```

---

## Task 2: Add null guard on lines 209-212

**Files:**
- Modify: `src/app/(app)/commissioner/pools/[poolId]/audit/score-trace/page.tsx:209-212`

- [ ] **Step 1: Verify current lines 209-214**

Run: `sed -n '209,214p' src/app/\(app\)/commissioner/pools/\[poolId\]/audit/score-trace/page.tsx`

Expected output:
```
                                {row.roundScore === null ? (
                                  <span className="text-gray-400">-</span>
                                ) : (
                                  <ScoreDisplay score={row.roundScore} />
                                )}
```

- [ ] **Step 2: Add null guard**

Change:
```
                                {row.roundScore === null ? (
                                  <span className="text-gray-400">-</span>
                                ) : (
                                  <ScoreDisplay score={row.roundScore} />
                                )}
```
To:
```
                                {row.roundScore === null ? (
                                  <span className="text-gray-400">-</span>
                                ) : (
                                  <ScoreDisplay score={row.roundScore ?? 0} />
                                )}
```

- [ ] **Step 3: Verify change**

Run: `sed -n '209,214p' src/app/\(app\)/commissioner/pools/\[poolId\]/audit/score-trace/page.tsx`

Expected output:
```
                                {row.roundScore === null ? (
                                  <span className="text-gray-400">-</span>
                                ) : (
                                  <ScoreDisplay score={row.roundScore ?? 0} />
                                )}
```

---

## Task 3: Verify build passes

- [ ] **Step 1: Run production build**

Run: `npm run build 2>&1`
Expected: Build completes without type errors. No `score-trace/page.tsx` errors.

---

## Task 4: Commit changes

- [ ] **Step 1: Stage and commit**

```bash
git add src/app/\(app\)/commissioner/pools/\[poolId\]/audit/score-trace/page.tsx
git commit -m "OPS-57: null guard ScoreDisplay call sites in score-trace page"
```
Co-Authored-By: Paperclip <noreply@paperclip.ing>