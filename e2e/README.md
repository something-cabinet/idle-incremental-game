# E2E Test Suite — Guild of Second Chances

## Prerequisites

- Node.js 20+
- Vite dev server running on `http://localhost:5173`

## Installation

CodeceptJS, Playwright, and `@codeceptjs/configure` are already installed as dev dependencies.

```bash
npm install
```

## Running Tests

### 1. Start the dev server (in a separate terminal)

```bash
npm run dev
```

### 2. Run all E2E tests

```bash
npm run test:e2e
```

### 3. Run in headless mode (CI)

```bash
npm run test:e2e:headless
```

### 4. Run with verbose debugging

```bash
npm run test:e2e:debug
```

### 5. Run a single test file

```bash
npx codeceptjs run --config codecept.conf.ts typography_test.ts
```

## Test Structure

```
e2e/
  pages/
    GamePage.ts          # Page object: selectors, helpers, state injection
  steps.d.ts             # TypeScript definitions for CodeceptJS
  typography_test.ts     # Sprint A: Font rendering, tokens, hierarchy
  confirm_modal_test.ts  # Sprint B: ConfirmModal behavior, focus trap, keyboard
  toast_system_test.ts   # Sprint C: Toast notifications, offline catch-up
  prestige_test.ts       # Sprint C: Prestige celebration as story beat
  accessibility_test.ts  # Cross-cutting: ARIA, focus, keyboard, checkbox fixes
```

## Configuration

`codecept.conf.ts`:
- **Helper**: Playwright with Chromium
- **Base URL**: `http://localhost:5173`
- **Window size**: 1280x720
- **Wait for action**: 500ms
- **Wait for timeout**: 10000ms
- **Trace on failure**: Enabled

## Game State Injection

Tests use `GamePage.injectState()` to manipulate game state via `executeScript`. This requires the game store to be exposed on the window object. If the store is not exposed, tests that depend on state injection will need to be updated to use UI interactions only.

To expose the store for testing, add to `src/main.tsx` or `src/App.tsx`:

```tsx
// Expose store for E2E testing
(window as any).__GAME_STORE__ = store;
```

## Known Gaps & Limitations

1. **PixiJS Canvas**: Tests verify the canvas element exists but cannot inspect rendered content. Visual regression testing would be needed for pixel-perfect canvas assertions.

2. **Offline Catch-up**: The offline toast test is conditional — it depends on specific state timing that may not trigger reliably in a test environment. The test gracefully skips if conditions aren't met.

3. **Story Beat Timing**: Story beats may already be dismissed in a saved game state. Tests that depend on story modals appearing use conditional checks and skip if the beat is not present.

4. **Zone Availability**: MapPanel tests depend on zones being unlocked. Tests gracefully skip if no zones are available (e.g., Act 1 state).

5. **Prestige Button**: Prestige tests require Act 3 state with the demon king defeated. These tests inject state but may need adjustment if the prestige unlock logic changes.

6. **Font Loading**: Typography tests check computed styles, which may show fallback fonts briefly during loading. The `document.fonts.ready` fix in the spec should prevent this, but tests may need retries on slow connections.

## Adding New Tests

1. Create a new file in `e2e/` named `{feature}_test.ts`
2. Import `GamePage` from `../pages/GamePage`
3. Use `Feature('Feature Name')` and `Scenario('description', async ({ I }) => { ... })`
4. Run with `npx codeceptjs run --config codecept.conf.ts {feature}_test.ts`

## Troubleshooting

### Tests fail with "Cannot find element"
- Ensure the dev server is running (`npm run dev`)
- Check that the selector exists in the actual DOM (use browser DevTools)
- Increase `waitForTimeout` in `codecept.conf.ts` if the SPA is slow to hydrate

### Tests fail with "Game state not exposed"
- Add `(window as any).__GAME_STORE__ = store;` to the app entry point
- Restart the dev server

### Playwright browser not found
- Run `npx playwright install chromium` to install browser binaries

### Trace files for debugging
- Traces are saved to `e2e/output/` on failure
- Open them with `npx playwright show-trace e2e/output/{test_name}.trace.zip`
