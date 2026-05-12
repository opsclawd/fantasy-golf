# Spec Review: docs/rules-spec.md pseudo-code block (Task 4)

## Requirement
Replace the pseudo-code block at lines 29–35 with hole-by-hole best-ball algorithm text.

## Verification

**Lines 29–35 in docs/rules-spec.md:**
```
For each regulation hole in each counted round:
  1. Look at the selected golfers in the entry who are active.
  2. Use the lowest score-to-par among golfers with a valid score for that hole.
  3. Add that best hole score to the entry total.
  4. Count birdies/eagles as scoreToPar < 0 for the best-ball hole result.
```

**Required replacement text:**
```
For each regulation hole in each counted round:
  1. Look at the selected golfers in the entry who are active.
  2. Use the lowest score-to-par among golfers with a valid score for that hole.
  3. Add that best hole score to the entry total.
  4. Count birdies/eagles as scoreToPar < 0 for the best-ball hole result.
```

## Result

✅ Spec compliant

The pseudo-code block at lines 29–35 already exactly matched the required replacement text prior to any edits. No changes were needed — the file was already correct.

**Files changed:** None (content already correct)
