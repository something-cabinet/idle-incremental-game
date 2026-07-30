---
title: "Decision: First-Run Arrival Threshold"
type: decision
id: wiki:decisions:first-run-arrival-threshold
tags: [decision, onboarding, ux, pixi, landing]
status: approved
relates_to:
  - {type: relates_to, target: wiki:patterns:pixijs-first-run-threshold}
  - {type: relates_to, target: wiki:decisions:purposeful-motion-philosophy}
---

## Context

The game's original first-run flow was: open → StoryModal ("Ashes Behind You") → dismiss → land on Overview tab (a dashboard of zeros) → find Town tab → find Work Odd Jobs button. A critique (2026-07-30) identified this as a 5-step funnel with no visual anchor, no worldbuilding, and no immediate call to action. Seven zeros on first load communicated "you have nothing" with no instruction on how to stop having nothing.

The concept-seed process (key `6ec6403f`, scope `surface`, mode `persuade`, assigned index 6) resolved the structural direction: a procedural PixiJS threshold.

## Decision

Replace the StoryModal-based first-run flow with a **cinematic landing threshold** ("The Lantern Road") that:

1. Shows the refugee road toward a firelit town — the Guild Hall Fire world seen from outside
2. Carries canonical "Ashes Behind You" narrative copy as semantic HTML
3. Provides one CTA ("Walk into town") that dismisses the beat AND navigates to Town
4. Never appears for returning players, prestige loops, or any later story beat
5. Existing StoryModal handles all other beats unchanged

## Rationale

- **Collapse the funnel:** read → one CTA → act. One gesture instead of five.
- **Worldbuild in the first frame:** The player sees the world before they see any numbers. The road establishes "you are going somewhere" before the zeros appear.
- **Preserve the operating shell:** Returning players (the vast majority of sessions) pay zero cost. The gate is a single boolean check.
- **Honor existing architecture:** The a1-arrival beat already exists. The threshold is a better renderer for it, not a new mechanism.
- **Reduced motion safe:** Still frame + CTA works identically. No blank, no broken state.

### Alternatives considered

| Option | Rejected because |
|--------|-----------------|
| Keep StoryModal but add imagery | Modals are interruption UI; a first impression shouldn't feel like something to dismiss |
| Redirect to a separate /intro route | Adds routing complexity; game is a SPA with no router |
| Auto-play a video/animation | Not procedural, not responsive, massive asset weight, no interactivity |
| Animated onboarding carousel | Category default; communicates "tutorial" not "you are here" |

## Consequences

- `StoryModal` must suppress `a1-arrival` when `isFirstRunArrival(state)` is true — single ownership is critical.
- PixiJS bundle is already loaded (used by BattleViewer), so no new dependency cost.
- The threshold is Persuade mode; the game shell is Operate mode. These coexist on one page with clean handoff.
- Future story beats (a2, a3, prestige) continue using the lightweight StoryModal — no scope creep.
- If a future redesign wants to remove the threshold, delete `ArrivalLanding.tsx`, remove the StoryModal suppression, and the original flow returns automatically.

## Related

- `src/ui/ArrivalLanding.tsx` — implementation
- `src/game/story.ts` — `isFirstRunArrival` gate
- Concept seed: key `6ec6403f`, index 6
