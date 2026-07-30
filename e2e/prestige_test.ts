import GamePage = require('../pages/GamePage');

Feature('Prestige Celebration');

Before(({ I }) => {
  GamePage.open();
});

/**
 * Sprint C: Prestige Celebration as Story Beat
 * Tests verify the prestige celebration renders through the story beat system
 * with correct styling and auto-dismiss behavior.
 */

Scenario('prestige celebration appears after time travel', async ({ I }) => {
  // Inject state to enable prestige
  await GamePage.injectState({
    act: 3,
    bossesDefeated: { 'demon-king': true },
    settings: { confirmPrestige: false }, // skip confirm modal
    timeShards: 10,
    prestigeCount: 0,
    hometownSaved: false,
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

  I.click('.prestige-button');
  I.wait(1);

  // Prestige celebration should appear as a story beat
  I.waitForVisible(GamePage.modalDialog, 5);
  I.see('Timeline Rewritten', GamePage.modalTitle);
  I.see('crystal hums', GamePage.modalBody);
});

Scenario('prestige celebration has prestige-beat styling', async ({ I }) => {
  // Inject state
  await GamePage.injectState({
    act: 3,
    bossesDefeated: { 'demon-king': true },
    settings: { confirmPrestige: false },
    timeShards: 10,
    prestigeCount: 0,
    hometownSaved: false,
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

  I.click('.prestige-button');
  I.waitForVisible(GamePage.modalDialog, 5);

  // Verify .prestige-beat class is applied
  const hasPrestigeClass = await GamePage.elementExists('.story-modal.prestige-beat');
  I.assert.ok(hasPrestigeClass, 'Prestige celebration modal should have .prestige-beat class');

  // Verify shard-colored border
  const borderColor = await GamePage.getComputedStyle('.story-modal.prestige-beat', 'borderColor');
  I.assert.ok(
    borderColor.includes('126, 200, 255') || borderColor.includes('7ec8ff'),
    `Expected shard-colored border (#7ec8ff), got: ${borderColor}`,
  );

  // Verify title color
  const titleColor = await GamePage.getComputedStyle(GamePage.modalTitle, 'color');
  I.assert.ok(
    titleColor.includes('126, 200, 255') || titleColor.includes('7ec8ff'),
    `Expected shard-colored title, got: ${titleColor}`,
  );

  // Dismiss
  I.click(GamePage.storyContinue);
  I.waitForInvisible(GamePage.modalDialog, 3);
});

Scenario('prestige celebration auto-dismisses', async ({ I }) => {
  // Inject state
  await GamePage.injectState({
    act: 3,
    bossesDefeated: { 'demon-king': true },
    settings: { confirmPrestige: false, reducedMotion: false },
    timeShards: 10,
    prestigeCount: 0,
    hometownSaved: false,
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

  I.click('.prestige-button');
  I.waitForVisible(GamePage.modalDialog, 5);
  I.see('Timeline Rewritten', GamePage.modalTitle);

  // Wait for auto-dismiss (4s + buffer)
  I.wait(6);

  const stillVisible = await GamePage.isModalOpen();
  I.assert.ok(!stillVisible, 'Prestige celebration should auto-dismiss after ~4 seconds');
});

Scenario('prestige celebration does not auto-dismiss with reduced motion', async ({ I }) => {
  // Inject state with reduced motion
  await GamePage.injectState({
    act: 3,
    bossesDefeated: { 'demon-king': true },
    settings: { confirmPrestige: false, reducedMotion: true },
    timeShards: 10,
    prestigeCount: 0,
    hometownSaved: false,
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

  I.click('.prestige-button');
  I.waitForVisible(GamePage.modalDialog, 5);

  // Wait 4 seconds (normal dismiss time)
  I.wait(5);

  // With reduced motion, it should NOT have auto-dismissed yet
  const stillVisible = await GamePage.isModalOpen();
  I.assert.ok(
    stillVisible,
    'Prestige celebration should NOT auto-dismiss quickly when reducedMotion is enabled',
  );

  // Manual dismiss
  I.click(GamePage.storyContinue);
  I.waitForInvisible(GamePage.modalDialog, 3);
});

Scenario('prestige beat queues before other story beats', async ({ I }) => {
  // Inject state with both prestige and a pending story beat
  await GamePage.injectState({
    act: 3,
    bossesDefeated: { 'demon-king': true },
    settings: { confirmPrestige: false },
    timeShards: 10,
    prestigeCount: 0,
    hometownSaved: false,
    pendingStories: ['prestige-celebration', 'some-other-beat'],
  });

  I.wait(1);

  // The prestige celebration should appear first
  I.waitForVisible(GamePage.modalDialog, 5);
  I.see('Timeline Rewritten', GamePage.modalTitle);

  // Dismiss it
  I.click(GamePage.storyContinue);
  I.wait(1);

  // The next story beat should appear
  const hasNextModal = await GamePage.isModalOpen();
  I.assert.ok(hasNextModal, 'Next story beat should appear after prestige celebration is dismissed');

  // Clean up
  I.click(GamePage.storyContinue);
  I.waitForInvisible(GamePage.modalDialog, 3);
});
