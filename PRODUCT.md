# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + TypeScript + Vite · Pixi.js v8 for town overview canvas layer

## Users

**Primary:** Idle/incremental game fans who also enjoy narrative-driven experiences and RPG-lite loot/management depth. The game bridges two overlapping audiences:

- Fans of finite story-driven idle games (Spaceplan, Universal Paperclips) who want a crafted arc with paradigm shifts and a real ending.
- Fans of RPG-lite guild management — equipment, stats, character progression — who want that depth inside an idle wrapper.

The player's job is to grow from a refugee into a guild leader, manage adventurers and resources across escalating acts, and reach a satisfying narrative conclusion.

## Product Purpose

Guild of Second Chances is a narrative RPG management idle game with a finite, replayable arc. The player flees to a small town, builds a guild, recruits adventurers, and ultimately travels through time to avert a catastrophe — experiencing meaningful mechanical shifts between acts rather than infinite number scaling.

## Positioning

A narrative idle game that treats its RPG layer (distinct adventurers with stats, equipment, classes, injuries, and recovery) as a first-class system rather than a skin on a clicker — while keeping the story finite, the numbers grounded, and the ending purposeful. The paradigm-shift structure of Spaceplan/Universal Paperclips meets the character-and-loot depth of a lightweight RPG roster.

## Operating Context

- Browser-based (web app, no install required).
- Played in sessions — active management bursts followed by idle/wait phases where pacing and narrative tension live.
- No always-on connection requirement (single-player, local state with platform storage).
- Designed for casual attention: check in, assign quests/patrols, manage equipment, close and return later.

## Capabilities and Constraints

**Confirmed:**
- Three-act structure: Refugee (click/generator loop) → Guild Leader (adventurers, equipment, locations, quests/patrols) → Revenge & Time Travel (expeditions, prestige via Time Shards).
- Finite ending achievable after a few prestige cycles — the demon king has a time limit (in-game days).
- One main resource (gold) plus sub-resources (materials, monster drops).
- Numbers stay relatively low — no scientific notation needed.
- Adventurer roster grows from 2 to ~8; characters are randomly generated with distinct stats and equipment.
- Two assignment modes: Quest (timed, big rewards) and Patrol (infinite, XP + materials, rare equipment).
- Combat risk: injury only — lost fights injure adventurers who rest and recover over time. No permadeath.
- Prestige currency: Time Shards persist across timelines, buy permanent perks/multipliers.
- Codebase: React + TypeScript + Vite, Pixi.js v8 (town overview layer).
- Game logic is pure TypeScript (no React dependency) in `src/game/`.
- Existing UI implementation at `src/ui/` with a detailed UI/UX spec at `docs/ui-spec-v2.md`.
- Balance numbers in code are AI-proposed placeholders — subject to playtesting.

**Undecided / Open:**
- Whether to ship with a sound/music system.
- Offline progress formula details (how much progress accrues while away).
- Town overview canvas (Pixi.js layer): scope, interactivity, and visual complexity.
- Exact number of prestige cycles needed to reach the ending.
- Post-launch content or endings.

## Brand Commitments

- **Name:** Guild of Second Chances
- **Voice:** Not yet formally defined, but the tone established in design docs suggests a surface of fantasy-guild gravitas with underlying warmth — a game about second chances, found family, and defiant hope against overwhelming odds. The Spaceplan framework notes also point to absurdist/comedic surface as a viable tone for a finite idle game; this is an open decision.
- **Assets:** None beyond code assets. No logo, no marketing copy, no press materials.

## Evidence on Hand

- `docs/game-design.md` — Canonical design document with act-by-act mechanics.
- `docs/spaceplan-framework-notes.md` — Research and pattern analysis behind the paradigm-shift structure.
- `docs/ui-spec-v2.md` — Detailed UI/UX specification (1.3k lines, post-audit).
- `docs/design-research-idle-games.md` — Broader idle game design research.
- Full playable (in-development) codebase at `src/`.

No playtest data, analytics, or user research exists yet.

## Product Principles

1. **Narrative drives mechanics.** Story beats gate new acts and systems — not number thresholds. The ending is designed first, and everything builds toward it.
2. **Paradigm shifts over infinite scaling.** Each act recontextualizes what the numbers mean and what decisions matter. The core interaction stays simple; the *meaning* of progress evolves.
3. **Finite, purposeful experience.** The game has a designed ending after a few prestiges. This is not an infinite live-service loop — the trade-off is a strong once-through arc over long-tail replayability.
4. **RPG depth as identity, not decoration.** Distinct adventurers, equipment with scaling and rarities, stats that matter, injuries with consequences — the systems-layer is substantial enough to reward optimization without overwhelming the idle cadence.
5. **Idle-friendly, never idle-gated.** Active play accelerates progress but never gates it. The game respects the player's time away and treats idle stretches as narrative pacing beats.
