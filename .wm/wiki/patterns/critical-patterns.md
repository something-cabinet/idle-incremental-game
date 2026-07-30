---
title: Critical Patterns
type: pattern
id: wiki:patterns:critical-patterns
tags: [critical]
---

# Critical Patterns

Promoted learnings from completed work. Read this at the start of every session via `wm-init`. These are lessons that cost the most to learn and save the most by knowing.

---

## 2026-07-30 Purposeful Motion Philosophy

**Category:** decision
**Source:** DESIGN.md documentation and polish pass
**Tags:** design-system, motion, animation, accessibility

Every animation must serve one of three purposes: feedback, ceremony, or spatial orientation. Three-tier system: Instant (≤60ms press snap), Fast (100-250ms state transitions, ease-out), Ceremonial (700ms-1.6s celebration). Reduced motion is a first-class system property — every animation has a non-animated end state that carries the same information. No decorative looping animations. This prevents inconsistency, inaccessibility, and jank across all future UI work.

**Full entry:** @wiki/decisions/purposeful-motion-philosophy

---

## 2026-07-30 PixiJS First-Run Threshold Gate

**Category:** pattern
**Source:** Arrival Landing implementation (overdrive + shape)
**Tags:** pixi, onboarding, react, story-modal, gate

When mounting a PixiJS scene as a first-run threshold: (1) Gate with a pure state selector BEFORE any Pixi init — returning players must pay zero cost. (2) Single ownership — if the threshold owns a story beat, StoryModal MUST suppress it or both will render the same beat. (3) CTA must always be reachable regardless of WebGL state — catch init errors and fall back to CSS gradient + semantic HTML. (4) Lifecycle: async init with destroyed ref guard, DPR cap min(dpr, 2), antialias off, visibilitychange pause, full destroy on unmount. This pattern applies to any future cinematic gate (act transitions, ending, prestige ceremony).

**Full entry:** @wiki/patterns/pixijs-first-run-threshold