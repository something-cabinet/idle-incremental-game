import { applyBattleResult, rollMonsterGroup, simulateBattle } from './combat';
import type { BattleOutcome, MonsterInstance } from './combat';
import { DUNGEONS, DUNGEON_COMPLETION_MATERIAL_AMOUNT, DUNGEON_ROOM_COUNT, DUNGEON_BOSS_STAT_MULT, SUPER_STAT_MULT } from './config';
import { locationDef } from './guild';
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
 * this zone; the boss room (roomIndex === DUNGEON_ROOM_COUNT) takes that same
 * roll and amplifies stats/rewards by DUNGEON_BOSS_STAT_MULT (undoing any
 * Super roll first, so the two multipliers don't stack), renamed after the
 * dungeon's boss. */
function rollDungeonRoomMonsters(dungeon: DungeonDef, roomIndex: number, rng: Rng): MonsterInstance[] {
  const group = rollMonsterGroup(dungeon.locationId, rng);
  if (roomIndex < DUNGEON_ROOM_COUNT) return group;
  return group.map((m, i) => {
    const denom = m.isSuper ? SUPER_STAT_MULT : 1;
    const mult = DUNGEON_BOSS_STAT_MULT / denom;
    return {
      ...m,
      name: i === 0 ? dungeon.bossName : `${dungeon.bossName}'s ${m.name}`,
      isSuper: false,
      maxHp: Math.round(m.maxHp * mult),
      atk: Math.round(m.atk * mult),
      def: Math.round(m.def * mult),
      xpReward: Math.round(m.xpReward * mult),
      goldReward: Math.round(m.goldReward * mult),
    };
  });
}

/**
 * Fight one room of a dungeon run (0-based `roomIndex`; DUNGEON_ROOM_COUNT is
 * the boss room) and apply its result — the single entry point the Dungeon UI
 * calls per room, mirroring combat.ts's runExplore. Room-to-room progress
 * (current room, surviving party) is UI-local state, same as ExploreDialog's
 * chained fights — only rewards persist to GameState. On a won boss room, also
 * grants the dungeon's one-time-per-clear completion bonus material.
 */
export function fightDungeonRoom(
  state: GameState,
  locationId: string,
  partyIds: number[],
  roomIndex: number,
  rng: Rng,
): { state: GameState; result: BattleOutcome } {
  const dungeon = dungeonDef(locationId);
  const party = partyIds
    .map((id) => state.adventurers.find((a) => a.id === id))
    .filter((a): a is Adventurer => !!a);
  const monsters = dungeon ? rollDungeonRoomMonsters(dungeon, roomIndex, rng) : [];
  const result = simulateBattle(state, party, monsters, locationId, rng, true);
  let next = applyBattleResult(state, result, rng, 'dungeon');
  if (dungeon && result.outcome === 'win' && roomIndex === DUNGEON_ROOM_COUNT) {
    const materialId = locationDef(locationId)?.materialId;
    if (materialId) {
      const materials = { ...next.materials };
      materials[materialId] = (materials[materialId] ?? 0) + DUNGEON_COMPLETION_MATERIAL_AMOUNT;
      next = { ...next, materials };
    }
  }
  return { state: next, result };
}
