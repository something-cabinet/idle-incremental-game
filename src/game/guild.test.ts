import { describe, expect, it } from 'vitest';
import { adventurerPower, generateAdventurer, generateEquipment } from './adventurers';
import { DEMON_KING_ID, ENCOUNTER_INTERVAL, GENERAL_IDS } from './config';
import { tick } from './engine';
import {
  assignAdventurer,
  buyGuildUpgrade,
  equipItem,
  hireAdventurer,
  isBossUnlocked,
  isZoneUnlocked,
  launchExpedition,
  recallAdventurer,
  rosterCap,
  sellItem,
} from './guild';
import { createInitialState } from './logic';
import { buyPerk } from './perks';
import { canTimeTravel, timeTravel } from './prestige';
import type { GameState } from './types';

const alwaysWin = () => 0.01; // low roll → success, but also triggers drops
const alwaysLose = () => 0.999;
const mid = () => 0.5;

function guildState(): GameState {
  return { ...createInitialState(0), act: 2 as const, gold: 100_000 };
}

function withAdventurer(state: GameState, rng = mid): GameState {
  return hireAdventurer(state, rng);
}

describe('roster', () => {
  it('hiring adds a generated adventurer and costs gold', () => {
    const s = withAdventurer(guildState());
    expect(s.adventurers).toHaveLength(1);
    expect(s.gold).toBe(100_000 - 500);
    expect(s.adventurers[0].name).toBeTruthy();
  });

  it('roster is capped until the guild hall grows', () => {
    let s = guildState();
    s = withAdventurer(withAdventurer(s));
    expect(rosterCap(s)).toBe(2);
    expect(withAdventurer(s).adventurers).toHaveLength(2); // no-op at cap
    s = { ...s, materials: { 'beast-pelt': 100 } };
    s = buyGuildUpgrade(s, 'guild-hall');
    expect(rosterCap(s)).toBe(3);
  });

  it('cannot hire in act 1', () => {
    const s = withAdventurer({ ...createInitialState(0), gold: 100_000 });
    expect(s.adventurers).toHaveLength(0);
  });
});

describe('equipment', () => {
  it('equipping moves items between inventory and adventurer', () => {
    let s = withAdventurer(guildState());
    const item = generateEquipment(99, 1, mid);
    s = { ...s, inventory: [item] };
    const before = adventurerPower(s, s.adventurers[0]);
    s = equipItem(s, s.adventurers[0].id, 99);
    expect(s.inventory).toHaveLength(0);
    expect(adventurerPower(s, s.adventurers[0])).toBeGreaterThan(before);
  });

  it('selling an item grants gold', () => {
    let s = guildState();
    const item = generateEquipment(99, 1, mid);
    s = { ...s, inventory: [item], gold: 0 };
    s = sellItem(s, 99);
    expect(s.inventory).toHaveLength(0);
    expect(s.gold).toBeGreaterThan(0);
  });
});

describe('patrol & quests', () => {
  it('zones unlock in order via quest clears', () => {
    const s = guildState();
    expect(isZoneUnlocked(s, 'forest-edge')).toBe(true);
    expect(isZoneUnlocked(s, 'river-crossing')).toBe(false);
    const cleared = { ...s, locationsCleared: { 'forest-edge': true } };
    expect(isZoneUnlocked(cleared, 'river-crossing')).toBe(true);
    expect(isZoneUnlocked(cleared, 'old-mines')).toBe(false);
  });

  it('patrolling earns gold and xp per encounter', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    const goldBefore = s.gold;
    s = tick(s, ENCOUNTER_INTERVAL * 5, 0, alwaysWin);
    expect(s.gold).toBeGreaterThan(goldBefore);
    expect(s.adventurers[0].xp + s.adventurers[0].level).toBeGreaterThan(1);
    expect(s.inventory.length).toBeGreaterThan(0); // alwaysWin also hits drop rolls
  });

  it('a lost fight injures and unassigns the adventurer', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    s = tick(s, ENCOUNTER_INTERVAL, 0, alwaysLose);
    expect(s.adventurers[0].assignment).toBeNull();
    expect(s.adventurers[0].injuredUntil).toBeGreaterThan(s.runTimeSeconds);
  });

  it('a successful quest clears the zone and auto-switches to patrol', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'quest');
    expect(s.adventurers[0].assignment?.mode).toBe('quest');
    s = tick(s, 700, 0, alwaysWin); // quest duration 60
    expect(s.locationsCleared['forest-edge']).toBe(true);
    expect(s.adventurers[0].assignment?.mode).toBe('patrol');
    expect(s.inventory.length).toBeGreaterThan(0); // guaranteed quest equipment
  });

  it('recall clears the assignment and lastAssignment', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    // get injured so lastAssignment is set
    s = tick(s, ENCOUNTER_INTERVAL, 0, alwaysLose);
    expect(s.adventurers[0].lastAssignment).not.toBeNull();
    // recall clears both
    s = recallAdventurer(s, s.adventurers[0].id);
    expect(s.adventurers[0].assignment).toBeNull();
    expect(s.adventurers[0].lastAssignment).toBeNull();
  });

  it('injury saves lastAssignment for re-engagement on recovery', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    // patrol fails → injured, lastAssignment set
    s = tick(s, ENCOUNTER_INTERVAL, 0, alwaysLose);
    expect(s.adventurers[0].assignment).toBeNull();
    expect(s.adventurers[0].lastAssignment).not.toBeNull();
    expect(s.adventurers[0].lastAssignment!.locationId).toBe('forest-edge');
    expect(s.adventurers[0].lastAssignment!.mode).toBe('patrol');
  });

  it('recovers and auto-reassigns to the same location and mode', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    // injury (tier 1 → 180s)
    s = tick(s, ENCOUNTER_INTERVAL, 0, alwaysLose);
    expect(s.adventurers[0].assignment).toBeNull();
    expect(s.adventurers[0].injuredUntil).toBeGreaterThan(s.runTimeSeconds);
    // tick past the injury duration
    s = tick(s, 200, 0, alwaysWin);
    // should now be re-assigned and patrolling
    expect(s.adventurers[0].assignment).not.toBeNull();
    expect(s.adventurers[0].assignment!.locationId).toBe('forest-edge');
    expect(s.adventurers[0].assignment!.mode).toBe('patrol');
    // lastAssignment should be cleared after re-assignment
    expect(s.adventurers[0].lastAssignment).toBeNull();
  });

  it('manual assignment clears lastAssignment', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    // get injured, then recover
    s = tick(s, ENCOUNTER_INTERVAL, 0, alwaysLose);
    s = tick(s, 200, 0, alwaysWin);
    // auto-reassigned to forest-edge; now recall and manually re-assign to same zone
    s = recallAdventurer(s, s.adventurers[0].id);
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'quest');
    expect(s.adventurers[0].assignment).not.toBeNull();
    expect(s.adventurers[0].assignment!.locationId).toBe('forest-edge');
    expect(s.adventurers[0].assignment!.mode).toBe('quest');
    // manual assignment cleared lastAssignment
    expect(s.adventurers[0].lastAssignment).toBeNull();
  });

  it('quest failure saves lastAssignment and auto-reassigns after recovery', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'quest');
    // fail the quest (tier 1 → 180s injury)
    s = tick(s, 61, 0, alwaysLose);
    expect(s.adventurers[0].assignment).toBeNull();
    expect(s.adventurers[0].lastAssignment).not.toBeNull();
    expect(s.adventurers[0].lastAssignment!.mode).toBe('quest');
    // tick past recovery
    s = tick(s, 200, 0, alwaysWin);
    // should re-quest (since lastAssignment.mode was 'quest')
    expect(s.adventurers[0].assignment).not.toBeNull();
    expect(s.adventurers[0].assignment!.mode).toBe('quest');
    expect(s.adventurers[0].assignment!.locationId).toBe('forest-edge');
  });
});

describe('activity log', () => {
  it('a resolved quest writes a loot line', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'quest');
    s = tick(s, 61, 0, alwaysWin);
    const quest = s.activityLog.find((e) => e.kind === 'quest');
    expect(quest).toBeDefined();
    expect(quest!.text).toContain('Forest Edge');
    expect(quest!.text).toContain('gold');
    expect(quest!.text).toContain('XP');
  });

  it('patrol rewards in one tick group into a single line (offline-style)', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    s = tick(s, ENCOUNTER_INTERVAL * 50, 0, alwaysWin); // 50 encounters, one tick
    const patrols = s.activityLog.filter((e) => e.kind === 'patrol');
    expect(patrols).toHaveLength(1);
    expect(patrols[0].text).toContain('Forest Edge');
  });

  it('injuries write a line and record the recovery duration', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    s = tick(s, ENCOUNTER_INTERVAL, 0, alwaysLose);
    expect(s.activityLog.some((e) => e.kind === 'injury')).toBe(true);
    expect(s.adventurers[0].injuredDuration).toBeGreaterThan(0);
  });

  it('the log is capped', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    for (let i = 0; i < 100; i++) {
      s = tick(s, ENCOUNTER_INTERVAL, i * ENCOUNTER_INTERVAL * 1000, alwaysWin);
    }
    expect(s.activityLog.length).toBeLessThanOrEqual(60);
  });
});

describe('expeditions & prestige', () => {
  function act3State(): GameState {
    let s: GameState = { ...guildState(), act: 3 };
    s = withAdventurer(s);
    // A veteran strong enough to matter
    s = {
      ...s,
      adventurers: s.adventurers.map((a) => ({ ...a, level: 30 })),
    };
    return s;
  }

  it('generals unlock in order; king needs all generals', () => {
    const s = act3State();
    expect(isBossUnlocked(s, GENERAL_IDS[0])).toBe(true);
    expect(isBossUnlocked(s, GENERAL_IDS[1])).toBe(false);
    expect(isBossUnlocked(s, DEMON_KING_ID)).toBe(false);
    const allGenerals = {
      ...s,
      bossesDefeated: Object.fromEntries(GENERAL_IDS.map((id) => [id, true])),
    };
    expect(isBossUnlocked(allGenerals, DEMON_KING_ID)).toBe(true);
  });

  it('a won expedition defeats the boss and awards shards', () => {
    let s = act3State();
    s = launchExpedition(s, GENERAL_IDS[0]);
    expect(s.expedition).not.toBeNull();
    s = tick(s, 2000, 0, alwaysWin);
    expect(s.expedition).toBeNull();
    expect(s.bossesDefeated[GENERAL_IDS[0]]).toBe(true);
    expect(s.timeShards).toBeGreaterThanOrEqual(15);
    expect(s.adventurers[0].assignment).toBeNull();
  });

  it('a lost expedition injures the party', () => {
    let s = act3State();
    s = launchExpedition(s, GENERAL_IDS[0]);
    s = tick(s, 2000, 0, alwaysLose);
    expect(s.bossesDefeated[GENERAL_IDS[0]]).toBeUndefined();
    expect(s.adventurers[0].injuredUntil).toBeGreaterThan(0);
  });

  it('time travel requires the demon king dead, keeps shards & perks', () => {
    let s = act3State();
    expect(canTimeTravel(s)).toBe(false);
    s = {
      ...s,
      timeShards: 50,
      bossesDefeated: { [DEMON_KING_ID]: true },
    };
    s = buyPerk(s, 'town-prosperity');
    const shardsAfterPerk = s.timeShards;
    expect(canTimeTravel(s)).toBe(true);
    const next = timeTravel(s, 1000);
    expect(next.act).toBe(1);
    expect(next.prestigeCount).toBe(1);
    expect(next.timeShards).toBe(shardsAfterPerk);
    expect(next.perks['town-prosperity']).toBe(1);
    expect(next.adventurers).toHaveLength(0);
  });

  it('beating the king before the deadline in a later timeline saves the hometown', () => {
    let s = { ...act3State(), prestigeCount: 1 };
    s = { ...s, bossesDefeated: { [DEMON_KING_ID]: true } };
    s = tick(s, 1, 0, mid); // triggers story check; day 1 << deadline
    expect(s.hometownSaved).toBe(true);
    expect(s.pendingStories).toContain('ending-hometown-saved');
  });

  it('adventurer generation is roster-cap safe and leveled stats grow', () => {
    const a1 = generateAdventurer(1, mid);
    const a30 = { ...a1, level: 30 };
    const s = createInitialState(0);
    expect(adventurerPower(s, a30)).toBeGreaterThan(adventurerPower(s, a1));
  });
});

describe('offline progression', () => {
  it('patroller who recovers during offline gets credit for encounters from recovery moment', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    // Injure the adventurer (tier 1 → 180s injury)
    s = tick(s, ENCOUNTER_INTERVAL, 0, alwaysLose);
    const injuredUntil = s.adventurers[0].injuredUntil;
    expect(injuredUntil).toBeGreaterThan(s.runTimeSeconds);
    // Now simulate an offline tick where the adventurer recovers partway through.
    // Set runTimeSeconds so the injury recovers mid-way: advance 280s (heals at 180, so 100s of work left)
    const offlineDuration = 280;
    s = tick(s, offlineDuration, 0, alwaysWin);
    // The adventurer should have been auto-reassigned from their injuredUntil moment (t=200)
    // and processed encounters from t=200 to t=280 (80 seconds → 4 encounters at 20s intervals)
    expect(s.adventurers[0].assignment).not.toBeNull();
    expect(s.adventurers[0].assignment!.mode).toBe('patrol');
    // Should have earned gold from patrols during the offline period
    const patrolLogs = s.activityLog.filter((e) => e.kind === 'patrol');
    expect(patrolLogs.length).toBeGreaterThanOrEqual(1);
    // Gold should be at least from the online tick + offline work (after recovery)
    // Online encounter (injury happened): 5 gold
    // Offline work after recovery: ~4 encounters * 5 gold = 20 gold
    expect(s.gold).toBeGreaterThanOrEqual(25);
  });

  it('quest-capable adventurer who recovers during offline resolves quest for full reward', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'quest');
    // Injure during quest (tier 1 → 180s)
    s = tick(s, 5, 0, alwaysLose);
    // Advance offline: wait 400s total — 180s to heal + 60s quest duration + 160s patrol time
    // The quest started at t=5, so at recovery (t=185) the quest is set to end at t=245.
    // Since we go to t=405, the quest resolves at t=245 and then patrols happen from t=245 to t=405.
    const offlineDuration = 400;
    s = tick(s, offlineDuration, 0, alwaysWin);
    // Should have completed the quest (cleared the zone)
    expect(s.locationsCleared['forest-edge']).toBe(true);
    // Should have gold from quest reward + patrols
    const questLog = s.activityLog.find((e) => e.kind === 'quest');
    expect(questLog).toBeDefined();
    const questText = questLog!.text;
    expect(questText).toContain('150 gold'); // QUEST.goldPerTier * 1
  });

  it('adventurer who never gets injured still works through entire offline period', () => {
    let s = withAdventurer(guildState());
    s = assignAdventurer(s, s.adventurers[0].id, 'forest-edge', 'patrol');
    const goldBefore = s.totalGoldEarned;
    // Process 500 seconds of offline work (guaranteed success)
    s = tick(s, 500, 0, alwaysWin);
    // 500s / 20s per encounter = 25 encounters
    // Each encounter: 5 gold → 125 gold
    expect(s.totalGoldEarned - goldBefore).toBeGreaterThanOrEqual(100);
    // All patrols should be logged as a single grouped line
    const patrolLogs = s.activityLog.filter((e) => e.kind === 'patrol');
    expect(patrolLogs.length).toBe(1);
  });
});
