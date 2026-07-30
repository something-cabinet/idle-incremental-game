---
title: "Pattern: PixiJS First-Run Threshold"
type: pattern
id: wiki:patterns:pixijs-first-run-threshold
tags: [pattern, pixi, landing, onboarding, react]
relates_to:
  - {type: relates_to, target: wiki:decisions:first-run-arrival-threshold}
  - {type: relates_to, target: wiki:decisions:purposeful-motion-philosophy}
---

## Problem

Idle/incremental games open with a narrative beat dismissed via a modal, dumping the player into a dashboard full of zeros. The first impression communicates nothing about the game's world and provides no spatial anchor for the player's journey. The verb (the action that makes things happen) is hidden behind a tab switch.

## Solution

A **gated full-viewport PixiJS threshold** that:
1. Gates on a pure state selector (`isFirstRunArrival(state)`) — never mounts for returning players
2. Renders a procedural scene as authored atmosphere (not decoration)
3. Overlays semantic HTML carrying all meaning (title, story copy, CTA)
4. Dismisses the canonical story beat AND navigates to the action in one gesture
5. Falls back gracefully: WebGL failure shows a CSS gradient; reduced-motion renders a still frame

### Architecture

```
ArrivalLanding (gate component)
├── LandingScene (mounts only when gate is true)
│   ├── PixiJS Application (async init, DPR capped at 2)
│   │   ├── Sky/horizon layers (Graphics primitives)
│   │   ├── Town silhouette with lit windows
│   │   ├── Perspective road with lantern posts
│   │   ├── Foreground terrain edges
│   │   └── Ember particle system (ticker-driven, killed under reduced-motion)
│   └── Semantic HTML overlay (role=dialog, aria-modal, focus trap)
│       ├── h1 — game title (sole Cinzel Display element)
│       ├── h2 + p — canonical story beat copy
│       └── button.arrival-cta — "Walk into town" (autoFocus)
└── null (when gate is false — zero cost for returning players)
```

### Key Implementation Details

- **Gate before init:** Check `isFirstRunArrival(state)` before any PixiJS code runs. Returning players pay zero bundle cost beyond a single boolean check.
- **Single ownership:** When the threshold owns a story beat, `StoryModal` must suppress it to prevent duplicate presentation.
- **Lifecycle mirrors BattleViewer:** async `app.init()` with a `destroyed` ref guard, canvas appended to a div ref, teardown removes canvas and calls `app.destroy(true)`.
- **Visibility pause:** `document.visibilitychange` stops/starts the ticker to prevent background GPU burn.
- **Pointer parallax:** Subtle stage offset (±6px X, ±4px Y) creates depth without being a decorative loop — it responds to the player occupying the space.
- **CTA always reachable:** Even if WebGL fails entirely, the semantic overlay with its CSS gradient fallback renders the full experience minus the canvas.

### Gate Function

```typescript
export function isFirstRunArrival(state: GameState): boolean {
  return (
    state.act === 1 &&
    state.prestigeCount === 0 &&
    !state.storyFlags['a1-arrival'] &&
    state.pendingStories.includes('a1-arrival')
  );
}
```

## When to Use

- Adding a narrative threshold to a game or app that has a "first-run story" mechanic
- Building a cinematic intro that must not slow down returning users
- Integrating PixiJS procedural scenes into a React app with proper lifecycle management

## When Not to Use

- Simple onboarding that doesn't need a full-viewport scene (use a modal or inline card)
- When the first-run state can't be reliably detected from app state
- When the app has no narrative copy to carry — a procedural scene alone without semantic meaning is decoration

## Related

- `src/ui/ArrivalLanding.tsx` — implementation
- `src/game/story.ts` — gate function `isFirstRunArrival`
- `src/ui/BattleViewer.tsx` — sibling PixiJS lifecycle pattern
