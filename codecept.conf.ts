import { setHeadlessWhen, setCommonPlugins } from '@codeceptjs/configure';

setHeadlessWhen(process.env.HEADLESS);
setCommonPlugins();

export const config: CodeceptJS.MainConfig = {
  tests: 'e2e/*_test.ts',
  output: 'e2e/output',
  helpers: {
    Playwright: {
      browser: 'chromium',
      url: 'http://localhost:5173',
      show: true,
      windowSize: '1280x720',
      waitForAction: 500,
      waitForTimeout: 10000,
      trace: true,
    },
  },
  include: {
    I: './e2e/steps.d.ts',
    GamePage: './e2e/pages/GamePage.ts',
  },
  name: 'idle-incremental-game-e2e',
  plugins: {
    screenshotOnFail: {
      enabled: true,
    },
    retryFailedStep: {
      enabled: true,
      retries: 3,
    },
  },
};
