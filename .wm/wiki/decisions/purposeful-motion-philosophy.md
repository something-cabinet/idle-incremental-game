---
title: Decision: Purposeful Motion Philosophy
type: decision
id: wiki:decisions:purposeful-motion-philosophy
tags: [decision, motion, animation, design-system]
---

## Context

Guild of Second Chances needed a coherent animation philosophy. The codebase had various animations (click-pop float, toast enter/exit, ascension celebration, battle lunge/impact, state transitions) but no documented principles governing when, how, and why motion is used. Without a philosophy, new animations risk being decorative, inconsistent, or inaccessible.

## Decision

Adopt a **Purposeful Motion** philosophy: every animation must serve one of three explicit purposes — feedback, ceremony, or spatial orientation. Decorative looping animations (idle spinners, rotating icons, background parallax) are banned.

### The Three-Tier Motion System

| Tier | Duration | Easing | Purpose |
|------|----------|--------|---------|
| **Instant** | ≤60ms | None (transform snap) | Press feedback — action and acknowledgment must feel simultaneous |
| **Fast** | 100–250ms | ease-out (decelerate) | State transitions — hover, focus, toggle, border/color shifts |
| **Ceremonial** | 700ms–1.6s | ease-out or custom spring | Celebration moments — ascension, click-pop float, sparkle trails |

### Easing Philosophy
- `ease-out` is the default for all authored motion. Elements decelerate to a stop.
- No bounce or overshoot unless the moment is explicitly celebratory.
- The single exception: ascension pop-in uses a spring-like overshoot (`cubic-bezier(0.34, 1.56, 0.64, 1)`) because it is rare and earned.

### Reduced Motion as First-Class State
- Reduced motion is NOT an afterthought. Every animated element has a non-animated end state carrying the same information.
- The `.reduced-motion` class kills ALL keyframe animations.
- Fallback: opacity transitions replace slide/fade keyframe animations.
- System-level `@media (prefers-reduced-motion: reduce)` acts as an automatic override.

### Trigger Map
Every animation must have a clear trigger and defined end state. Keyframe animations are reserved for events that happen, complete, and are done — not for persistent state.

### Named Rules
- **The Decoration Rule:** If an animation cannot be named by what it communicates (press feedback, state change, ceremony, spatial orientation), it does not belong.
- **The Reduced Motion Invariant:** Every animated element has a non-animated end state that carries the same information. The reduced-motion path is not a degraded experience; it is the same experience without motion.

## Rationale

1. **User trust:** Motion that serves a purpose (acknowledging input, showing progress, marking ceremony) builds user confidence. Decorative motion erodes it.
2. **Accessibility:** Making reduced motion a first-class system property (not a post-hoc patch) ensures no one gets a broken experience.
3. **Performance:** Limiting animation to specific purposes prevents the cumulative layout shift and jank that comes from scattering transitions everywhere.
4. **Brand coherence:** Purposeful motion reinforces the "Guild Hall Fire" North Star — warm, grounded, ceremonial — rather than undercutting it with flashy effects.

## Consequences

- New UI elements must declare their motion purpose before implementation.
- Any animation that doesn't fit the three tiers or trigger map is rejected in review.
- The reduced-motion invariant adds a small implementation cost per animation but prevents accessibility regressions.
- The ban on decorative looping animations keeps the system lean and focused.
