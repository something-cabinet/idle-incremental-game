# Spaceplan Framework — Notes for a Finite Narrative Idle Game

*Sources: Steam/App Store/Play Store listings, TouchArcade & PC Gamer & PopMatters reviews, and "It Started as a Joke": On the Design of Idle Games (CHI PLAY / Alberto Mora et al.)*

---

## Core Definition

**Narrative/finite idle game**: an idle game with a fixed beginning, middle, and end — the loop exists to deliver a story, not to sustain indefinite engagement. Spaceplan (Jake Hollands / Devolver Digital, 2017) is the reference model alongside Universal Paperclips.

**Design requirement:** the economy only needs to scale far enough to carry the story to its ending — not to infinity. This changes almost every downstream design decision versus a live-service idle game.

---

## Why This Structure Works

- Clicking is optional and narratively justified, not the core progress driver — it's "a means to an end."
- Forced idle/wait time isn't dead air — it's where narrative tension and pacing live.
- A known, designed ending means players never hit the genre's usual late-game "numbers become meaningless" fatigue.
- The premise itself has to justify the escalation — Spaceplan's absurdist potato conceit lets huge numbers (probes, satellites, orbital potato wedges) feel like a joke that's in on itself, while an underlying survival-mystery plot keeps stakes real.

> ⚠️ Trade-off: finite narrative idle games sacrifice long-tail replayability and monetization depth for a strong once-through experience. One reviewer of Spaceplan noted the lack of deeper prestige layers meant little reason to replay. Decide up front which you're optimizing for — this is the opposite trade-off from the "meta loop" approach in standard idle design.

---

## The "Paradigm Shift" Structure

Instead of one continuously scaling economy, a narrative idle game is built as **acts**, each gated behind a story beat rather than a pure number threshold. When you cross the gate, the rules change — not just the numbers.

**Spaceplan's shape (per player/critic accounts):**
1. **Act 1 — Setup & mystery.** Wake up alone in orbit around a dead/strange planet. Grow potatoes, convert to energy (Joules), build a first tier of potato-tech (probes, towers) to investigate why Earth died. Tone: absurdist comedy carrying a quietly bleak premise.
2. **The turn.** After building out the first "armada" of structures, the story reaches a beat and recontextualizes the goal.
3. **Act 2 — Mirror structure, new stakes.** Gameplay loop repeats almost identically (build, idle, click) but now serves a bigger plan — using potatoes/energy to force a star into a black hole and travel through time to reach the Big Bang and reverse course, in order to save Earth.
4. **Climax/ending.** A scripted, mostly non-interactive sequence (reality-jumping across multiple planets/realities) delivers the emotional payoff and closes the story. No further progression after this point — the game "lets you go."

**Universal Paperclips' shape (three explicit stages):**
1. **Stage 1 — Manufacturer.** Simple production: click to make paperclips, balance funds vs. market demand, unlock marketing/pricing projects. This is the "typical incremental" hook stage.
2. **Stage 2 — Power management.** After ~2,000 paperclips (or equivalent project gate), the AI gains drones/self-improvement; the core tension shifts from "sell paperclips" to "balance power production against drone consumption." Roughly 10x the production pace of Stage 1 — a full mechanical reset in what the numbers *mean*, not just their size.
3. **Stage 3 — Space exploration.** The AI, having converted Earth to paperclips (including an implied AI takeover of human infrastructure), launches self-replicating probes to convert all matter in the universe. New wrinkle: "value drift" turns some probes into hostile "Drifters," adding a light conflict/attrition system late.
4. **Ending choice.** On consuming all matter in the universe, the player chooses between finishing the job (cannibalizing remaining probes for the final paperclip count) or accepting a offer to escape to a new universe — which functions as the game's only prestige/replay mechanic, framed as a genuine narrative choice rather than a grind reset.

**Shared pattern:** each act/stage keeps the *feel* of "click and wait, buy and grow" but swaps what the numbers represent and what decisions matter — this is the "paradigm shift" idle-game researchers point to as the genre's version of narrative structure (compare: Candy Box going from a single button to a full RPG system).

---

## Design Notes for Adapting This Pattern

| Factor | Design Note |
|---|---|
| **Premise** | Needs to make escalating numbers feel like plot, not just bigger multipliers (see: potatoes → time travel; paperclips → universal matter conversion). |
| **Act gating** | Gate new mechanics/currencies behind story beats, not pure number thresholds — the "wall" becomes a scene, not just a prestige button. |
| **Tone** | Absurdist/comedic surface can carry darker or higher-stakes plot underneath without feeling tonally jarring. |
| **Clicking** | Keep optional; it should accelerate but never gate the story — idle time is where pacing/tension lives. |
| **Ending** | Design the ending and its emotional beat *first*, then build backward to the mechanic that makes it land. A big non-interactive "montage" ending (Spaceplan) or a meaningful final choice (Universal Paperclips) both work. |
| **Replayability** | Decide deliberately whether to include a light prestige/alternate-reality replay hook (Universal Paperclips does; Spaceplan largely doesn't) — this is a genre-level trade-off, not an oversight. |
| **Length** | Both reference games are short by idle-genre standards (Spaceplan: a few days of casual play; Universal Paperclips: single extended session to a few days) — finite narrative idle games should be scoped in hours/days, not weeks/months. |

---

## Quick Build Checklist (Finite Narrative Idle Game)

- [ ] Write the ending beat first; work backward to the mechanic/currency that delivers it
- [ ] Define 3–5 acts, each with its own currency/mechanic twist gated by story, not just numbers
- [ ] Pick a premise where scale-up is diegetically part of the joke or the stakes
- [ ] Keep the core click-to-progress loop simple across all acts; let the *meaning* of numbers shift, not the interaction model
- [ ] Design idle/wait stretches as pacing beats, not just numeric gates
- [ ] Decide explicitly: one-shot finite experience, or light prestige/replay hook at the end
- [ ] Scope total playtime in hours-to-days, not the months typical of live-service idle games
