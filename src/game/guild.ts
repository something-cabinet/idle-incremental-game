import { adventurerStats, generateAdventurer, isInjured, statsWithItem } from './adventurers';
import {
  ADVENTURER_BASE,
  ADVENTURER_MAX,
  ADVENTURER_REP_SCALE,
  BASE_ROSTER_CAP,
  DEMON_KING_ID,
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
  RARITY_SELL_GOLD,
  REROLL_BASE_COST,
  REROLL_COST_GROWTH,
} from './config';
import { productionPerSecond } from './logic';
import { computeModifiers } from './perks';
import type {
  Adventurer,
  EquipSlot,
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

export function sellItems(state: GameState, itemIds: number[]): GameState {
  const ids = new Set(itemIds);
  const sold = state.inventory.filter((i) => ids.has(i.id));
  if (sold.length === 0) return state;
  const gold = sold.reduce((sum, i) => sum + RARITY_SELL_GOLD[i.rarity], 0);
  return {
    ...state,
    inventory: state.inventory.filter((i) => !ids.has(i.id)),
    gold: state.gold + gold,
    totalGoldEarned: state.totalGoldEarned + gold,
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

/** Every target across every zone the guild currently has unlocked. */
export function availableTargets(state: GameState): QuestTargetDef[] {
  return QUEST_TARGETS.filter((t) => isZoneUnlocked(state, t.locationId));
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

/** Seconds one adventurer takes to complete one batch (sublinear in batch size). */
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

/** Solo work-seconds one requirement demands on its own. 0 if the target is unknown. */
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
 * Total adventurer-seconds of combined work to fulfil every requirement of a
 * quest together, once. A multi-requirement quest ("5 wolves AND 3 herbs")
 * demands the sum of each part's work — the party has to do all of it, not
 * just the hardest part.
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
 * maxAdventurers input clamp: always a positive integer, and — when
 * repeatCount is finite — never larger than it (no point assigning more
 * simultaneous workers than there are repeats left to do).
 */
export function clampMaxAdventurers(maxAdventurers: number, repeatCount: number): number {
  const floored = Math.max(QUEST_MIN_ADVENTURERS, Math.floor(maxAdventurers) || QUEST_MIN_ADVENTURERS);
  return repeatCount > 0 ? Math.min(floored, repeatCount) : floored;
}

/** Batches left before the quest auto-removes itself; Infinity if unlimited. */
export function remainingRepeats(quest: Quest): number {
  if (quest.repeatCount <= 0) return Infinity;
  return Math.max(0, quest.repeatCount - quest.completedCount);
}

/** The most adventurers this quest could use right now: its own cap, further
 * bounded by how many repeats it has left. */
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
    maxAdventurers: clampMaxAdventurers(maxAdventurers, repeats),
  };
}

/**
 * Post a quest bundling one or more requirements ("5 Gray Wolves AND 3
 * Forest Herbs") — they must ALL be fulfilled together before the batch pays
 * out. Every requirement's zone must already be unlocked.
 */
export function postQuest(
  state: GameState,
  requirements: QuestRequirement[],
  maxAdventurers: number,
  repeatCount: number,
): GameState {
  const trimmed = requirements.slice(0, QUEST_MAX_REQUIREMENTS);
  if (trimmed.length === 0) return state;
  for (const req of trimmed) {
    const target = questTargetDef(req.targetId);
    if (!target || !isZoneUnlocked(state, target.locationId)) return state;
  }
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
  /** 0-1 fraction of the way through the current batch. */
  fraction: number;
  /** Estimated seconds until the current batch completes, at the current
   * adventurer allocation (shifts if quests join/leave the board). */
  etaSeconds: number;
}

/**
 * Real progress toward this quest's next batch completing — unlike
 * questRates(), this reflects actual accumulated work (Quest.progress), not
 * an instantaneous estimate. Purely informational for the UI: the engine
 * (processQuests) is the only place that grants materials/gold/reputation,
 * which happens in a lump exactly when every requirement's batch completes.
 */
export function questProgress(state: GameState, quest: Quest): QuestProgress {
  const required = questRequiredWork(quest);
  if (required <= 0 || state.quests.length === 0) return { fraction: 0, etaSeconds: Infinity };
  const assigned = allocateAdventurers(state)[quest.id] ?? 0;
  const fraction = Math.min(1, quest.progress / required);
  const remaining = Math.max(0, required - quest.progress);
  return { fraction, etaSeconds: assigned > 0 ? remaining / assigned : Infinity };
}

export interface QuestBatchSummary {
  /** One entry per requirement: the material and amount it grants per completion. */
  materials: { materialId: string; amount: number }[];
  /** Full gold cost of one completed batch (not a rate). */
  gold: number;
  /** Full reputation reward of one completed batch (not a rate). */
  reputation: number;
  /** Seconds for one full batch from a standing start, at the current
   * adventurer allocation — not the remaining time on an in-progress batch. */
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
      return target ? { materialId: target.materialId, amount: r.batchSize } : null;
    })
    .filter((m): m is { materialId: string; amount: number } => m !== null);
  if (materials.length === 0) return null;
  return {
    materials,
    gold: questTotalGold(quest),
    reputation: questTotalReputation(quest),
    timeSeconds: assigned > 0 ? required / assigned : Infinity,
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
