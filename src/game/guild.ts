import { generateAdventurer, isInjured } from './adventurers';
import {
  BASE_ROSTER_CAP,
  DEMON_KING_ID,
  GENERAL_IDS,
  GUILD_UPGRADES,
  HIRE_BASE_COST,
  HIRE_COST_GROWTH,
  LOCATIONS,
  RARITY_SELL_GOLD,
} from './config';
import { computeModifiers } from './perks';
import type { Adventurer, EquipSlot, GameState, LocationDef, Rng } from './types';

/** Guild management actions: hiring, upgrades, gear, assignments, expeditions. */

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export function rosterCap(state: GameState): number {
  return BASE_ROSTER_CAP + (state.guildUpgrades['guild-hall'] ?? 0);
}

export function hireCost(state: GameState): number {
  const costMult = computeModifiers(state).costMult;
  return Math.ceil(
    HIRE_BASE_COST * Math.pow(HIRE_COST_GROWTH, state.adventurers.length) * costMult,
  );
}

export function hireAdventurer(state: GameState, rng: Rng = Math.random): GameState {
  if (state.act < 2) return state;
  if (state.adventurers.length >= rosterCap(state)) return state;
  const cost = hireCost(state);
  if (state.gold < cost) return state;
  const adv = generateAdventurer(state.nextEntityId, rng);
  return {
    ...state,
    gold: state.gold - cost,
    nextEntityId: state.nextEntityId + 1,
    adventurers: [...state.adventurers, adv],
  };
}

// ---------------------------------------------------------------------------
// Guild upgrades (gold + material sink)
// ---------------------------------------------------------------------------

export function guildUpgradeCost(
  state: GameState,
  upgradeId: string,
): { gold: number; materials: Record<string, number> } {
  const def = GUILD_UPGRADES.find((u) => u.id === upgradeId);
  if (!def) return { gold: Infinity, materials: {} };
  const level = state.guildUpgrades[upgradeId] ?? 0;
  const scale = Math.pow(def.costGrowth, level);
  const costMult = computeModifiers(state).costMult;
  return {
    gold: Math.ceil(def.baseCostGold * scale * costMult),
    materials: Object.fromEntries(
      Object.entries(def.materials).map(([id, n]) => [id, Math.ceil(n * scale)]),
    ),
  };
}

export function canBuyGuildUpgrade(state: GameState, upgradeId: string): boolean {
  const def = GUILD_UPGRADES.find((u) => u.id === upgradeId);
  if (!def) return false;
  if ((state.guildUpgrades[upgradeId] ?? 0) >= def.maxLevel) return false;
  const cost = guildUpgradeCost(state, upgradeId);
  if (state.gold < cost.gold) return false;
  return Object.entries(cost.materials).every(
    ([id, n]) => (state.materials[id] ?? 0) >= n,
  );
}

export function buyGuildUpgrade(state: GameState, upgradeId: string): GameState {
  if (!canBuyGuildUpgrade(state, upgradeId)) return state;
  const cost = guildUpgradeCost(state, upgradeId);
  const materials = { ...state.materials };
  for (const [id, n] of Object.entries(cost.materials)) {
    materials[id] = (materials[id] ?? 0) - n;
  }
  return {
    ...state,
    gold: state.gold - cost.gold,
    materials,
    guildUpgrades: {
      ...state.guildUpgrades,
      [upgradeId]: (state.guildUpgrades[upgradeId] ?? 0) + 1,
    },
  };
}

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

function updateAdventurer(
  state: GameState,
  advId: number,
  fn: (adv: Adventurer) => Adventurer,
): GameState {
  return {
    ...state,
    adventurers: state.adventurers.map((a) => (a.id === advId ? fn(a) : a)),
  };
}

/** Equip an inventory item; any item it replaces returns to the inventory. */
export function equipItem(state: GameState, advId: number, itemId: number): GameState {
  const item = state.inventory.find((i) => i.id === itemId);
  const adv = state.adventurers.find((a) => a.id === advId);
  if (!item || !adv) return state;
  const replaced = adv.equipment[item.slot];
  const inventory = state.inventory.filter((i) => i.id !== itemId);
  if (replaced) inventory.push(replaced);
  return updateAdventurer({ ...state, inventory }, advId, (a) => ({
    ...a,
    equipment: { ...a.equipment, [item.slot]: item },
  }));
}

export function unequipItem(state: GameState, advId: number, slot: EquipSlot): GameState {
  const adv = state.adventurers.find((a) => a.id === advId);
  const item = adv?.equipment[slot];
  if (!adv || !item) return state;
  return updateAdventurer(
    { ...state, inventory: [...state.inventory, item] },
    advId,
    (a) => {
      const equipment = { ...a.equipment };
      delete equipment[slot];
      return { ...a, equipment };
    },
  );
}

export function sellItem(state: GameState, itemId: number): GameState {
  const item = state.inventory.find((i) => i.id === itemId);
  if (!item) return state;
  return {
    ...state,
    inventory: state.inventory.filter((i) => i.id !== itemId),
    gold: state.gold + RARITY_SELL_GOLD[item.rarity],
    totalGoldEarned: state.totalGoldEarned + RARITY_SELL_GOLD[item.rarity],
  };
}

// ---------------------------------------------------------------------------
// Locations & assignments
// ---------------------------------------------------------------------------

export function locationDef(id: string): LocationDef | undefined {
  return LOCATIONS.find((l) => l.id === id);
}

export function zones(): LocationDef[] {
  return LOCATIONS.filter((l) => l.kind === 'zone');
}

export function bosses(): LocationDef[] {
  return LOCATIONS.filter((l) => l.kind === 'boss');
}

/** Zones unlock in order: each opens once the previous zone's quest is cleared. */
export function isZoneUnlocked(state: GameState, locationId: string): boolean {
  const zoneList = zones();
  const index = zoneList.findIndex((z) => z.id === locationId);
  if (index < 0) return false;
  if (index === 0) return true;
  return !!state.locationsCleared[zoneList[index - 1].id];
}

/** Generals unlock in act 3; the demon king needs all generals defeated. */
export function isBossUnlocked(state: GameState, locationId: string): boolean {
  if (state.act < 3) return false;
  if (state.bossesDefeated[locationId]) return false; // one kill per timeline
  if (locationId === DEMON_KING_ID) {
    return GENERAL_IDS.every((id) => state.bossesDefeated[id]);
  }
  const index = GENERAL_IDS.indexOf(locationId);
  if (index < 0) return false;
  return index === 0 || !!state.bossesDefeated[GENERAL_IDS[index - 1]];
}

export function canAssign(state: GameState, advId: number): boolean {
  const adv = state.adventurers.find((a) => a.id === advId);
  if (!adv) return false;
  return !isInjured(adv, state.runTimeSeconds) && adv.assignment === null;
}

/** Send an adventurer to a zone on patrol or quest. */
export function assignAdventurer(
  state: GameState,
  advId: number,
  locationId: string,
  mode: 'patrol' | 'quest',
): GameState {
  const loc = locationDef(locationId);
  if (!loc || loc.kind !== 'zone') return state;
  if (state.act < 2 || !isZoneUnlocked(state, locationId)) return state;
  if (!canAssign(state, advId)) return state;
  return updateAdventurer(state, advId, (a) => ({
    ...a,
    assignment: {
      locationId,
      mode,
      questEndsAt:
        mode === 'quest' ? state.runTimeSeconds + loc.questDuration : undefined,
      lastEncounterAt: state.runTimeSeconds,
    },
    lastAssignment: null, // manual assignment overrides any auto-reassign memory
  }));
}

export function recallAdventurer(state: GameState, advId: number): GameState {
  const adv = state.adventurers.find((a) => a.id === advId);
  if (!adv) return state;
  // If on expedition, cannot recall
  if (adv.assignment?.mode === 'expedition') return state;
  // If already idle (from injury), still clear lastAssignment so they don't auto-re-engage
  return updateAdventurer(state, advId, (a) => ({
    ...a,
    assignment: null,
    lastAssignment: null, // player explicitly stopped them, so forget past work
  }));
}

// ---------------------------------------------------------------------------
// Expeditions (act 3 boss fights): all idle, healthy adventurers march together
// ---------------------------------------------------------------------------

export function expeditionCandidates(state: GameState): Adventurer[] {
  return state.adventurers.filter(
    (a) => a.assignment === null && !isInjured(a, state.runTimeSeconds),
  );
}

export function launchExpedition(state: GameState, locationId: string): GameState {
  const loc = locationDef(locationId);
  if (!loc || loc.kind !== 'boss') return state;
  if (!isBossUnlocked(state, locationId)) return state;
  if (state.expedition) return state; // one at a time
  const members = expeditionCandidates(state);
  if (members.length === 0) return state;
  const memberIds = members.map((m) => m.id);
  return {
    ...state,
    expedition: {
      locationId,
      endsAt: state.runTimeSeconds + loc.questDuration,
      memberIds,
    },
    adventurers: state.adventurers.map((a) =>
      memberIds.includes(a.id)
        ? {
            ...a,
            assignment: {
              locationId,
              mode: 'expedition' as const,
              lastEncounterAt: state.runTimeSeconds,
            },
          }
        : a,
    ),
  };
}
