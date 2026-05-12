# Quality Review: docs/rules-spec.md pseudo-code fix

## Summary
Reviewed the pseudo-code block at lines 29–35 of `docs/rules-spec.md`.

## Findings

**Current state:** The pseudo-code block already correctly describes **hole-by-hole** best-ball scoring:
- Iterates per-hole (not per-round)
- Picks lowest `scoreToPar` among active golfers
- Accumulates best-hole scores
- Tracks birdies/eagles via `scoreToPar < 0`

The implementation matches the conceptual description at line 27: *"For each round, the entry's score is the **lowest `scoreToPar** among all **active** golfers in the entry"* — applied per-hole.

**No changes were required** — the file was already in the correct state.

## Assessment

| Criterion | Status |
|-----------|--------|
| Correctness | PASS — pseudo-code matches hole-by-hole algorithm |
| Consistency | PASS — header, description, and code block are aligned |
| Appropriate for docs | PASS — documentation accurately reflects domain logic |

**Assessment: APPROVED**