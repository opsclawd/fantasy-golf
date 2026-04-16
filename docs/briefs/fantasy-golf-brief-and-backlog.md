# Fantasy Golf — Project Brief & Prioritized Backlog

**Date:** 2026-04-16
**Issue:** [OPS-12](/PAP/issues/OPS-12)
**Parent:** [OPS-5](/PAP/issues/OPS-5)
**Author:** Product Planner

---

## 1. Current Product Summary

**What the app does:**
Commissioner-first web app for running private golf pools with live hole-by-hole best-ball scoring.

**Target users:**
- **Commissioner** — Office golf pool organizer who creates/manages pools and shares invite links
- **Player** — Participant who joins via invite link, submits 4-golfer best-ball picks, and monitors leaderboard
- **Spectator** — Anyone who views the public leaderboard without signing in

**Core workflow:**
1. Commissioner creates pool → selects tournament → configures deadline
2. Commissioner shares invite link
3. Players join and submit 4-golfer best-ball entries
4. Picks lock at deadline
5. Hourly cron refreshes scores from Slash Golf API
6. Live leaderboard shows standings with freshness indicators

**Tech stack:** Next.js 14, Supabase (Postgres + Auth + Realtime), Slash Golf API, Tailwind CSS, Vitest

---

## 2. Prioritized Feature Backlog

| # | Feature | Priority | Rationale |
|---|---|---|---|
| 1 | **Hole-by-hole best-ball score display** | High | Design spec exists; increases transparency of how each hole contributes to total score |
| 2 | **Round-by-round golfer detail view** | High | Design spec exists; gives players insight into golfer performance trajectory across rounds |
| 3 | **Pool reuse for future tournaments** | High | Epic 1 story listed but not confirmed built; enables commissioners to re-run pools across tournaments |
| 4 | **Tournament scores per-round overwrite bug fix** | Critical | Solution doc exists; scoring correctness issue that erodes trust |
| 5 | **Pool deadline locking timezone fix** | High | Solution doc exists; edge case causes picks to lock incorrectly for non-UTC commissioners |
| 6 | **On-demand scoring refresh** | Medium | Plan exists; gives commissioners manual control over scoring timing |
| 7 | **Better pick summaries** | Medium | Post-MVP; improves player experience after seeing their picks' performance |
| 8 | **Migration/import tools** | Low | Post-MVP; reduces commissioner friction for initial setup |

---

## 3. Out of Scope (Phase 1)

- PWA offline support
- Social/gamification features
- Multiple pool formats beyond best-ball
- Payment integration

---

*Brief complete. Full analysis available in [fantasy-golf-brownfield-brief.md](./fantasy-golf-brownfield-brief.md).