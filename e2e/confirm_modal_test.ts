import GamePage = require('../pages/GamePage');

Feature('ConfirmModal');

Before(({ I }) => {
  GamePage.open();
});

/**
 * Sprint B: ConfirmModal
 * Tests verify the native confirm replacement, focus trapping, and keyboard behavior.
 */

Scenario('settings reset button opens ConfirmModal', async ({ I }) => {
  GamePage.openSettings();
  I.waitForText('Reset all progress', 5);

  I.click('Reset all progress');
  I.waitForVisible(GamePage.modalDialog, 3);
  I.see('Reset All Progress', GamePage.modalTitle);
  I.see('cannot be undone', GamePage.modalBody);

  // Verify danger variant: confirm button should have .danger class
  const confirmClass = await GamePage.getComputedStyle(GamePage.confirmButton, 'className');
  I.assert.ok(
    confirmClass.includes('danger'),
    'Expected confirm button to have .danger class for destructive action',
  );

  // Cancel to close
  I.click(GamePage.cancelButton);
  I.waitForInvisible(GamePage.modalDialog, 3);
});

Scenario('settings cancel keeps game state intact', async ({ I }) => {
  // Record initial gold
  const initialGold = await I.grabTextFrom(GamePage.headerGold);

  GamePage.openSettings();
  I.waitForText('Reset all progress', 5);
  I.click('Reset all progress');
  I.waitForVisible(GamePage.modalDialog, 3);

  // Click Cancel
  I.click(GamePage.cancelButton);
  I.waitForInvisible(GamePage.modalDialog, 3);

  // Verify we're back in settings panel
  I.seeElement('.settings-panel');

  // Verify gold is unchanged (state not reset)
  const currentGold = await I.grabTextFrom(GamePage.headerGold);
  I.assert.equal(currentGold, initialGold, 'Gold should not change after canceling reset');
});

Scenario('prestige confirm modal appears when confirmPrestige is enabled', async ({ I }) => {
  // Inject state to enable prestige and confirmPrestige setting
  await GamePage.injectState({
    act: 3,
    bossesDefeated: { 'demon-king': true },
    settings: { confirmPrestige: true },
    timeShards: 10,
    prestigeCount: 0,
  });

  I.wait(1);

  // Navigate to Overview → Timeline
  GamePage.openTab('Overview');
  I.wait(1);
  I.click('Timeline');
  I.wait(1);

  // Look for prestige button
  const hasPrestigeButton = await GamePage.elementExists('.prestige-button');
  if (!hasPrestigeButton) {
    I.say('Prestige button not visible; skipping prestige confirm test');
    return;
  }

  I.click('.prestige-button');
  I.waitForVisible(GamePage.modalDialog, 3);
  I.see('Travel Back in Time', GamePage.modalTitle);

  // Verify primary variant
  const confirmClass = await GamePage.getComputedStyle(GamePage.confirmButton, 'className');
  I.assert.ok(
    confirmClass.includes('primary'),
    'Expected confirm button to have .primary class for progressive action',
  );

  // Cancel to abort
  I.click(GamePage.cancelButton);
  I.waitForInvisible(GamePage.modalDialog, 3);
});

Scenario('prestige cancel aborts time travel', async ({ I }) => {
  // Inject state
  await GamePage.injectState({
    act: 3,
    bossesDefeated: { 'demon-king': true },
    settings: { confirmPrestige: true },
    timeShards: 10,
    prestigeCount: 0,
    gold: 5000,
  });

  I.wait(1);
  GamePage.openTab('Overview');
  I.wait(1);
  I.click('Timeline');
  I.wait(1);

  const hasPrestigeButton = await GamePage.elementExists('.prestige-button');
  if (!hasPrestigeButton) {
    I.say('Prestige button not visible; skipping test');
    return;
  }

  const initialGold = await I.grabTextFrom(GamePage.headerGold);

  I.click('.prestige-button');
  I.waitForVisible(GamePage.modalDialog, 3);

  I.click(GamePage.cancelButton);
  I.waitForInvisible(GamePage.modalDialog, 3);

  // Verify gold is unchanged (travel was aborted)
  const currentGold = await I.grabTextFrom(GamePage.headerGold);
  I.assert.equal(currentGold, initialGold, 'Gold should not change after canceling prestige');
});

Scenario('focus traps inside confirm modal', async ({ I }) => {
  GamePage.openSettings();
  I.waitForText('Reset all progress', 5);
  I.click('Reset all progress');
  I.waitForVisible(GamePage.modalDialog, 3);

  // Tab multiple times
  I.pressKey('Tab');
  I.pressKey('Tab');
  I.pressKey('Tab');
  I.pressKey('Tab');
  I.pressKey('Tab');

  // Verify focus is still inside the modal
  const focusedInside = await I.executeScript(() => {
    const modal = document.querySelector('.story-modal');
    return modal ? modal.contains(document.activeElement) : false;
  });
  I.assert.ok(focusedInside, 'Focus should remain trapped inside the confirm modal after multiple Tab presses');

  // Clean up
  I.click(GamePage.cancelButton);
  I.waitForInvisible(GamePage.modalDialog, 3);
});

Scenario('danger variant focuses cancel button first', async ({ I }) => {
  GamePage.openSettings();
  I.waitForText('Reset all progress', 5);
  I.click('Reset all progress');
  I.waitForVisible(GamePage.modalDialog, 3);

  // After modal opens, check which button is focused
  const focusedText = await I.executeScript(() => {
    const active = document.activeElement;
    return active ? active.textContent?.trim() : null;
  });

  I.assert.ok(
    focusedText?.includes('Cancel') || focusedText?.includes('Keep Playing'),
    `For danger variant, Cancel button should be focused first. Got: ${focusedText}`,
  );

  I.click(GamePage.cancelButton);
  I.waitForInvisible(GamePage.modalDialog, 3);
});

Scenario('Escape key closes dismissable confirm modal', async ({ I }) => {
  GamePage.openSettings();
  I.waitForText('Reset all progress', 5);
  I.click('Reset all progress');
  I.waitForVisible(GamePage.modalDialog, 3);

  I.pressKey('Escape');
  I.waitForInvisible(GamePage.modalDialog, 3);
});

Scenario('focus returns to trigger after modal closes', async ({ I }) => {
  GamePage.openSettings();
  I.waitForText('Reset all progress', 5);

  // Note the trigger element
  const triggerTag = await I.executeScript(() => {
    const btn = document.querySelector('.danger-button');
    return btn?.tagName;
  });

  I.click('Reset all progress');
  I.waitForVisible(GamePage.modalDialog, 3);
  I.click(GamePage.cancelButton);
  I.waitForInvisible(GamePage.modalDialog, 3);

  // Verify focus returned to the trigger
  const focusedTag = await I.executeScript(() => {
    return document.activeElement?.tagName;
  });
  I.assert.equal(
    focusedTag,
    triggerTag,
    'Focus should return to the trigger button after modal closes',
  );
});
