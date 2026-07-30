---
{}
relates_to:
  - {type: relates_to, target: wiki:decisions:purposeful-motion-philosophy}
---

---
title: Pattern: Bounded Polish Pass
type: pattern
id: wiki:patterns:bounded-polish-pass
tags: [pattern, design, workflow]
---

## Problem

UI polish work can become an open-ended loop of "one more fix" that burns budget without clear shipping criteria. Without structure, polish suffers from:

- Fixing one corner while leaving surrounding areas below the same bar
- Scope creep — turning polish into concealed redesign
- Endless screenshot-and-tweak cycles

## Solution

A **bounded polish pass** — one tight cycle of inspect → triage → fix → verify. No second guessing, no "while I'm here" refactoring.

### Steps

1. **Establish the system** — Read DESIGN.md (or extract tokens from CSS if none exists). Know the intended visual world before judging deviations.
2. **Gather evidence** — Take screenshots at representative sizes (desktop + mobile). Get computed styles for key elements (body, rows, buttons, modals). This is your baseline — don't rely on memory.
3. **Triage** — Classify each drift:
   - **P0 (broken):** functional defects, blocked tasks, data loss, inaccessible paths
   - **P1 (bad):** misleading states, missing states (loading/empty/error/disabled), contrast failures
   - **P2 (minor):** flow/hierarchy drift, design system inconsistency, responsive issues
   - **P3 (cosmetic):** visual nits, spacing tweaks, alignment polish
   
   Fix in priority order. Do NOT fix P3 while P0-P1 remain unaddressed.
4. **Polish the whole path** — Fix by category, not by element:
   - Flow & hierarchy first (the user's journey)
   - Layout & type (spacing, measure, alignment)
   - Color, imagery, icons (token usage, contrast, consistency)
   - Interaction & state (hover, focus, disabled, loading, error, success)
   - Content & code (copy consistency, dead code removal)
5. **Verify in one pass** — One screenshot round (desktop + mobile) to confirm all fixes. Fix everything it shows in one batch. At most one more confirmation round. Stop.

### When to Use

- Before shipping any UI change
- After a feature implementation is functionally complete
- When a prior critique exists and its findings need resolution
- As part of a release QA pass

### When Not to Use

- During active feature development (polish is a separate phase, not done in-flight)
- When the concept itself is wrong — recommend redesign or `bolder` instead of polishing a bad direction
- For one-off micro-edits that don't need the full cycle

### Key Principles

- **Refinement, not redesign.** Polish preserves the incumbent visual world, content, behavior, and scope. If something is fundamentally wrong, say so and recommend a different command.
- **Batch fixes, don't scatter.** Fix every issue of a category at once, not one element at a time. Do not perfect one section while leaving the rest below bar.
- **One verification round.** Screenshot both desktop and mobile. Fix everything the screenshots reveal in one batch. Confirm with at most one more round. Stop. Open-ended QA burns budget.
- **Clean the diff.** Remove accidental churn, orphaned styles, temporary artifacts. Ship only what's finished.