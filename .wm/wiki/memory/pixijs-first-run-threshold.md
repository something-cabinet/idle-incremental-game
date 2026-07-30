---
title: "PixiJS First-Run Threshold"
type: memory
tags: [pattern, pixi, onboarding, react]
status: active
---

Gate cinematic PixiJS scenes behind a pure state selector (`isFirstRunArrival`) so returning players pay zero cost. Single ownership: when the threshold owns a story beat, StoryModal must suppress it. Lifecycle: async init with destroyed guard, DPR cap 2, visibility pause, WebGL fallback to CSS gradient + semantic HTML. CTA must always be reachable. Full reference: @wiki/patterns/pixijs-first-run-threshold
