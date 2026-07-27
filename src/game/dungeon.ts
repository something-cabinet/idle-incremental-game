import { applyBattleResult, rollMonsterGroup, simulateBattle } from './combat';
import type { BattleCarryIn, BattleOutcome, MonsterInstance } from './combat';
import { DUNGEONS, DUNGEON_COMPLETION_MATERIAL_AMOUNT, DUNGEON_ROOM_COUNT, DUNGEON_BOSS_STAT_MULT, SUPER_STAT_MULT } from './config';
import { locationDef } from './guild';
import { addStats } from './stats';
import type { Adventurer, DungeonDef, DungeonProgress, GameState, Rng } from './types';

/** Dungeons: a repeatable multi-room gauntlet per zone (DUNGEON_ROOM_COUNT
 * regular rooms, then one amplified boss room), unlocked by winning enough
 * manual Explore battles at that zone (see combat.ts recordDungeonWin). This
 * module resolves the rooms; the win-counting/unlock state lives on
 * GameState.dungeonProgress and is written from combat.ts. */

export const DUNGEON_TOTAL_ROOMS = DUNGEON_ROOM_COUNT + 1;

export function dungeonDef(locationId: string): DungeonDef | undefined {
  return DUNGEONS.find((d) => d.locationId === locationId);
}

export function dungeonProgress(state: GameState, locationId: string): DungeonProgress {
  return state.dungeonProgress[locationId] ?? { wins: 0, unlocked: false };
}

export function isDungeonUnlocked(state: GameState, locationId: string): boolean {
  return dungeonProgress(state, locationId).unlocked;
}

/** Roll a room's monster group. Regular rooms are a normal Explore roll for
 * this zone. The boss room (roomIndex === DUNGEON_ROOM_COUNT) is a single
 * amplified boss monster — stats/rewards scaled by DUNGEON_BOSS_STAT_MULT,
 * undoing any Super roll first so the two multipliers don't stack — plus a
 * normal support group from the zone's usual roll, so the boss never fights
 * alone. Only the boss gets the isBoss flag (bigger sprite, its own health
 * bar in the battle viewer); the support monsters are unscaled and unnamed. */
function rollDungeonRoomMonsters(dungeon: DungeonDef, roomIndex: number, rng: Rng): MonsterInstance[] {
  if (roomIndex < DUNGEON_ROOM_COUNT) return rollMonsterGroup(dungeon.locationId, rng);

  const bossBase = rollMonsterGroup(dungeon.locationId, rng)[0];
  const support = rollMonsterGroup(dungeon.locationId, rng).map((m, i) => ({ ...m, instanceId: i + 1 }));
  if (!bossBase) return support;

  const denom = bossBase.isSuper ? SUPER_STAT_MULT : 1;
  const mult = DUNGEON_BOSS_STAT_MULT / denom;
  const boss: MonsterInstance = {
    ...bossBase,
    instanceId: 0,
    name: dungeon.bossName,
    isSuper: false,
    isBoss: true,
    maxHp: Math.round(bossBase.maxHp * mult),
    atk: Math.round(bossBase.atk * mult),
    def: Math.round(bossBase.def * mult),
    xpReward: Math.round(bossBase.xpReward * mult),
    goldReward: Math.round(bossBase.goldReward * mult),
  };
  return [boss, ...support];
}

/**
 * Fight one room of a dungeon run (0-based `roomIndex`; DUNGEON_ROOM_COUNT is
 * the boss room) and apply its result — the single entry point the Dungeon UI
 * calls per room, mirroring combat.ts's runExplore. Room-to-room progress
 * (current room, surviving party) is UI-local state, same as ExploreDialog's
 * chained fights — only rewards persist to GameState. On a won boss room, also
 * grants the dungeon's one-time-per-clear completion bonus material.
 *
 * `carryIn`/the returned `carryOut` let the caller thread each survivor's HP
 * and skill cooldown from one room straight into the next, instead of every
 * room starting fresh at full HP and a half-charged skill — the whole run
 * plays like one continuous fight against a series of monster groups.
 */
export function fightDungeonRoom(
  state: GameState,
  locationId: string,
  partyIds: number[],
  roomIndex: number,
  rng: Rng,
  carryIn?: BattleCarryIn,
): { state: GameState; result: BattleOutcome; carryOut: BattleCarryIn } {
  const dungeon = dungeonDef(locationId);
  const party = partyIds
    .map((id) => state.adventurers.find((a) => a.id === id))
    .filter((a): a is Adventurer => !!a);
  const monsters = dungeon ? rollDungeonRoomMonsters(dungeon, roomIndex, rng) : [];
  const result = simulateBattle(state, party, monsters, locationId, rng, true, carryIn);
  let next = applyBattleResult(state, result, rng, 'dungeon');
  if (dungeon && result.outcome === 'win' && roomIndex === DUNGEON_ROOM_COUNT) {
    next = addStats(next, { dungeonsCleared: 1 });
    const materialId = locationDef(locationId)?.materialId;
    if (materialId) {
      const materials = { ...next.materials };
      materials[materialId] = (materials[materialId] ?? 0) + DUNGEON_COMPLETION_MATERIAL_AMOUNT;
      next = { ...next, materials };
    }
  }
  const carryOut: BattleCarryIn = {};
  for (const p of result.party) {
    if (p.knockedOut) continue;
    carryOut[p.advId] = { hp: p.finalHp, skillCooldownRemaining: p.skillCooldownRemaining };
  }
  return { state: next, result, carryOut };
}
