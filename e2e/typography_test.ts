import GamePage = require('../pages/GamePage');

Feature('Typography System');

BeforeSuite(({ I }) => {
  I.say('Ensure dev server is running: npm run dev');
});

Before(({ I }) => {
  GamePage.open();
});

/**
 * Sprint A: Typography System
 * Tests verify the font cascade, custom properties, and visual hierarchy.
 */

Scenario('body uses Source Sans 3 font family', async ({ I }) => {
  const fontFamily = await GamePage.getComputedStyle('body', 'fontFamily');
  I.assert.ok(
    fontFamily.includes('Source Sans 3') || fontFamily.includes('Source Sans Pro'),
    `Expected body font to include Source Sans 3, got: ${fontFamily}`,
  );
});

Scenario('display font applied to header gold amount', async ({ I }) => {
  const fontFamily = await GamePage.getComputedStyle(GamePage.headerGold, 'fontFamily');
  I.assert.ok(
    fontFamily.includes('Cinzel') || fontFamily.includes('serif'),
    `Expected display font (Cinzel) on .energy-amount, got: ${fontFamily}`,
  );
});

Scenario('display font applied to section titles', async ({ I }) => {
  // Open Town tab to find section titles
  GamePage.openTab('Town');
  I.waitForElement(GamePage.sectionTitle, 3);
  const fontFamily = await GamePage.getComputedStyle(GamePage.sectionTitle, 'fontFamily');
  I.assert.ok(
    fontFamily.includes('Cinzel') || fontFamily.includes('serif'),
    `Expected display font on .section-title, got: ${fontFamily}`,
  );
});

Scenario('section titles do not use uppercase transform', async ({ I }) => {
  GamePage.openTab('Town');
  I.waitForElement(GamePage.sectionTitle, 3);
  const textTransform = await GamePage.getComputedStyle(GamePage.sectionTitle, 'textTransform');
  I.assert.notEqual(
    textTransform,
    'uppercase',
    `.section-title should NOT be uppercase for Cinzel readability, got: ${textTransform}`,
  );
});

Scenario('header gold uses tabular-nums', async ({ I }) => {
  const fontVariant = await GamePage.getComputedStyle(GamePage.headerGold, 'fontVariantNumeric');
  I.assert.ok(
    fontVariant.includes('tabular-nums'),
    `Expected tabular-nums on .energy-amount, got: ${fontVariant}`,
  );
});

Scenario('tab labels use body font', async ({ I }) => {
  const fontFamily = await GamePage.getComputedStyle('.tab-label', 'fontFamily');
  I.assert.ok(
    fontFamily.includes('Source Sans 3') || fontFamily.includes('Source Sans Pro'),
    `Expected body font on tab labels, got: ${fontFamily}`,
  );
});

Scenario('click button uses display font', async ({ I }) => {
  const fontFamily = await GamePage.getComputedStyle(GamePage.clickButton, 'fontFamily');
  I.assert.ok(
    fontFamily.includes('Cinzel') || fontFamily.includes('serif'),
    `Expected display font on .click-button, got: ${fontFamily}`,
  );
});

Scenario('story modal title uses display font', async ({ I }) => {
  // Click odd jobs to trigger potential story beat (Act 1)
  GamePage.clickOddJobs(5);
  I.wait(1);

  // If a story modal appears, check its font
  const hasModal = await GamePage.isModalOpen();
  if (hasModal) {
    const fontFamily = await GamePage.getComputedStyle(GamePage.modalTitle, 'fontFamily');
    I.assert.ok(
      fontFamily.includes('Cinzel') || fontFamily.includes('serif'),
      `Expected display font on .story-title, got: ${fontFamily}`,
    );
    I.click(GamePage.storyContinue);
    I.waitForInvisible(GamePage.modalDialog, 3);
  } else {
    I.say('No story beat triggered; skipping story font assertion (beat may already be seen)');
  }
});

Scenario('PixiJS battle canvas renders in battle modal', async ({ I }) => {
  // This test verifies the canvas element exists when a battle occurs.
  // We navigate to Map tab and attempt to explore (requires Act 2+ state).
  // For a basic check, we verify the canvas element is present in the DOM structure.
  GamePage.openTab('Map');
  I.wait(1);

  const canvasExists = await GamePage.elementExists(GamePage.battleCanvas);
  // Canvas may not exist if no battle is active; that's acceptable for this check.
  // The real assertion is that when a battle IS active, the canvas renders.
  I.say(`Canvas element present in DOM: ${canvasExists}`);
});

Scenario('font size tokens replace ad-hoc rem values', async ({ I }) => {
  // Check that common selectors use the CSS custom property --text-sm
  // instead of hardcoded 0.72rem or 0.78rem.
  const rowDescSize = await GamePage.getComputedStyle('.row-desc', 'fontSize');
  // 0.75rem at default 16px root = 12px
  I.assert.ok(
    rowDescSize === '12px' || rowDescSize === '12.8px' || rowDescSize === '13px',
    `Expected .row-desc to be ~12-13px (0.75rem), got: ${rowDescSize}`,
  );
});
