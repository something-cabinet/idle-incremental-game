# Guild of Second Chances — narrative RPG management idle game

React + TypeScript + Vite. Target: web now, later wrapped in Electron for Steam
(and possibly Capacitor for mobile). The developer designs and steers; AI writes
most of the code — so keep the architecture boundaries below strict, and keep
`src/game/` covered by tests.

**The game design is canonical in `docs/game-design.md`** — three acts
(refugee → guild leader → revenge), time-travel prestige with Time Shards,
finite ending. Read it before changing systems. Names/prose/balance numbers
are placeholders until the theme/balance passes.

## Commands

- `npm run dev` — dev server with HMR
- `npm test` — vitest (pure logic tests in `src/game/*.test.ts`)
- `npm run build` — typecheck + production build

## Architecture (important)

Three layers, dependencies point inward only:

- **`src/game/`** — pure TypeScript game logic. No React, no DOM, no imports
  from outside this folder. All state transitions are pure functions
  `(state) => state`. Randomness is injected (`Rng` param, defaults to
  `Math.random`) so tests are deterministic. All balance/tuning numbers and
  content (jobs, locations, perks, story beats) live in `config.ts` only.
  - `logic.ts` town economy · `guild.ts` roster/gear/assignments ·
    `engine.ts` the tick (patrols, quests, expeditions, offline catch-up) ·
    `story.ts` beats & act transitions · `prestige.ts` time travel ·
    `adventurers.ts` generation/stats · `perks.ts` shard-bought modifiers
- **`src/platform/`** — platform adapters behind interfaces (`SaveAdapter`
  in `storage.ts`). Web uses localStorage; the Electron/Steam build will swap in
  file-based + Steam Cloud adapters here without touching game or UI code.
- **`src/ui/`, `src/hooks/`, `App.tsx`** — React. Reads state via
  `useGameState()`, mutates only by dispatching pure functions through the
  `GameStore`. Five tabs — Overview / Town / Guild / Map / Items — the last
  three act-gated (Act 2). Settings sits behind the header gear; Timeline is
  an Overview subtab, revealed once time travel unlocks.
  - `ui/icons.tsx` — the whole icon vocabulary as monochrome 24×24 SVG stroked
    with `currentColor`. **No emoji in the UI.** Icons are deliberately shared
    across similar concepts; extend this set rather than adding one-off glyphs.
  - `ui/display.ts` — the only place game data becomes display strings and icon
    names (`materialName`, `CLASS_ICON`, `itemStatParts`, `rate`, …). Don't
    redeclare these in a panel; they previously drifted out of sync.
  - `ui/components.tsx` — `Modal` (bottom sheet on phones), `InfoNote`
    (collapsible help), `Stat`, `StatChips`, `NoteRow`.

The game loop (`useGameLoop`) ticks 10×/sec with clamped dt. `engine.tick`
handles any dt — offline catch-up runs through the same code path, processing
patrol encounters in fixed game-time steps (capped). Game time runs 1:1 with
real time; 1 in-game day = `DAY_LENGTH_SECONDS` (20 min).

A later feature to keep in mind: an animated town-overview window (town grows
with upgrades). It will be a render layer reading game state — likely
PixiJS/canvas — so don't leak UI assumptions into `src/game/`.

## Conventions

- New mechanics: add pure functions + tests in `src/game/` first, then UI.
- Never put balance numbers inline in components — they go in `game/config.ts`.
- UI is mobile-first. Action buttons clear a 44px touch target (`--touch`);
  spacing uses the `--gap-*` / `--radius-*` tokens, not raw pixels.
- Information the player acts on must stay full-contrast. `.row-static` is
  readable body text; only genuinely unavailable controls get the dimmed
  `.row-locked` / `unaffordable` treatment.
- Long explanations belong in an `InfoNote`, collapsed by default and passed
  `defaultOpen` when the surrounding UI is empty — not in permanent prose.
- Saves are versioned (`SAVE_VERSION`, currently 3); when changing `GameState`
  shape, bump it and extend `migrateSave` in `game/logic.ts` — never break
  existing player saves (pre-v3 saves intentionally reset: full redesign).

## Design references

`docs/` holds design material — consult before system/theme decisions:

- `docs/game-design.md` — **the game's canonical design** (user-authored).
- `docs/design-research-idle-games.md` — genre research: prestige math,
  platform tuning, monetization, pitfalls.
- `docs/spaceplan-framework-notes.md` — finite narrative idle structure
  (this game follows the act/paradigm-shift pattern described there).
