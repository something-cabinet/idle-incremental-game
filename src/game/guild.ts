import { adventurerStats, generateAdventurer, isInjured, statsWithItem } from './adventurers';
import {
  ADVENTURER_BASE,
  ADVENTURER_MAX,
  ADVENTURER_REP_SCALE,
  BASE_ROSTER_CAP,
  CRAFT_GOLD_BASE,
  CRAFT_GOLD_TIER_EXP,
  CRAFT_QUANTITIES,
  CRAFT_TIER_MATERIALS,
  CRAFT_TIME_BASE,
  CRAFT_TIME_QTY_EXP,
  CRAFT_TIME_TIER_EXP,
  DEMON_KING_ID,
  ESSENCE_TIER_DIV,
  GENERAL_IDS,
  GUILD_UPGRADES,
  HIRE_BASE_COST,
  HIRE_COST_GROWTH,
  LOCATIONS,
  QUEST_BATCH_TIME_BASE,
  QUEST_GOLD_BASE,
  QUEST_GOLD_EXP,
  QUEST_GOLD_TIER_EXP,
  QUEST_MAX_BATCH,
  QUEST_MAX_REPEATS_INPUT,
  QUEST_MAX_REQUIREMENTS,
  QUEST_MIN_ADVENTURERS,
  QUEST_MIN_BATCH,
  QUEST_REP_BASE,
  QUEST_TARGETS,
  QUEST_TIME_EXP,
  RARITY_ESSENCE_BASE,
  REROLL_BASE_COST,
  REROLL_COST_GROWTH,
} from './config';
import { productionPerSecond } from './logic';
import { computeModifiers } from './perks';
import type {
  Adventurer,
  EquipSlot,
  Equipment,
  GameState,
  LocationDef,
  Quest,
  QuestRequirement,
  QuestTargetDef,
  Rng,
} from './types';

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

export function rerollCost(state: GameState): number {
  const costMult = computeModifiers(state).costMult;
  return Math.ceil(
    REROLL_BASE_COST * Math.pow(REROLL_COST_GROWTH, state.adventurers.length) * costMult,
  );
}

/** Refill recruit candidates to 3, optionally costing gold (for rerolls). */
function generateCandidates(state: GameState, rng: Rng): Adventurer[] {
  const candidates: Adventurer[] = [];
  for (let i = 0; i < 3; i++) {
    candidates.push(generateAdventurer(state.nextEntityId + i, rng));
  }
  return candidates;
}

export function refreshRecruits(state: GameState, rng: Rng = Math.random): GameState {
  return {
    ...state,
    recruitCandidates: generateCandidates(state, rng),
    nextEntityId: state.nextEntityId + 3,
  };
}

export function rerollRecruits(state: GameState, rng: Rng = Math.random): GameState {
  if (state.act < 2) return state;
  const cost = rerollCost(state);
  if (state.gold < cost) return state;
  return {
    ...state,
    gold: state.gold - cost,
    recruitCandidates: generateCandidates(state, rng),
    nextEntityId: state.nextEntityId + 3,
  };
}

/** Direct hire (skips the recruit picker). Used by tests and auto-refill. */
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

export function hireCandidate(state: GameState, candidateId: number): GameState {
  if (state.act < 2) return state;
  if (state.adventurers.length >= rosterCap(state)) return state;
  const cost = hireCost(state);
  if (state.gold < cost) return state;
  const candidate = state.recruitCandidates.find((c) => c.id === candidateId);
  if (!candidate) return state;
  return {
    ...state,
    gold: state.gold - cost,
    adventurers: [...state.adventurers, candidate],
    recruitCandidates: state.recruitCandidates.filter((c) => c.id !== candidateId),
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

const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'armor', 'trinket'];

/** Ranking used by auto-equip: overall combat value, HP lightly weighted. */
function equipScore(stats: { atk: number; def: number; maxHp: number }): number {
  return stats.atk + stats.def + stats.maxHp * 0.1;
}

/**
 * Equip the best available inventory item in each slot for one adventurer,
 * only swapping when it beats what's already equipped. Weapon scaling is
 * respected via statsWithItem, so the "best" weapon is class/attribute-aware.
 */
export function autoEquipBest(state: GameState, advId: number): GameState {
  let s = state;
  for (const slot of EQUIP_SLOTS) {
    const adv = s.adventurers.find((a) => a.id === advId);
    if (!adv) break;
    let bestId: number | null = null;
    let bestScore = equipScore(adventurerStats(adv)); // current loadout
    for (const cand of s.inventory) {
      if (cand.slot !== slot) continue;
      const score = equipScore(statsWithItem(adv, cand));
      if (score > bestScore) {
        bestScore = score;
        bestId = cand.id;
      }
    }
    if (bestId !== null) s = equipItem(s, advId, bestId);
  }
  return s;
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

/** Material id an item's essence lands in — one essence tier per rarity. */
export function essenceMaterialId(rarity: Equipment['rarity']): string {
  return `${rarity}-essence`;
}

/** Essence yield from disassembling one item: stronger (higher-tier) items
 * of the same rarity break down into more essence than weak ones. */
export function essenceYield(item: Equipment): number {
  return RARITY_ESSENCE_BASE[item.rarity] * (1 + Math.floor(item.tier / ESSENCE_TIER_DIV));
}

/** Break an item down into essence material instead of selling it for gold. */
export function disassembleItem(state: GameState, itemId: number): GameState {
  const item = state.inventory.find((i) => i.id === itemId);
  if (!item) return state;
  const materialId = essenceMaterialId(item.rarity);
  return {
    ...state,
    inventory: state.inventory.filter((i) => i.id !== itemId),
    materials: {
      ...state.materials,
      [materialId]: (state.materials[materialId] ?? 0) + essenceYield(item),
    },
  };
}

export function disassembleItems(state: GameState, itemIds: number[]): GameState {
  const ids = new Set(itemIds);
  const sold = state.inventory.filter((i) => ids.has(i.id));
  if (sold.length === 0) return state;
  const materials = { ...state.materials };
  for (const item of sold) {
    const materialId = essenceMaterialId(item.rarity);
    materials[materialId] = (materials[materialId] ?? 0) + essenceYield(item);
  }
  return {
    ...state,
    inventory: state.inventory.filter((i) => !ids.has(i.id)),
    materials,
  };
}

// ---------------------------------------------------------------------------
// Crafting (the Forge) — one craft job at a time, resolved on a timer in
// engine.ts processCrafting once its endsAt passes.
// ---------------------------------------------------------------------------

export function forgeUnlocked(state: GameState): boolean {
  return (state.guildUpgrades['forge'] ?? 0) > 0;
}

/** Highest tier craftable right now: the highest zone tier reputation has
 * unlocked (0 before any zone is), same gate used for posting quests there. */
export function maxCraftableTier(state: GameState): number {
  const unlockedTiers = zones()
    .filter((z) => isZoneUnlocked(state, z.id))
    .map((z) => z.tier);
  return unlockedTiers.length > 0 ? Math.max(...unlockedTiers) : 0;
}

export function craftMaterialsCost(tier: number, quantity: number): Record<string, number> {
  const recipe = CRAFT_TIER_MATERIALS[tier] ?? {};
  return Object.fromEntries(Object.entries(recipe).map(([id, n]) => [id, n * quantity]));
}

export function craftGoldCost(tier: number, quantity: number): number {
  return Math.ceil(CRAFT_GOLD_BASE * Math.pow(tier, CRAFT_GOLD_TIER_EXP) * quantity);
}

export function craftDurationSeconds(tier: number, quantity: number): number {
  return CRAFT_TIME_BASE * Math.pow(tier, CRAFT_TIME_TIER_EXP) * Math.pow(quantity, CRAFT_TIME_QTY_EXP);
}

/** `_slot` is accepted for symmetry with startCraft; cost/afford checks are
 * slot-independent (every slot costs the same at a given tier/quantity). */
export function canStartCraft(
  state: GameState,
  _slot: EquipSlot,
  tier: number,
  quantity: number,
): boolean {
  if (!forgeUnlocked(state)) return false;
  if (state.crafting) return false; // one job at a time, like expeditions
  if (tier < 1 || tier > maxCraftableTier(state)) return false;
  if (!CRAFT_QUANTITIES.includes(quantity)) return false;
  if (state.gold < craftGoldCost(tier, quantity)) return false;
  const materials = craftMaterialsCost(tier, quantity);
  return Object.entries(materials).every(([id, n]) => (state.materials[id] ?? 0) >= n);
}

export function startCraft(
  state: GameState,
  slot: EquipSlot,
  tier: number,
  quantity: number,
): GameState {
  if (!canStartCraft(state, slot, tier, quantity)) return state;
  const materials = { ...state.materials };
  for (const [id, n] of Object.entries(craftMaterialsCost(tier, quantity))) {
    materials[id] = (materials[id] ?? 0) - n;
  }
  return {
    ...state,
    gold: state.gold - craftGoldCost(tier, quantity),
    materials,
    crafting: {
      slot,
      tier,
      quantity,
      startedAt: state.runTimeSeconds,
      endsAt: state.runTimeSeconds + craftDurationSeconds(tier, quantity),
    },
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

/** Zones unlock once the guild's reputation reaches the zone's threshold. */
export function isZoneUnlocked(state: GameState, locationId: string): boolean {
  const loc = locationDef(locationId);
  if (!loc || loc.kind !== 'zone') return false;
  return state.reputation >= (loc.repRequired ?? 0);
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

// ---------------------------------------------------------------------------
// Quest board — standing bounties fulfilled by the numerous town adventurers
// ---------------------------------------------------------------------------

export function questTargetDef(id: string): QuestTargetDef | undefined {
  return QUEST_TARGETS.find((t) => t.id === id);
}

export function targetsForLocation(locationId: string): QuestTargetDef[] {
  return QUEST_TARGETS.filter((t) => t.locationId === locationId);
}

/**
 * The numerous town adventurers: a single derived number, not managed entities.
 * Grows with the guild's reputation (few at first → hundreds over a long game),
 * softly capped so a small town never fields an army overnight.
 */
export function adventurerCount(state: GameState): number {
  const grown = ADVENTURER_BASE + Math.sqrt(Math.max(0, state.reputation) / ADVENTURER_REP_SCALE);
  return Math.min(ADVENTURER_MAX, Math.floor(grown));
}

/** Difficulty of one unit of a target = its per-unit difficulty × location tier. */
export function unitDifficulty(target: QuestTargetDef): number {
  const tier = locationDef(target.locationId)?.tier ?? 1;
  return target.difficulty * tier;
}

/**
 * Gold-cost difficulty of one unit: difficulty × tier^QUEST_GOLD_TIER_EXP.
 * Steeper than unitDifficulty's linear tier scaling — later, more dangerous
 * zones cost disproportionately more gold to fund, not just proportionally
 * more like time/materials do.
 */
export function goldUnitDifficulty(target: QuestTargetDef): number {
  const tier = locationDef(target.locationId)?.tier ?? 1;
  return target.difficulty * Math.pow(tier, QUEST_GOLD_TIER_EXP);
}

/**
 * Seconds one round of this batch takes to complete (sublinear in batch
 * size). Fixed — how many adventurers are assigned doesn't change this; it
 * changes how many repeats get credited when the round finishes (see
 * questRequiredWork and processQuests).
 */
export function batchTimeSolo(batchSize: number, unitDiff: number): number {
  return QUEST_BATCH_TIME_BASE * unitDiff * Math.pow(batchSize, QUEST_TIME_EXP);
}

/** Gold paid out per completed batch (superlinear in batch size — a gold sink). */
export function batchGold(batchSize: number, goldUnitDiff: number): number {
  return QUEST_GOLD_BASE * goldUnitDiff * Math.pow(batchSize, QUEST_GOLD_EXP);
}

/** Reputation earned per completed batch. */
export function batchReputation(batchSize: number, unitDiff: number): number {
  return QUEST_REP_BASE * unitDiff * batchSize;
}

export function clampBatchSize(batchSize: number): number {
  return Math.max(QUEST_MIN_BATCH, Math.min(QUEST_MAX_BATCH, Math.floor(batchSize)));
}

/** Round-seconds one requirement demands on its own. 0 if the target is unknown. */
export function requirementTime(req: QuestRequirement): number {
  const target = questTargetDef(req.targetId);
  if (!target) return 0;
  return batchTimeSolo(req.batchSize, unitDifficulty(target));
}

/** Gold cost of fulfilling one requirement once. 0 if the target is unknown. */
export function requirementGold(req: QuestRequirement): number {
  const target = questTargetDef(req.targetId);
  if (!target) return 0;
  return batchGold(req.batchSize, goldUnitDifficulty(target));
}

/** Reputation earned from fulfilling one requirement once. 0 if the target is unknown. */
export function requirementReputation(req: QuestRequirement): number {
  const target = questTargetDef(req.targetId);
  if (!target) return 0;
  return batchReputation(req.batchSize, unitDifficulty(target));
}

/**
 * Total seconds one round of this quest takes to complete every requirement
 * together. A multi-requirement quest ("5 wolves AND 3 herbs") demands the
 * sum of each part's round time — the party has to do all of it, not just
 * the hardest part. This is the fixed duration of the progress bar: it does
 * not shrink with more assigned adventurers (see processQuests) — instead,
 * every adventurer assigned when the bar fills completes their own repeat,
 * so more adventurers means more repeats credited per round, not a faster bar.
 */
export function questRequiredWork(quest: { requirements: QuestRequirement[] }): number {
  return quest.requirements.reduce((sum, r) => sum + requirementTime(r), 0);
}

/** Total gold cost of one full completion of every requirement together. */
export function questTotalGold(quest: { requirements: QuestRequirement[] }): number {
  return quest.requirements.reduce((sum, r) => sum + requirementGold(r), 0);
}

/** Total reputation earned from one full completion of every requirement together. */
export function questTotalReputation(quest: { requirements: QuestRequirement[] }): number {
  return quest.requirements.reduce((sum, r) => sum + requirementReputation(r), 0);
}

/** repeatCount input clamp. 0 (QUEST_UNLIMITED_REPEATS) means unlimited. */
export function clampRepeatCount(repeatCount: number): number {
  return Math.max(0, Math.min(QUEST_MAX_REPEATS_INPUT, Math.floor(repeatCount) || 0));
}

/**
 * maxAdventurers input clamp: always a positive integer. Independent of
 * repeatCount at creation time — effectiveAdventurerCap re-applies the
 * repeats-left bound dynamically every tick anyway, so there's no need to
 * force it down up front (and it'd only need re-deriving as completedCount
 * climbs and remainingRepeats shrinks over the quest's life).
 */
export function clampMaxAdventurers(maxAdventurers: number): number {
  return Math.max(QUEST_MIN_ADVENTURERS, Math.floor(maxAdventurers) || QUEST_MIN_ADVENTURERS);
}

/** Batches left before the quest auto-removes itself; Infinity if unlimited. */
export function remainingRepeats(quest: Quest): number {
  if (quest.repeatCount <= 0) return Infinity;
  return Math.max(0, quest.repeatCount - quest.completedCount);
}

/**
 * The most adventurers this quest can usefully hold right now: its own cap,
 * further bounded by repeats left. Each assigned adventurer completes one
 * repeat per round (see processQuests), so assigning more than the repeats
 * remaining would only strand extra workers who'd credit nothing — better to
 * leave them free for other quests on the board.
 */
function effectiveAdventurerCap(quest: Quest): number {
  return Math.min(quest.maxAdventurers, remainingRepeats(quest));
}

/**
 * Splits the town's whole-number adventurer pool across every active quest,
 * integer only (never fractional — a quest can't be worked by "1.5 people").
 * Max-min fair share: repeatedly gives each quest still under its cap an
 * equal whole share of what's left, then hands out any single leftover units
 * one at a time in quest-post order. Some quests can land on 0 if total
 * demand outstrips the pool.
 */
export function allocateAdventurers(state: GameState): Record<number, number> {
  const allocation: Record<number, number> = {};
  for (const q of state.quests) allocation[q.id] = 0;

  let remainingPool = adventurerCount(state);
  let active = state.quests.filter((q) => effectiveAdventurerCap(q) > 0);

  while (remainingPool > 0 && active.length > 0) {
    const share = Math.floor(remainingPool / active.length);
    if (share >= 1) {
      let given = 0;
      for (const q of active) {
        const room = effectiveAdventurerCap(q) - allocation[q.id];
        const grant = Math.min(share, room);
        allocation[q.id] += grant;
        given += grant;
      }
      remainingPool -= given;
      active = active.filter((q) => allocation[q.id] < effectiveAdventurerCap(q));
      if (given === 0) break; // safety: every remaining quest is already at cap
    } else {
      // Fewer adventurers left than active quests — hand out single units
      // in posting order until the pool is empty.
      for (const q of active) {
        if (remainingPool <= 0) break;
        if (allocation[q.id] < effectiveAdventurerCap(q)) {
          allocation[q.id] += 1;
          remainingPool -= 1;
        }
      }
      break;
    }
  }
  return allocation;
}

/** Total gold/sec every active quest on the board would cost right now. */
export function totalQuestGoldPerSec(state: GameState): number {
  if (state.quests.length === 0) return 0;
  const allocation = allocateAdventurers(state);
  return state.quests.reduce((sum, q) => {
    const assigned = allocation[q.id] ?? 0;
    const requiredWork = questRequiredWork(q);
    if (assigned <= 0 || requiredWork <= 0) return sum;
    const batchesPerSec = assigned / requiredWork;
    return sum + questTotalGold(q) * batchesPerSec;
  }, 0);
}

/**
 * Whether the guild can currently sustain its posted quest board. Mirrors the
 * engine's per-tick gold gate (engine.ts processQuests) in its steady state:
 * a positive bank is still draining it, not yet starved; once the bank hits
 * zero, sustaining the board depends on town income alone.
 */
export function questBoardAffordable(state: GameState): boolean {
  if (state.quests.length === 0) return true;
  if (state.gold > 0) return true;
  return productionPerSecond(state) >= totalQuestGoldPerSec(state);
}

export interface QuestRates {
  /** Adventurers currently assigned to this quest — always a whole number. */
  adventurers: number;
  /** Reference-only estimate per material id: what this quest would average
   * per second if run continuously. Actual materials/gold/reputation are
   * granted in a lump when a batch completes (see questProgress and
   * engine.ts processQuests) — this is display guidance, not a promise of a
   * smooth per-tick trickle. */
  materialsPerSec: Record<string, number>;
  goldPerSec: number;
  reputationPerSec: number;
  /** True when the board can't currently be sustained — all rates are 0. */
  goldStarved: boolean;
  /** True when no adventurers are assigned because the pool is spread too
   * thin across the board (distinct from goldStarved — this is a workforce
   * shortage, not a money one). */
  adventurerStarved: boolean;
}

function emptyQuestRates(): QuestRates {
  return {
    adventurers: 0, materialsPerSec: {}, goldPerSec: 0, reputationPerSec: 0,
    goldStarved: false, adventurerStarved: false,
  };
}

/**
 * Reference throughput estimate for a quest, given its actual integer
 * adventurer allocation (see allocateAdventurers). Zeroed out when the board
 * is gold-starved, matching the engine's hard gate — see questBoardAffordable.
 * For real-time progress toward the next actual payout, see questProgress.
 */
export function questRates(state: GameState, quest: Quest): QuestRates {
  if (quest.requirements.length === 0 || state.quests.length === 0) return emptyQuestRates();
  const requiredWork = questRequiredWork(quest);
  if (requiredWork <= 0) return emptyQuestRates();

  const assigned = allocateAdventurers(state)[quest.id] ?? 0;
  const adventurerStarved = assigned <= 0;
  const goldStarved = !questBoardAffordable(state);
  const stalled = goldStarved || adventurerStarved;
  const batchesPerSec = adventurerStarved ? 0 : assigned / requiredWork;

  const materialsPerSec: Record<string, number> = {};
  if (!stalled) {
    for (const req of quest.requirements) {
      const target = questTargetDef(req.targetId);
      if (!target) continue;
      materialsPerSec[target.materialId] =
        (materialsPerSec[target.materialId] ?? 0) + req.batchSize * batchesPerSec;
    }
  }
  return {
    adventurers: assigned,
    materialsPerSec,
    goldPerSec: stalled ? 0 : questTotalGold(quest) * batchesPerSec,
    reputationPerSec: stalled ? 0 : questTotalReputation(quest) * batchesPerSec,
    goldStarved,
    adventurerStarved,
  };
}

/**
 * Projected rates for a quest that isn't posted yet, as if it were added to
 * the board now with the given settings (the extra quest competes for the
 * adventurer pool like any other). Drives the quest-creation dialog's preview.
 */
export function previewQuestRates(
  state: GameState,
  requirements: QuestRequirement[],
  maxAdventurers: number,
  repeatCount: number,
): QuestRates {
  const preview = previewQuest(requirements, maxAdventurers, repeatCount);
  return questRates({ ...state, quests: [...state.quests, preview] }, preview);
}

function previewQuest(
  requirements: QuestRequirement[],
  maxAdventurers: number,
  repeatCount: number,
): Quest {
  const repeats = clampRepeatCount(repeatCount);
  return {
    id: -1,
    requirements: requirements
      .filter((r) => questTargetDef(r.targetId))
      .map((r) => ({ targetId: r.targetId, batchSize: clampBatchSize(r.batchSize) })),
    progress: 0,
    repeatCount: repeats,
    completedCount: 0,
    maxAdventurers: clampMaxAdventurers(maxAdventurers),
  };
}

/**
 * Post a quest bundling one or more requirements ("5 Gray Wolves AND 3
 * Forest Herbs") — they must ALL be fulfilled together before the batch pays
 * out. Every requirement must belong to the same (already-unlocked) zone;
 * cross-zone quests are rejected outright — mixing zones would need every
 * downstream calculation (unlock checks, tier-based difficulty) to reason
 * about a set of zones instead of one, for no real gameplay benefit.
 */
export function postQuest(
  state: GameState,
  requirements: QuestRequirement[],
  maxAdventurers: number,
  repeatCount: number,
): GameState {
  const trimmed = requirements.slice(0, QUEST_MAX_REQUIREMENTS);
  if (trimmed.length === 0) return state;
  const targets = trimmed.map((req) => questTargetDef(req.targetId));
  if (targets.some((t) => !t)) return state;
  const locationId = targets[0]!.locationId;
  if (targets.some((t) => t!.locationId !== locationId)) return state; // no cross-zone quests
  if (!isZoneUnlocked(state, locationId)) return state;
  const quest: Quest = { ...previewQuest(trimmed, maxAdventurers, repeatCount), id: state.nextEntityId };
  return {
    ...state,
    quests: [...state.quests, quest],
    nextEntityId: state.nextEntityId + 1,
  };
}

export function deleteQuest(state: GameState, questId: number): GameState {
  return { ...state, quests: state.quests.filter((q) => q.id !== questId) };
}

export interface QuestProgress {
  /** 0-1 fraction of the way through the current round. */
  fraction: number;
  /** Seconds until the current round completes. Fixed by the quest's own
   * round time — not affected by how many adventurers are assigned (only the
   * number of repeats credited when it fills is). Infinity if nobody's
   * assigned, since the bar doesn't move at all. */
  etaSeconds: number;
}

/**
 * Real progress toward this quest's current round completing — unlike
 * questRates(), this reflects actual accumulated work (Quest.progress), not
 * an instantaneous estimate. Purely informational for the UI: the engine
 * (processQuests) is the only place that grants materials/gold/reputation,
 * which happens in a lump exactly when the round's required time is reached.
 */
export function questProgress(state: GameState, quest: Quest): QuestProgress {
  const required = questRequiredWork(quest);
  if (required <= 0 || state.quests.length === 0) return { fraction: 0, etaSeconds: Infinity };
  const assigned = allocateAdventurers(state)[quest.id] ?? 0;
  const fraction = Math.min(1, quest.progress / required);
  const remaining = Math.max(0, required - quest.progress);
  return { fraction, etaSeconds: assigned > 0 ? remaining : Infinity };
}

export interface QuestBatchSummary {
  /** One entry per requirement: the material and total amount the round
   * grants — already multiplied by how many adventurers are assigned, since
   * each one completes its own repeat when the round fills. */
  materials: { materialId: string; amount: number }[];
  /** Total gold cost of the round (one repeat's cost × adventurers assigned). */
  gold: number;
  /** Total reputation reward of the round (one repeat's reward × adventurers assigned). */
  reputation: number;
  /** Seconds for the round to complete — fixed by the quest itself, not by
   * how many adventurers are assigned (see questRequiredWork). */
  timeSeconds: number;
  /** Adventurers currently assigned (integer; 0 if the pool is spread thin). */
  assigned: number;
  maxAdventurers: number;
  /** 0 means unlimited. */
  repeatCount: number;
  completedCount: number;
  /** Infinity when repeatCount is unlimited. */
  repeatsRemaining: number;
}

function batchSummaryFor(quest: Quest, assigned: number): QuestBatchSummary | null {
  if (quest.requirements.length === 0) return null;
  const required = questRequiredWork(quest);
  const materials = quest.requirements
    .map((r) => {
      const target = questTargetDef(r.targetId);
      return target ? { materialId: target.materialId, amount: r.batchSize * assigned } : null;
    })
    .filter((m): m is { materialId: string; amount: number } => m !== null);
  if (materials.length === 0) return null;
  return {
    materials,
    gold: questTotalGold(quest) * assigned,
    reputation: questTotalReputation(quest) * assigned,
    timeSeconds: assigned > 0 ? required : Infinity,
    assigned,
    maxAdventurers: quest.maxAdventurers,
    repeatCount: quest.repeatCount,
    completedCount: quest.completedCount,
    repeatsRemaining: remainingRepeats(quest),
  };
}

/**
 * The full, absolute cost/reward of one batch of this quest — what the
 * player actually receives in the lump-sum payout, as opposed to
 * questRates()'s "if this ran continuously" per-second estimate.
 */
export function questBatchSummary(state: GameState, quest: Quest): QuestBatchSummary | null {
  if (state.quests.length === 0) return null;
  const assigned = allocateAdventurers(state)[quest.id] ?? 0;
  return batchSummaryFor(quest, assigned);
}

/**
 * Batch summary for a quest that isn't posted yet, with the given settings —
 * drives the quest-creation dialog's full-stats preview.
 */
export function previewBatchSummary(
  state: GameState,
  requirements: QuestRequirement[],
  maxAdventurers: number,
  repeatCount: number,
): QuestBatchSummary | null {
  const preview = previewQuest(requirements, maxAdventurers, repeatCount);
  const withPreview = { ...state, quests: [...state.quests, preview] };
  const assigned = allocateAdventurers(withPreview)[preview.id] ?? 0;
  return batchSummaryFor(preview, assigned);
}
