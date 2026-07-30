import GamePage = require('../pages/GamePage');

Feature('Accessibility');

Before(({ I }) => {
  GamePage.open();
});

/**
 * Cross-cutting: Accessibility
 * Tests verify focus management, ARIA attributes, and keyboard navigation.
 */

Scenario('modal traps focus on open', async ({ I }) => {
  GamePage.openSettings();
  I.waitForElement('.settings-panel', 5);

  // Open a sub-modal (e.g., reset confirm)
  I.click('Reset all progress');
  I.waitForVisible(GamePage.modalDialog, 3);

  // Check that a focusable element inside the modal is focused
  const focusedInside = await I.executeScript(() => {
    const modal = document.querySelector('.story-modal');
    if (!modal) return false;
    const active = document.activeElement;
    return modal.contains(active);
  });
  I.assert.ok(focusedInside, 'A focusable element inside the modal should receive focus on open');

  I.click(GamePage.cancelButton);
  I.waitForInvisible(GamePage.modalDialog, 3);
});

Scenario('Escape closes dismissable modal', async ({ I }) => {
  GamePage.openSettings();
  I.waitForElement('.settings-panel', 5);

  // Settings panel is not a modal, but the reset confirm is
  I.click('Reset all progress');
  I.waitForVisible(GamePage.modalDialog, 3);

  I.pressKey('Escape');
  I.waitForInvisible(GamePage.modalDialog, 3);
});

Scenario('Escape does NOT close story modal', async ({ I }) => {
  // Inject a pending story beat
  await GamePage.injectState({
    pendingStories: ['act1-opening'],
  });

  I.wait(1);

  // Story modal should appear
  const hasModal = await GamePage.isModalOpen();
  if (!hasModal) {
    I.say('Story modal not triggered; skipping test');
    return;
  }

  I.waitForVisible(GamePage.modalDialog, 5);

  // Press Escape
  I.pressKey('Escape');
  I.wait(1);

  const stillOpen = await GamePage.isModalOpen();
  I.assert.ok(stillOpen, 'Story modal (dismissable=false) should NOT close on Escape');

  // Clean up
  I.click(GamePage.storyContinue);
  I.waitForInvisible(GamePage.modalDialog, 3);
});

Scenario('focus returns to trigger after modal close', async ({ I }) => {
  GamePage.openSettings();
  I.waitForElement('.settings-panel', 5);

  // Remember the trigger element
  const triggerText = await I.executeScript(() => {
    const btn = document.querySelector('.danger-button');
    return btn?.textContent?.trim();
  });

  I.click('Reset all progress');
  I.waitForVisible(GamePage.modalDialog, 3);
  I.click(GamePage.cancelButton);
  I.waitForInvisible(GamePage.modalDialog, 3);

  const focusedText = await I.executeScript(() => {
    return document.activeElement?.textContent?.trim();
  });

  I.assert.ok(
    focusedText?.includes(triggerText || ''),
    `Focus should return to trigger element. Expected: ${triggerText}, Got: ${focusedText}`,
  );
});

Scenario('quest checklist has accessible checkbox labels', async ({ I }) => {
  // Inject state for quest creation
  await GamePage.injectState({
    act: 2,
    reputation: 50,
    adventurers: [
      {
        id: 1,
        name: 'Test Champion',
        className: 'warrior',
        level: 1,
        xp: 0,
        attributes: { str: 10, dex: 10, con: 10, int: 10, lck: 10 },
        equipment: {},
        enemiesDefeated: 0,
        totalDamageDealt: 0,
        injuredUntil: 0,
      },
    ],
    locationsCleared: {},
  });

  I.wait(1);
  GamePage.openTab('Map');
  I.wait(1);

  const hasZone = await GamePage.elementExists('.zone-card');
  if (!hasZone) {
    I.say('No zones available; skipping quest accessibility test');
    return;
  }

  I.click('.zone-header');
  I.wait(0.5);
  I.click('Post Quest');
  I.waitForVisible(GamePage.modalDialog, 3);

  // Verify checkboxes have id attributes
  const hasIds = await I.executeScript(() => {
    const checkboxes = document.querySelectorAll('.quest-checklist-row input[type="checkbox"]');
    return Array.from(checkboxes).every((cb) => (cb as HTMLElement).id);
  });
  I.assert.ok(hasIds, 'All quest checklist checkboxes must have id attributes');

  // Verify labels have htmlFor associations
  const hasLabels = await I.executeScript(() => {
    const rows = document.querySelectorAll('.quest-checklist-row');
    return Array.from(rows).every((row) => {
      const checkbox = row.querySelector('input[type="checkbox"]');
      const label = row.closest('label');
      if (!checkbox || !label) return false;
      return label.getAttribute('for') === (checkbox as HTMLElement).id;
    });
  });
  I.assert.ok(hasLabels, 'All quest checklist rows must be wrapped in <label> with htmlFor');

  // Verify checkboxes are not readOnly
  const notReadOnly = await I.executeScript(() => {
    const checkboxes = document.querySelectorAll('.quest-checklist-row input[type="checkbox"]');
    return Array.from(checkboxes).every((cb) => !(cb as any).readOnly);
  });
  I.assert.ok(notReadOnly, 'Quest checklist checkboxes must NOT be readOnly');

  // Clean up
  I.click(GamePage.modalCloseButton);
  I.waitForInvisible(GamePage.modalDialog, 3);
});

Scenario('toasts have ARIA status roles', async ({ I }) => {
  // Inject a completed craft to trigger toast
  await GamePage.injectState({
    act: 2,
    guildUpgrades: { forge: 1 },
    materials: { iron: 100, wood: 100 },
    gold: 10000,
    crafting: {
      slot: 'weapon',
      tier: 1,
      quantity: 1,
      startedAt: 0,
      endsAt: 1,
    },
  });

  I.wait(1);
  GamePage.openTab('Items');
  I.wait(1);
  I.click('Forge');
  I.wait(1);

  I.waitForElement(GamePage.toast, 5);

  // Verify role attribute
  const role = await I.executeScript(() => {
    const toast = document.querySelector('.toast');
    return toast?.getAttribute('role');
  });
  I.assert.ok(
    role === 'status' || role === 'alert',
    `Toast should have role="status" or role="alert", got: ${role}`,
  );

  // Verify aria-live
  const ariaLive = await I.executeScript(() => {
    const toast = document.querySelector('.toast');
    return toast?.getAttribute('aria-live');
  });
  I.assert.ok(
    ariaLive === 'polite' || ariaLive === 'assertive',
    `Toast should have aria-live attribute, got: ${ariaLive}`,
  );
});

Scenario('modal has aria-labelledby and aria-describedby', async ({ I }) => {
  GamePage.openSettings();
  I.waitForElement('.settings-panel', 5);
  I.click('Reset all progress');
  I.waitForVisible(GamePage.modalDialog, 3);

  const labelledBy = await I.executeScript(() => {
    const modal = document.querySelector('.story-modal[role="dialog"]');
    return modal?.getAttribute('aria-labelledby');
  });
  I.assert.ok(
    labelledBy && labelledBy.length > 0,
    'Modal should have aria-labelledby pointing to title element',
  );

  const describedBy = await I.executeScript(() => {
    const modal = document.querySelector('.story-modal[role="dialog"]');
    return modal?.getAttribute('aria-describedby');
  });
  I.assert.ok(
    describedBy && describedBy.length > 0,
    'Modal should have aria-describedby pointing to body element',
  );

  I.click(GamePage.cancelButton);
  I.waitForInvisible(GamePage.modalDialog, 3);
});

Scenario('reduced motion disables toast slide animation', async ({ I }) => {
  // Inject state with reduced motion enabled
  await GamePage.injectState({
    act: 2,
    guildUpgrades: { forge: 1 },
    materials: { iron: 100, wood: 100 },
    gold: 10000,
    settings: { reducedMotion: true },
    crafting: {
      slot: 'weapon',
      tier: 1,
      quantity: 1,
      startedAt: 0,
      endsAt: 1,
    },
  });

  I.wait(1);
  GamePage.openTab('Items');
  I.wait(1);
  I.click('Forge');
  I.wait(1);

  I.waitForElement(GamePage.toast, 5);

  // Check that the toast does NOT have the slide-in animation class
  // or that animation is none
  const animation = await GamePage.getComputedStyle(GamePage.toast, 'animationName');
  I.assert.ok(
    animation === 'none' || animation === '',
    `With reducedMotion, toast should have no animation. Got: ${animation}`,
  );
});

Scenario('settings toggle has role switch and aria-checked', async ({ I }) => {
  GamePage.openSettings();
  I.waitForElement('.settings-panel', 5);

  const hasSwitch = await GamePage.elementExists('.toggle[role="switch"]');
  I.assert.ok(hasSwitch, 'Settings toggles should have role="switch"');

  const ariaChecked = await I.executeScript(() => {
    const toggle = document.querySelector('.toggle[role="switch"]');
    return toggle?.getAttribute('aria-checked');
  });
  I.assert.ok(
    ariaChecked === 'true' || ariaChecked === 'false',
    `Toggle should have aria-checked, got: ${ariaChecked}`,
  );
});
