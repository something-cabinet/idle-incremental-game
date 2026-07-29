import { describe, expect, it } from 'vitest';
import { generateAdventurer, maxHp } from './adventurers';
import {
  campaignBossDef,
  campaignLockReason,
  campaignTargets,
  fightCampaignStage,
  rollCampaignStage,
  CAMPAIGN_TOTAL_STAGES,
} from './campaign';
import {
  CAMPAIGN_GUARD_STAGES,
  CAMPAIGN_MINIONS,
  CAMPAIGN_VICTORY_EQUIPMENT_COUNT,
  CAMPAIGN_VICTORY_MATERIAL_AMOUNT,
  DEMON_KING_ID,
  DUNGEON_ROOM_COUNT,
  GENERAL_IDS,
} from './config';
import { fightDungeonRoom } from './dungeon';
import { createInitialState } from './logic';
import { canTimeTravel, timeTravel } from './prestige';
import { checkStoryTriggers } from './story';
import type { BattleCarryIn } from './combat';
import type { Adventurer, GameState } from './types';

/** Deterministic PRNG for reproducible tests. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mid = () => 0.5;

/** A champion levelled far past anything the campaign can throw at them, so
 *  win-path tests don't hinge on the exact balance numbers in config. */
function hero(id: number, level = 400): Adventurer {
  const a = { ...generateAdventurer(id, mid), level };
  return { ...a, hp: maxHp(a) };
}

function act3State(adventurers: Adventurer[] = []): GameState {
  return { ...createInitialState(0), act: 3 as const, adventurers };
}

describe('campaign unlock order', () => {
  it('lists the three generals and the king as march targets', () => {
    const ids = campaignTargets().map((t) => t.id);
    expect(ids).toEqual([...GENERAL_IDS, DEMON_KING_ID]);
    for (const id of ids) expect(campaignBossDef(id)).toBeDefined();
  });

  it('is locked before act 3', () => {
    const s = { ...act3State(), act: 2 as const };
    expect(campaignLockReason(s, GENERAL_IDS[0])).toMatch(/road home/i);
  });

  it('opens one general at a time, and the citadel only after all three', () => {
    const s = act3State();
    expect(campaignLockReason(s, GENERAL_IDS[0])).toBeNull();
    expect(campaignLockReason(s, GENERAL_IDS[1])).toMatch(/must fall first/);
    expect(campaignLockReason(s, DEMON_KING_ID)).toMatch(/3 of the king's generals/);

    const twoDown = {
      ...s,
      bossesDefeated: { [GENERAL_IDS[0]]: true, [GENERAL_IDS[1]]: true },
    };
    expect(campaignLockReason(twoDown, GENERAL_IDS[2])).toBeNull();
    expect(campaignLockReason(twoDown, DEMON_KING_ID)).toMatch(/1 of the king's generals/);

    const allDown = {
      ...s,
      bossesDefeated: Object.fromEntries(GENERAL_IDS.map((id) => [id, true])),
    };
    expect(campaignLockReason(allDown, DEMON_KING_ID)).toBeNull();
  });
});

describe('rollCampaignStage', () => {
  it('rolls plain minion waves for every stage before the boss stage', () => {
    const minionNames = new Set(
      CAMPAIGN_MINIONS.filter((m) => m.locationId === 'general-marrow').map((m) => m.name),
    );
    for (let stage = 0; stage < CAMPAIGN_GUARD_STAGES; stage++) {
      const group = rollCampaignStage('general-marrow', stage, mulberry32(10 + stage));
      expect(group.length).toBeGreaterThan(0);
      expect(group.every((m) => !m.isBoss && !m.isSuper)).toBe(true);
      // Names may carry an " A"/" B" disambiguation suffix.
      expect(group.every((m) => minionNames.has(m.name.replace(/ [A-C]$/, '')))).toBe(true);
      expect(group.every((m) => !m.skillIds)).toBe(true);
    }
  });

  it('puts the boss first on the final stage, with skills and an escort', () => {
    const group = rollCampaignStage('demon-king', CAMPAIGN_GUARD_STAGES, mulberry32(7));
    const boss = group[0];
    expect(CAMPAIGN_TOTAL_STAGES).toBe(CAMPAIGN_GUARD_STAGES + 1);
    expect(boss.isBoss).toBe(true);
    expect(boss.name).toBe('The Demon King');
    expect(boss.skillIds).toEqual(campaignBossDef(DEMON_KING_ID)!.skillIds);
    expect(group.slice(1).every((m) => !m.isBoss)).toBe(true);
    // Instance ids stay unique so the battle viewer can tell fighters apart.
    expect(new Set(group.map((m) => m.instanceId)).size).toBe(group.length);
    // The boss is meaningfully bigger than the escort it fights alongside.
    expect(boss.maxHp).toBeGreaterThan(Math.max(...group.slice(1).map((m) => m.maxHp)));
  });

  it('rolls nothing for a zone (zones are farmed, not marched on)', () => {
    expect(rollCampaignStage('forest-edge', 0, mulberry32(1))).toEqual([]);
  });
});

describe('fightCampaignStage', () => {
  it('refuses a locked target, leaving state untouched', () => {
    const state = act3State([hero(1)]);
    const { state: next, result } = fightCampaignStage(state, GENERAL_IDS[1], [1], 0, mulberry32(1));
    expect(next).toBe(state);
    expect(result.outcome).toBe('loss');
    expect(result.monsters).toEqual([]);
  });

  it('a won boss stage fells the boss and pays its one-time spoils', () => {
    const champ = hero(1);
    const state = act3State([champ]);
    const { state: next, result } = fightCampaignStage(
      state,
      GENERAL_IDS[0],
      [champ.id],
      CAMPAIGN_GUARD_STAGES,
      mulberry32(3),
    );

    expect(result.outcome).toBe('win');
    expect(next.bossesDefeated[GENERAL_IDS[0]]).toBe(true);
    expect(next.stats.bossesFelled).toBe(1);
    // Shards (the whole point of the act), a lump of material, guaranteed loot.
    expect(next.timeShards).toBeGreaterThanOrEqual(15);
    expect(next.materials['demon-ash'] ?? 0).toBeGreaterThanOrEqual(
      CAMPAIGN_VICTORY_MATERIAL_AMOUNT,
    );
    expect(next.inventory.length).toBeGreaterThanOrEqual(CAMPAIGN_VICTORY_EQUIPMENT_COUNT);
    expect(next.activityLog.some((e) => e.kind === 'campaign')).toBe(true);
    // Ids stay unique across the battle's drops, the spoils and the log entry.
    const ids = [...next.inventory.map((i) => i.id), ...next.activityLog.map((e) => e.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(next.nextEntityId).toBeGreaterThan(Math.max(...ids));
  });

  it('a won guard stage grants no kill — only the boss stage does', () => {
    const champ = hero(1);
    const state = act3State([champ]);
    const { state: next, result } = fightCampaignStage(
      state,
      GENERAL_IDS[0],
      [champ.id],
      0,
      mulberry32(3),
    );
    expect(result.outcome).toBe('win');
    expect(next.bossesDefeated[GENERAL_IDS[0]]).toBeUndefined();
    expect(next.stats.bossesFelled).toBe(0);
  });

  it('a lost boss stage leaves the boss standing (free retry, injured party)', () => {
    const weak = { ...generateAdventurer(1, mid), level: 1 };
    const state = act3State([{ ...weak, hp: maxHp(weak) }]);
    const { state: next, result } = fightCampaignStage(
      state,
      GENERAL_IDS[0],
      [weak.id],
      CAMPAIGN_GUARD_STAGES,
      mulberry32(4),
    );
    expect(result.outcome).toBe('loss');
    expect(next.bossesDefeated[GENERAL_IDS[0]]).toBeUndefined();
    // No permadeath: the champion is still on the roster, just recovering.
    expect(next.adventurers).toHaveLength(1);
    expect(next.adventurers[0].injuredUntil).toBeGreaterThan(0);
    // ...and can march again once healed.
    expect(campaignLockReason(next, GENERAL_IDS[0])).toBeNull();
  });

  it('carries survivors\' HP/cooldown out for the next stage', () => {
    const champ = hero(1);
    const state = act3State([champ]);
    const { result, carryOut } = fightCampaignStage(
      state,
      GENERAL_IDS[0],
      [champ.id],
      0,
      mulberry32(3),
    );
    const pr = result.party.find((p) => p.advId === champ.id)!;
    expect(pr.knockedOut).toBe(false);
    expect(carryOut[champ.id]).toEqual({
      hp: pr.finalHp,
      skillCooldownRemaining: pr.skillCooldownRemaining,
    });
  });
});

describe('act 2 → act 3', () => {
  it('clearing the Frontier Pass dungeon reveals the hometown and opens the campaign', () => {
    const champ = hero(1);
    let s: GameState = { ...createInitialState(0), act: 2 as const, adventurers: [champ] };
    expect(campaignLockReason(s, GENERAL_IDS[0])).toMatch(/road home/i);

    const { state: cleared } = fightDungeonRoom(
      s,
      'frontier-pass',
      [champ.id],
      DUNGEON_ROOM_COUNT,
      mulberry32(11),
    );
    expect(cleared.locationsCleared['frontier-pass']).toBe(true);

    s = checkStoryTriggers(cleared);
    expect(s.act).toBe(3);
    expect(s.pendingStories).toContain('a3-discovery');
    expect(campaignLockReason(s, GENERAL_IDS[0])).toBeNull();
  });
});

describe('a full act 3', () => {
  it('marches every stage of all four targets in order, then time travels', () => {
    const party = [hero(1), hero(2), hero(3)];
    let s = act3State(party);

    for (const target of [...GENERAL_IDS, DEMON_KING_ID]) {
      expect(campaignLockReason(s, target)).toBeNull();
      let carry: BattleCarryIn = {};
      let ids = party.map((p) => p.id);
      for (let stage = 0; stage < CAMPAIGN_TOTAL_STAGES; stage++) {
        const run = fightCampaignStage(s, target, ids, stage, mulberry32(50 + stage), carry);
        expect(run.result.outcome).toBe('win');
        s = run.state;
        carry = run.carryOut;
        ids = ids.filter((id) => carry[id]);
      }
      expect(s.bossesDefeated[target]).toBe(true);
      // Beating a target locks it — no farming the same general twice.
      expect(fightCampaignStage(s, target, ids, 0, mulberry32(1)).state).toBe(s);
    }

    s = checkStoryTriggers(s);
    expect(s.stats.bossesFelled).toBe(4);
    expect(canTimeTravel(s)).toBe(true);

    const shards = s.timeShards;
    const next = timeTravel(s, 0);
    expect(next.act).toBe(1);
    expect(next.bossesDefeated).toEqual({});
    expect(next.timeShards).toBe(shards); // shards survive; the campaign resets
    expect(next.stats.bossesFelled).toBe(4);
  });
});

describe('campaign → story → prestige', () => {
  it('each general felled fires its own beat, and the king unlocks time travel', () => {
    let s = act3State();
    expect(canTimeTravel(s)).toBe(false);

    s = checkStoryTriggers({ ...s, bossesDefeated: { [GENERAL_IDS[0]]: true } });
    expect(s.pendingStories).toContain('a3-marrow-dead');
    expect(s.pendingStories).not.toContain('a3-vex-dead');

    s = checkStoryTriggers({
      ...s,
      bossesDefeated: Object.fromEntries(
        [...GENERAL_IDS, DEMON_KING_ID].map((id) => [id, true]),
      ),
    });
    expect(s.pendingStories).toEqual(
      expect.arrayContaining(['a3-vex-dead', 'a3-thane-dead', 'a3-king-dead']),
    );
    expect(canTimeTravel(s)).toBe(true);
  });
});
