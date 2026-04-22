# Phase 2 Telemetry

Tracking Planner phase outcomes for experiment analysis.

---

## PAP-18 — Phase 2 — Hole-Level Scoring Domain

```
story_id: pap-18
planner_cycles: 1
planner_tokens: 45000
planner_escalations: 0
design_doc_length_lines: 138
plan_task_count: 3
assumptions_logged: 2

```

Notes:
- `planner_cycles: 1` — went straight from wake to implementation, no clarification cycles
- `planner_escalations: 0` — no escalations to Board; technical decisions documented in design doc
- `assumptions_logged: 2` — (1) scorecard ingestion out of scope for this phase, (2) roundId serves as primary dimension until hole-level data arrives
- `plan_task_count: 3` — domain.ts fix, scoring-refresh.ts fix, test updates

---

## PAP-18 — Builder Phase

```
story_id: pap-18
builder_cycles: 1
builder_tokens: 85000
tests_written: 0
red_green_cycles: 0
files_touched: 2
escalations_to_planner: 0
blockers_hit: 0
```

Notes:
- `tests_written: 0` — three targeted bug fixes; existing test fixtures already cover the behavior under the new threshold
- `red_green_cycles: 0` — no new behavior; threshold loosening and field addition are not new features
- `files_touched: 2` — domain.ts (isBirdie + completedHoles), scoring-refresh.ts (isComplete)
- `builder_cycles: 1` — went straight from plan to committed code, no iteration