# Idle Energy — idle/incremental game

React + TypeScript + Vite. Target: web now, later wrapped in Electron for Steam
(and possibly Capacitor for mobile). The developer designs and steers; AI writes
most of the code — so keep the architecture boundaries below strict, and keep
`src/game/` covered by tests.

## Commands

- `npm run dev` — dev server with HMR
- `npm test` — vitest (pure logic tests in `src/game/*.test.ts`)
- `npm run build` — typecheck + production build

## Architecture (important)

Three layers, dependencies point inward only:

- **`src/game/`** — pure TypeScript game logic. No React, no DOM, no imports
  from outside this folder. All state transitions are pure functions
  `(state) => state`. All balance/tuning numbers live in `config.ts` only.
- **`src/platform/`** — platform adapters behind interfaces (e.g. `SaveAdapter`
  in `storage.ts`). Web uses localStorage; the Electron/Steam build will swap in
  file-based + Steam Cloud adapters here without touching game or UI code.
- **`src/ui/`, `src/hooks/`, `App.tsx`** — React. Reads state via
  `useGameState()`, mutates only by dispatching pure functions from
  `src/game/logic.ts` through the `GameStore`.

The game loop (`useGameLoop`) ticks 10×/sec with clamped dt; long absences are
handled by `applyOfflineProgress` on load, not by giant ticks.

## Conventions

- New mechanics: add pure functions + tests in `src/game/` first, then UI.
- Never put balance numbers inline in components — they go in `game/config.ts`.
- Saves are versioned (`SAVE_VERSION`); when changing `GameState` shape, bump
  the version and add a migration in `platform/storage.ts` — never break
  existing player saves.
