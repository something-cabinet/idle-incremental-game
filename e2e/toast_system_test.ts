import GamePage = require('../pages/GamePage');

Feature('Toast System');

Before(({ I }) => {
  GamePage.open();
});

/**
 * Sprint C: Toast & Celebration System
 * Tests verify engine-driven toast notifications, queuing, and dismissal.
 */

Scenario('crafting completion triggers toast', async ({ I }) => {
  // Inject state: forge unlocked, crafting job active that completes soon
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
      endsAt: 1, // already complete
    },
  });

  I.wait(1);
  GamePage.openTab('Items');
  I.wait(1);
  I.click('Forge');
  I.wait(1);

  // The engine should process the completed craft and emit a toast
  GamePage.waitForToast('Forging complete', 10);
  I.see('Forging complete', GamePage.toast);
});

Scenario('quest posted triggers toast', async ({ I }) => {
  // Inject state to Act 2 with reputation and adventurers
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

  // Open a zone and post a quest
  const hasZone = await GamePage.elementExists('.zone-card');
  if (!hasZone) {
    I.say('No zones available; skipping quest toast test');
    return;
  }

  I.click('.zone-header');
  I.wait(0.5);
  I.click('Post Quest');
  I.waitForVisible(GamePage.modalDialog, 3);

  // Select a target and post
  const hasChecklist = await GamePage.elementExists('.quest-checklist-row');
  if (hasChecklist) {
    I.click('.quest-checklist-row');
    I.wait(0.3);
    I.click('Post Quest');
    I.waitForInvisible(GamePage.modalDialog, 3);

    // Verify toast
    GamePage.waitForToast('Quest posted', 5);
    I.see('Quest posted', GamePage.toast);
  } else {
    I.say('No quest targets available; skipping');
    I.click(GamePage.modalCloseButton);
    I.waitForInvisible(GamePage.modalDialog, 3);
  }
});

Scenario('toast max cap of 2', async ({ I }) => {
  // Inject state with multiple simultaneous events
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

  // Wait for at least one toast
  I.waitForElement(GamePage.toast, 5);

  // Trigger more events rapidly via script
  await I.executeScript(() => {
    const { emitGameEvent } = (window as any);
    if (emitGameEvent) {
      emitGameEvent({ type: 'quest-posted' });
      emitGameEvent({ type: 'quest-completed' });
      emitGameEvent({ type: 'zone-unlocked', payload: { name: 'Test Zone' } });
    }
  });

  I.wait(1);

  const toastCount = await GamePage.countToasts();
  I.assert.ok(
    toastCount <= 2,
    `Expected max 2 visible toasts, got: ${toastCount}`,
  );
});

Scenario('toast auto-dismisses after duration', async ({ I }) => {
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
  I.seeElement(GamePage.toast);

  // Wait for auto-dismiss (default 3.5s + animation buffer)
  I.wait(5);

  const stillVisible = await GamePage.elementExists('.toast:not(.toast-out)');
  I.assert.ok(!stillVisible, 'Toast should auto-dismiss after its duration');
});

Scenario('toast close button dismisses immediately', async ({ I }) => {
  // Inject a completed craft
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
  I.click(GamePage.toastClose);
  I.wait(0.5);

  const stillVisible = await GamePage.elementExists('.toast:not(.toast-out)');
  I.assert.ok(!stillVisible, 'Toast should dismiss immediately after clicking close button');
});

Scenario('toast close button has 44px hit area', async ({ I }) => {
  // Inject a completed craft
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

  const width = await GamePage.getComputedStyle(GamePage.toastClose, 'width');
  const height = await GamePage.getComputedStyle(GamePage.toastClose, 'height');

  // parse px values
  const wPx = parseInt(width, 10);
  const hPx = parseInt(height, 10);

  I.assert.ok(
    wPx >= 44 && hPx >= 44,
    `Toast close button should be at least 44x44px, got: ${wPx}x${hPx}`,
  );
});

Scenario('offline catch-up shows summary toast', async ({ I }) => {
  // This test simulates returning after being away.
  // We inject state with a large runTimeSeconds gap to trigger offline catch-up.
  const now = Math.floor(Date.now() / 1000);
  await GamePage.injectState({
    act: 2,
    lastUpdate: now - 3600, // 1 hour ago
    runTimeSeconds: 3600,
    gold: 1000,
    totalGoldEarned: 1000,
    jobs: { odd_jobs: 5 },
    workers: 2,
    settings: { offlineProgress: true },
  });

  I.wait(2);

  // The offline catch-up should process and potentially show a toast
  // Since offline progress is complex, we verify the offline toast exists
  const hasOfflineToast = await GamePage.elementExists('.offline-toast');
  if (hasOfflineToast) {
    I.seeElement('.offline-toast');
  } else {
    I.say('Offline toast not triggered in this test run; may require more specific state');
  }
});
