---
target: overview
total_score: 17
max_score: 32
na_heuristics: 5,9
p0_count: 0
p1_count: 3
timestamp: 2026-07-30T10-36-41Z
slug: src-ui-panels-overviewpanel-tsx
---
Method: dual-agent (A: assessment_a_design_review · B: assessment_b_detector_browser)

Surface mode: Operate. Target: `src/ui/panels/OverviewPanel.tsx` (+ `src/App.css`).
Evidence: source review of the panel, `App.css`, sibling panels and `docs/ui-spec-v2.md`; `detect.mjs` over panel and stylesheet; Playwright captures at 1440×900 and 390×844 in first-run (Act I) and seeded (Act III, 3 champions, 42 shards, prestige #4, populated log) states, plus Records and Timeline subtabs; in-page detector overlay injected and read from the console.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | The panel's core job, done well — act, day, elapsed, income, roster split, next unlocks. Gaps: no offline/welcome-back summary lands here, and milestone completion produces no feedback at all. |
| 2 | Match System / Real World | 3 | Strong voice ("Odd Jobs Worked", "Great Foes Felled", "Nothing posted — the board is empty"). But Quest Board's `Cost /s` is ambiguous, and the Champions vs Adventurers distinction is never explained. |
| 3 | User Control and Freedom | 2 | Subtabs are the only control and they persist correctly. Everything else is a dead end: five milestones name destinations you cannot reach from here. |
| 4 | Consistency and Standards | 3 | Sibling-panel consistency is airtight; the panel's own CSS is clean under the detector. The `.log-*` kind → color contract has drifted from the kinds the game actually emits. |
| 5 | Error Prevention | n/a | Read-only derived view. No inputs, no destructive actions, nothing to guard. |
| 6 | Recognition Rather Than Recall | 2 | Reputation thresholds carry no scale reference, milestones name places with no route, no tooltip anywhere. To act on anything here the player must carry it to another tab from memory. |
| 7 | Flexibility and Efficiency | 1 | No keyboard navigation, no log filtering, no history beyond 12 entries, no jump-to-action. One rigid read path. |
| 8 | Aesthetic and Minimalist Design | 2 | 27 stat cells across the two subtabs at identical visual weight — the Visual Noise Floor. Zeros are rendered as loudly as records. |
| 9 | Error Recovery | n/a | No failure states exist in this surface; every value is derived from `GameState` or a pure helper. |
| 10 | Help and Documentation | 1 | The Records intro line and the empty-board copy are the only contextual help in the panel. No legend for log colors, no explanation of Reputation, Adventurers, or Time Shards. |
| **Total** | | **17/32** | **Acceptable (53%) — bottom of the band** |

Heuristics 5 and 9 scored `n/a`; total renormalized to 32.

## Design Specificity Verdict

**LLM assessment (unanchored):** This is a category-interchangeable admin dashboard wearing the Guild Hall Fire palette. Strip the color tokens and seven `.detail-stats` grids of label-over-number cells would sit unchanged in a SaaS billing console. Of all five tabs this one carries the least product character, which is a structural irony: the Overview is the first thing a new player sees and the tab they return to after every idle stretch, and it is the tab that says least about what game this is.

The character is not absent — it is confined to strings. `Act III — The Long Way Back`, `Odd Jobs Worked`, `Great Foes Felled`, `Totals across every timeline you've lived — they survive time travel`, `0 out on assignment · 1 recovering · 2 idle`. Every one of those is authored. None of them is *designed*; they are all rendered in the same 0.66rem uppercase label or 0.85rem body as the numbers around them. The panel has one composition idea (grid of cells) applied seven times.

The most concrete missed opportunity: the design system defines a Display tier — Cinzel, `clamp(1.5rem, 4vw, 2.4rem)`, tabular-nums, explicitly for "gold resource amounts, story titles, ceremonial headers" — and this panel uses it zero times. `.overview-hero-title` renders "Act III — The Long Way Back" in bold Source Sans. The ceremonial voice exists in the system and never speaks on the surface that most needs it.

**Deterministic scan:** `detect.mjs` on the panel alone: **exit 0, clean** — the JSX has no detectable anti-patterns. Panel + stylesheet: **exit 2, 42 findings, all in `src/App.css`** (5 warnings, 37 advisories). Cross-checked every one against DESIGN.md:

- **All 5 warnings are false positives as slop.** The three `border-left: 3px solid` hits are the documented Perk/Skill row pattern; `cubic-bezier(0.34, 1.56, 0.64, 1)` is named in DESIGN.md as the one earned ascension exception; `transition: width` is the documented linear progress fill. The brief wins.
- **27 of 37 advisories are sidecar gaps, not drift** — values documented in DESIGN.md prose or the YAML `components:` block that the detector misses because it only scans the `colors:`/`rounded:` token maps (`#703038` danger border, `#2a2410` click-button gradient, `999px` perk pill, `3px` progress track, `13px` toggle, and so on).
- **10 findings are genuine drift**, none of them in this panel: three undocumented `var(--x, fallback)` literals (`#e0b64a`, `#4a7fd0`, `#d8a24a`), a 4px `.stat-bar-track` radius, a 6px control at App.css:1364, and — the two most substantive — the prestige currency banner (App.css:1615) and ending banner (App.css:1654) at `12px` where DESIGN.md's Shapes section explicitly specifies 14px.

The detector caught nothing in the Overview that the design review missed, and the design review caught the two things that matter most (no hierarchy, no ceremony) which no rule engine can see. Console was clean across all four browser contexts — no React warnings, no page errors.

**Visual overlay:** the in-page detector injected successfully and reported `[impeccable] 7 anti-patterns found` against the live seeded DOM. **This was observed inside headless Chromium only — nothing was presented in a visible browser tab, so there is no overlay for you to look at.** The live server was stopped.

## Overall Impression

The engineering discipline here is real and visible: act-gated progressive disclosure is genuinely well thought out, every number is derived rather than tracked, the CSS comments reason about contrast, and sibling consistency holds. What's missing is a point of view about what this screen is *for*.

Right now it answers "what are all my numbers?" A player opening the game after four hours away is asking three different questions: *what happened while I was gone, how am I doing, and what do I do next.* The panel answers none of them first, because it answers all of them at flat priority.

The single biggest opportunity: **the hero block should be the only thing on screen that matters at a glance, and it currently repeats the header.** In the seeded desktop capture, the sticky header shows `128.1K +12/s`, `⭐850`, `⧗42`, `Day 267`. Two hundred pixels below it, the hero and its stat row show Act III, `Day 267`, `128.1K` Gold, `12/s` Income, `42` Time Shards — and The Guild section adds `850` Reputation. Five of the six values in the header are restated within one scroll of themselves, at similar weight. That redundancy is where the hierarchy budget went.

## What's Working

**Act-aware progressive disclosure.** `GuildSection`, `QuestBoardSection` and the zone/dungeon stat block are gated behind `state.act >= 2`, and the code comment says why: "The wilds don't exist for the player until the guild does — Act 1 shouldn't spoil zone or dungeon counts." That is narrative design expressed as a render condition, and it is the most product-specific decision in the file. It also rescues the first-run experience from a wall of meaningless zeros.

**The voice, where it is allowed to speak.** `0 out on assignment · 1 recovering · 2 idle` is a sentence, not a stat grid, and it communicates the roster's state faster than the three cells above it. `Totals across every timeline you've lived — they survive time travel` explains a prestige mechanic in eleven words. These two lines prove the panel already knows how to sound like this game.

**Read-only as a deliberate constraint.** The file's header comment commits to it: no actions, nothing new tracked for display. That discipline is why the panel has zero error states and zero stale-data bugs, and it is worth preserving even as the recommendations below add navigation.

## Priority Issues

**[P1] The hero restates the header instead of leading**
- **Why it matters:** The most valuable pixels in the panel spend themselves repeating gold, income, shards and day from the sticky bar directly above. A returning player gets no single focal point and no answer to "how am I doing" — just the same numbers twice at the same weight. The Display type tier that exists for exactly this moment goes unused.
- **Fix:** Rebuild `.overview-hero` as the panel's one Display-tier moment. Put the act title in Cinzel (`font-display`, headline clamp) and promote *one* number beneath it — the run's defining figure, not gold, which the header owns. Drop Gold and Time Shards from `RunSection`'s `.detail-stats` entirely; keep Income only if it is framed as trajectory rather than a duplicate readout. Then move Reputation out of the three-cell Guild grid and into the hero's context line, since it is the Act II–III progress axis the milestones actually key off.
- **Suggested command:** `/impeccable layout`

**[P1] No visual hierarchy: 27 identical cells**
- **Why it matters:** Economy 5 cells, Guild 3, Quest Board 3, Progress 3, Records Lifetime 6, Combat 7, Equipment 3. Every one is the same size, weight, radius and border. `Jobs Running 0` is as loud as `940.1K Earned`, and `Zones Cleared 0/6` is as loud as `89% Win Rate`. Scanning is the entire purpose of an Operate surface, and there is nothing to scan *by*. This is the classic Visual Noise Floor: with no primary element, the player reads everything or nothing, and after two visits they read nothing.
- **Fix:** Tier the `Stat` component. Add a `size` prop with three levels — one hero-scale value per section maximum, standard cells for the supporting numbers, and a compact inline variant for the tail (`Items Held`, `Disassembled`, `Jobs Running`). Suppress or de-emphasize zero-valued cells rather than rendering them at full weight; a `0` that has never been non-zero is noise, and the panel already knows the act. In Records, collapse Combat's seven cells into a lead figure (win rate or monsters slain) plus a compact run of the rest.
- **Suggested command:** `/impeccable layout`

**[P1] Milestones are dead ends with no progress and no route**
- **Why it matters:** The Progress section is the answer to "what do I do next," and it is the weakest thing on the screen. Five visually identical locked rows, same lock glyph, same weight, with no indication of which is closest. `Frontier Pass opens at 1.60K reputation (750 to go)` has the numerator, the denominator and the remainder in the string — and renders no progress bar, while the design system defines one. None of the rows is tappable, so a player who reads "The Forge — craft your own equipment" has to work out on their own which tab the Forge lives in. Up to eight of these can render at once, which is double the working-memory limit for a decision point.
- **Fix:** Give `Milestone` a `progress` prop and render the existing `.progress-fill` track inside rows that have a measurable ratio (guild founding cost, zone reputation, dungeon Explore wins). Sort so the nearest incomplete milestone is first and give it a single visual promotion — the panel's one Guild Gold border. Make rows with a destination a `button.row` that switches tabs via the same navigation the tab bar uses; this is the one exception worth making to the panel's read-only rule, and it is navigation, not mutation. Cap the visible list at four with the remainder behind a "later" disclosure.
- **Suggested command:** `/impeccable shape`

**[P2] Ragged final rows in every stat grid**
- **Why it matters:** `.detail-stats` is `auto-fill, minmax(84px, 1fr)`, so cell counts that don't divide evenly leave orphans. Verified in the captures: Economy's 5 cells break 4+1 with `Items Held` alone on its own row at both 390px and 1440px; Records Lifetime breaks 5+1 (`Champions Hired` orphaned); Combat breaks 5+2. A lone bordered cell on a half-empty row reads as a rendering mistake, and it happens in five places.
- **Fix:** Either fix the column count per breakpoint so every group is complete by construction, or promote a lead stat out of each odd-count group so the remainder divides. Tiering the `Stat` component (P1 above) resolves this as a side effect, which is why it should be done in the same pass.
- **Suggested command:** `/impeccable layout`

**[P2] The story's climax renders as a generic row**
- **Why it matters:** `{state.hometownSaved && <Milestone done>Your hometown was saved.</Milestone>}` is the emotional payoff of the entire finite arc — the reason PRODUCT.md's principle 1 says the ending is designed first — and it is a 10px-radius row with a green check, visually identical to `0/4 great foes defeated`. Peak-end rule: the peak never arrives, so the memory of the run flattens. More broadly, no milestone completion is marked in any way; a lock icon silently becomes a check on some later visit, and the moment is gone. The design system has a whole Ceremonial motion tier and an `.ending-banner` component that this panel never touches.
- **Fix:** Give the saved-hometown state a dedicated epilogue component at the top of the Status subtab, built on `.ending-banner` with Display-tier Cinzel — and while you are there, fix the banner's radius drift (App.css:1654 is 12px where DESIGN.md specifies 14px). Separately, mark newly-completed milestones on first view with the Fast-tier state transition the system already defines, so completion is witnessed rather than discovered.
- **Suggested command:** `/impeccable delight`

## Persona Red Flags

**Alex (impatient power user):** Zero keyboard support — the three subtabs are `<button>`s with no arrow-key roving tabindex and no shortcut, so switching Status/Records/Timeline is mouse-only. No way to filter or expand the activity log; the 12-entry cap is hard-coded (`RECENT_LOG_COUNT`) against a 60-entry store, so 48 entries of history exist and are unreachable. Reads the whole panel once, concludes it contains nothing he can't get faster from the header, and never opens it again.

**Jordan (confused first-timer):** Lands here first, behind the "Ashes Behind You" modal, and after dismissing it sees — verified in the 390px capture — `0 Gold`, `0/s Income`, `0 Jobs Running`, `0 Workers`, `1 Per Click`, `0 Earned`, `0 Items Held`, one locked row reading `Found the Guild — 3.00K gold (you have 0)`, and then 300px of empty black. Seven zeros, no verb, no arrow toward the Town tab where clicking actually happens. The screen's only message is "you have nothing," with no instruction on how to stop having nothing. The gap between the 3.00K goal and 0 gold reads as impossible rather than as a first step.

**Casey (one-handed mobile):** The activity log is a 220px `overflow-y: auto` region nested inside the page scroll — a scroll trap under a thumb, and the standard mobile failure of nested scroll areas. She also scrolls the full panel to reach Progress, which is the only part with next-step information; the numbers she already saw in the header occupy the first screenful. Nothing here is tappable, so every decision requires leaving for another tab and remembering what she read.

**Project-specific — "Mira," the finite-narrative + RPG-roster player** (from PRODUCT.md: idle fans who want a crafted arc *and* first-class RPG depth): she is here for her adventurers, and the roster is reduced to `3/2 Champions` and `32 Adventurers` — two numbers whose difference is never explained. No names, no classes, no levels, no injury detail; `Iris Moon was wounded and is recovering` appears only as a log line she has to scroll to. `bestChampion()` computes her finest champion with kills and damage — genuinely the most characterful element in the file — and it is buried at the bottom of the *Records* subtab, behind a tab switch, below seven combat cells. The product's stated identity ("RPG depth as identity, not decoration") is the thing this panel decorates least.

## Minor Observations

- The `.log-*` color contract has drifted: CSS styles `.log-expedition` but the game emits kinds the stylesheet doesn't cover, so some entries fall back to default text while the design system claims per-kind coloring. Reconcile the union of emitted `LogEntry.kind` values with the CSS.
- Records' champion row renders a class icon that reads as a stray `P` glyph before "Brenna Kord" in the capture. Worth confirming `CLASS_ICON[best.className]` resolves for every class.
- On desktop the Records subtab ends with roughly 250px of empty ground above the tab bar, and the 520px column leaves ~460px of dead gutter on each side of a 1440px viewport. The cap is a deliberate DESIGN.md decision, but this panel is the one that would most benefit from a two-column desktop arrangement.
- `QuestBoardSection`'s `Cost /s` label is ambiguous — it is gold spent per second, but next to `Materials /s` it reads as a rate the player earns.
- `ProgressSection` can render eight milestones simultaneously in late Act III, twice the working-memory limit for a decision point.
- The fixed tab bar appears to overlap content in the full-page captures; this is a Playwright `fullPage` + `position: fixed` artifact and was not confirmed as a real defect. An in-viewport capture would settle it.

## Questions to Consider

- If the player could only see three things on this screen, which three? Everything else is a second-tier answer, and the panel currently has no second tier.
- What did I miss while I was away? An idle game's Overview is the natural home for the offline summary, and right now that moment has no surface.
- What would this look like if the roster were the hero instead of the ledger — three champion cards with names, classes and states, and the numbers underneath?
- Does the read-only rule need to forbid *navigation*, or only mutation? Making milestones route to their destination costs nothing in state and fixes the panel's biggest structural dead end.
- The game ends. What should the last Overview a player ever sees look like, and does anything in the current design build toward it?
