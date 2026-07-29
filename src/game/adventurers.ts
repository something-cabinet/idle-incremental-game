import {
  ADVENTURER_EPITHETS,
  ADVENTURER_FIRST_NAMES,
  ADVENTURER_SURNAMES,
  ATK_PER_PRIMARY,
  ATTRIBUTES,
  BONUS_ATTR_TIER_DIV,
  CHAMPION_PERKS,
  CLASS_DEFS,
  CAMPAIGN_SKILLS,
  CLASS_SKILLS,
  DEF_PER_CON,
  DEF_PER_RES,
  EQUIP_BUDGET_BASE,
  EQUIP_TIER_RATE,
  EQUIP_TYPES,
  EXALTED_MIN_TIER,
  EXALTED_PREFIXES,
  EXALTED_WEIGHT,
  HIRE_ATTR_VARIANCE,
  HP_BASE,
  HP_PER_CON,
  ITEM_PREFIXES,
  LCK_FIND_PER_POINT,
  RARITY_BONUS_ATTRS,
  RARITY_MULT,
  RARITY_WEIGHTS,
  SUPER_EXALTED_WEIGHT,
  SUPER_RARITY_WEIGHTS,
  WEAPON_SCALE_BASE,
  WEAPON_SCALE_DIV,
  WEAPON_SCALE_MAX,
  xpToNext,
} from './config';
import { rollEquipmentPerk } from './equipmentPerks';
import { computeModifiers } from './perks';
import type {
  Adventurer,
  AdventurerClass,
  AttributeId,
  Attributes,
  ChampionPerkDef,
  ChampionPerkEffect,
  ClassSkillDef,
  EquipSlot,
  EquipTypeDef,
  Equipment,
  GameState,
  Rarity,
  Rng,
} from './types';

/** Adventurer generation, attributes, stats, XP, and equipment generation. */

const CLASSES: AdventurerClass[] = ['warrior', 'ranger', 'mage'];
const SLOTS: EquipSlot[] = ['weapon', 'armor', 'trinket'];
// Ascendant is deliberately excluded — it's never rolled by rollRarity (see
// ascendEquipment instead), so maxRarity here only ever caps up to exalted.
const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'exalted'];

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * Below EXALTED_MIN_TIER, rarity odds are exactly RARITY_WEIGHTS (unchanged).
 * At/above it, exalted gets a small shot carved out of epic's slice, so low
 * and mid-tier drop rates for common/rare/epic are untouched either way.
 *
 * `maxRarity` caps the roll (used by crafting — see CRAFT_MAX_RARITY): the
 * weight table is filtered down and renormalized over just the allowed
 * rarities, rather than clamping a roll that landed above the cap, so the
 * relative odds among the allowed rarities are unchanged by the cap.
 *
 * `isSuper` swaps in SUPER_RARITY_WEIGHTS/SUPER_EXALTED_WEIGHT (loot from a
 * Super monster — see combat.ts), which shift odds toward epic/exalted. The
 * EXALTED_MIN_TIER gate still applies unchanged: Supers roll exalted *more
 * often once it's unlocked*, they don't unlock it early.
 */
export function rollRarity(
  tier: number,
  rng: Rng,
  maxRarity: Rarity = 'exalted',
  isSuper = false,
): Rarity {
  const baseWeights = isSuper ? SUPER_RARITY_WEIGHTS : RARITY_WEIGHTS;
  const exaltedWeight = isSuper ? SUPER_EXALTED_WEIGHT : EXALTED_WEIGHT;
  const weights: [Rarity, number][] =
    tier >= EXALTED_MIN_TIER
      ? [
          ...baseWeights.map(
            ([rarity, weight]): [Rarity, number] =>
              rarity === 'epic' ? [rarity, weight - exaltedWeight] : [rarity, weight],
          ),
          ['exalted', exaltedWeight],
        ]
      : baseWeights;
  const cap = RARITY_ORDER.indexOf(maxRarity);
  const allowed = weights.filter(([rarity]) => RARITY_ORDER.indexOf(rarity) <= cap);
  const total = allowed.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [rarity, weight] of allowed) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return allowed[allowed.length - 1]?.[0] ?? 'common';
}

// ---------------------------------------------------------------------------
// Equipment generation
// ---------------------------------------------------------------------------

export function equipTypeDef(typeId: string): EquipTypeDef | undefined {
  return EQUIP_TYPES.find((t) => t.id === typeId);
}

/** Ascendant rolls from the same exclusive pool as exalted (it's just the
 *  next step up, not a new flavor of prefix); every other rarity shares the
 *  normal pool — the two pools never mix. */
function rollPrefix(rarity: Rarity, rng: Rng) {
  const pool = rarity === 'exalted' || rarity === 'ascendant' ? EXALTED_PREFIXES : ITEM_PREFIXES;
  const total = pool.reduce((sum, p) => sum + p.weight, 0);
  let roll = rng() * total;
  for (const prefix of pool) {
    roll -= prefix.weight;
    if (roll <= 0) return prefix;
  }
  return pool[0];
}

/** Attribute points granted per bonus/prefix unit at a given tier. */
function attrPointsForTier(tier: number): number {
  return 1 + Math.floor(tier / BONUS_ATTR_TIER_DIV);
}

/**
 * Roll the tier/rarity-scaled stat budget for one equipment type into a
 * concrete name + atk/def/hp/attrs. Shared by generateEquipment (a fresh
 * drop/craft, which also rolls the slot/type/rarity) and ascendEquipment (an
 * upgrade, which keeps the existing item's type/tier and forces rarity to
 * 'ascendant') so the two stay on exactly the same budget math.
 */
function rollEquipmentStats(
  type: EquipTypeDef,
  tier: number,
  rarity: Rarity,
  rng: Rng,
): { name: string; atk: number; def: number; hp: number; attrs: Partial<Attributes> } {
  const prefix = rollPrefix(rarity, rng);
  const mult = RARITY_MULT[rarity];
  const budget =
    EQUIP_BUDGET_BASE * Math.pow(1 + EQUIP_TIER_RATE, tier - 1) * mult * type.budgetMult *
    (0.8 + rng() * 0.4);

  // HP is carved out of the same tier/rarity-scaled budget as atk/def
  // (hpShare of the whole), not a separate stepped bonus — see EquipTypeDef.
  const hpShare = type.hpShare ?? 0;
  const combatBudget = budget * (1 - hpShare);
  let atk = combatBudget * type.atkShare;
  let def = combatBudget * (1 - type.atkShare);
  let hp = budget * hpShare;
  const attrs: Partial<Attributes> = {};

  // Prefix effects are deterministic per prefix id.
  if (prefix.atkMult) atk *= prefix.atkMult;
  if (prefix.defMult) def *= prefix.defMult;
  if (prefix.hpPerTier) hp += prefix.hpPerTier * tier;
  for (const [attr, value] of Object.entries(prefix.attrs ?? {})) {
    attrs[attr as AttributeId] =
      (attrs[attr as AttributeId] ?? 0) + value * attrPointsForTier(tier);
  }

  // Rarity bonuses: roll attributes from the type's relevant pool only.
  for (let i = 0; i < RARITY_BONUS_ATTRS[rarity]; i++) {
    const attr = pick(type.bonusAttrs, rng);
    attrs[attr] = (attrs[attr] ?? 0) + attrPointsForTier(tier);
  }

  return {
    name: `${prefix.name} ${pick(type.names, rng)}`,
    atk: Math.round(atk),
    def: Math.round(def),
    hp: Math.round(hp),
    attrs,
  };
}

/**
 * Generate a piece of equipment scaled to a location tier. `forcedSlot` pins
 * the slot instead of rolling one at random — used by crafting (guild.ts
 * startCraft/engine.ts processCrafting), where the player picks the slot.
 * `maxRarity` caps what can roll (see rollRarity) — crafting uses this to
 * keep the Forge to common/rare (see CRAFT_MAX_RARITY). `isSuper` boosts the
 * rarity roll toward epic/exalted — loot from a Super monster (see combat.ts).
 */
export function generateEquipment(
  id: number,
  tier: number,
  rng: Rng,
  forcedSlot?: EquipSlot,
  maxRarity: Rarity = 'exalted',
  isSuper = false,
): Equipment {
  const slot = forcedSlot ?? pick(SLOTS, rng);
  const type = pick(EQUIP_TYPES.filter((t) => t.slot === slot), rng);
  const rarity = rollRarity(tier, rng, maxRarity, isSuper);
  const rolled = rollEquipmentStats(type, tier, rarity, rng);
  return { id, slot, typeId: type.id, rarity, tier, ...rolled };
}

/**
 * Upgrade an exalted item to ascendant rarity in place — same id/slot/typeId
 * (whoever it's equipped on keeps wearing the same "slot"; see guild.ts
 * ascendItem) and tier, but its atk/def/hp/attrs/name are fully re-rolled at
 * ascendant's much bigger budget (RARITY_MULT/RARITY_BONUS_ATTRS) via the
 * same rollEquipmentStats used for a fresh drop.
 *
 * Ascending also grants the item a perk — a combat trait belonging to the
 * gear itself, exclusive to this rarity (see equipmentPerks.ts).
 */
export function ascendEquipment(item: Equipment, rng: Rng): Equipment {
  const type = equipTypeDef(item.typeId);
  if (!type) return item;
  const rolled = rollEquipmentStats(type, item.tier, 'ascendant', rng);
  return { ...item, rarity: 'ascendant', perkId: rollEquipmentPerk(rng), ...rolled };
}

// ---------------------------------------------------------------------------
// Adventurers
// ---------------------------------------------------------------------------

/** first + surname, with a chance of a quoted nickname wedged between. */
const NICKNAME_CHANCE = 0.3;
function generateName(rng: Rng): string {
  const first = pick(ADVENTURER_FIRST_NAMES, rng);
  const surname = pick(ADVENTURER_SURNAMES, rng);
  if (rng() < NICKNAME_CHANCE) {
    return `${first} "${pick(ADVENTURER_EPITHETS, rng)}" ${surname}`;
  }
  return `${first} ${surname}`;
}

export function generateAdventurer(id: number, rng: Rng): Adventurer {
  const className = pick(CLASSES, rng);
  const base = CLASS_DEFS[className].base;
  const attributes = {} as Attributes;
  for (const { id: attr } of ATTRIBUTES) {
    const variance = Math.round((rng() * 2 - 1) * HIRE_ATTR_VARIANCE);
    attributes[attr] = Math.max(1, base[attr] + variance);
  }
  // Perk is rolled last so the class/attribute/name rng stream is unchanged.
  const adv: Adventurer = {
    id,
    name: generateName(rng),
    className,
    perkId: pick(CHAMPION_PERKS, rng).id,
    skillId: pick(skillsForClass(className), rng).id,
    level: 1,
    xp: 0,
    attributes,
    hp: 0,
    equipment: {},
    assignment: null,
    injuredUntil: 0,
    injuredDuration: 0,
    lastAssignment: null,
    enemiesDefeated: 0,
    totalDamageDealt: 0,
  };
  return { ...adv, hp: maxHp(adv) };
}

// ---------------------------------------------------------------------------
// Champion perks (passive, one per champion — see CHAMPION_PERKS)
// ---------------------------------------------------------------------------

export function championPerk(perkId: string | undefined): ChampionPerkDef | undefined {
  return CHAMPION_PERKS.find((p) => p.id === perkId);
}

/** The active skills available to a class (its generation pool). */
export function skillsForClass(className: AdventurerClass): ClassSkillDef[] {
  return CLASS_SKILLS.filter((s) => s.className === className);
}

export function championSkill(skillId: string | undefined): ClassSkillDef | undefined {
  return CLASS_SKILLS.find((s) => s.id === skillId);
}

/** Any active skill by id — champion class pools and Act 3 boss kits alike
 *  (see CAMPAIGN_SKILLS). Used by combat.ts to arm a boss combatant. */
export function skillDef(skillId: string | undefined): ClassSkillDef | undefined {
  return championSkill(skillId) ?? CAMPAIGN_SKILLS.find((s) => s.id === skillId);
}

/** The active perk's effects (empty if the champion somehow has no valid perk). */
export function championPerkEffects(adv: Adventurer): ChampionPerkEffect[] {
  return championPerk(adv.perkId)?.effects ?? [];
}

/** Product of a scalar multiplier effect of `kind` across the champion's perk. */
function perkMult(effects: ChampionPerkEffect[], kind: 'hpMult' | 'growthMult' | 'xpMult' | 'recoveryMult'): number {
  return effects.reduce((m, e) => (e.kind === kind ? m * e.mult : m), 1);
}

/**
 * Effective attributes: level-1 roll + class growth per level + gear bonuses.
 * Perk stat effects (attrMult/allAttrMult/convertToStat/growthMult) act on the
 * champion's *innate* attributes only; gear bonuses are added flat on top, so a
 * "+5 STR" ring always yields +5 regardless of a percentage perk.
 */
export function effectiveAttributes(adv: Adventurer): Attributes {
  const growth = CLASS_DEFS[adv.className].growth;
  const effects = championPerkEffects(adv);
  const growthMult = perkMult(effects, 'growthMult');

  const innate = {} as Attributes;
  for (const { id } of ATTRIBUTES) {
    innate[id] = adv.attributes[id] + growth[id] * growthMult * (adv.level - 1);
  }

  // convertToStat moves a share of every other attribute into one, before any
  // percentage multipliers scale the result.
  for (const e of effects) {
    if (e.kind !== 'convertToStat') continue;
    let moved = 0;
    for (const { id } of ATTRIBUTES) {
      if (id === e.to) continue;
      const take = innate[id] * e.fraction;
      innate[id] -= take;
      moved += take;
    }
    innate[e.to] += moved;
  }
  for (const e of effects) {
    if (e.kind === 'attrMult') innate[e.attr] *= e.mult;
    else if (e.kind === 'allAttrMult') for (const { id } of ATTRIBUTES) innate[id] *= e.mult;
  }

  const result = {} as Attributes;
  for (const { id } of ATTRIBUTES) result[id] = Math.max(1, Math.round(innate[id]));

  for (const item of Object.values(adv.equipment)) {
    if (!item) continue;
    for (const [attr, value] of Object.entries(item.attrs ?? {})) {
      result[attr as AttributeId] += value;
    }
  }
  return result;
}

export function maxHp(adv: Adventurer): number {
  const attrs = effectiveAttributes(adv);
  const hpMult = perkMult(championPerkEffects(adv), 'hpMult');
  let bonus = 0;
  for (const item of Object.values(adv.equipment)) {
    if (item) bonus += item.hp ?? 0;
  }
  // Perk hpMult scales the innate (base + CON) pool; flat gear HP is added after.
  return Math.round((HP_BASE + attrs.con * HP_PER_CON) * hpMult + bonus);
}

/** Injury-recovery multiplier from the champion's perk (<1 = faster). */
export function perkRecoveryMult(adv: Adventurer): number {
  return perkMult(championPerkEffects(adv), 'recoveryMult');
}

/**
 * Weapon damage multiplier from its governing attribute — a high-STR wielder
 * makes a greatsword hit far harder than a low-STR one.
 */
function weaponStatScale(stat: number): number {
  return Math.min(WEAPON_SCALE_MAX, WEAPON_SCALE_BASE + stat / WEAPON_SCALE_DIV);
}

/**
 * A champion's combat stats. `powerMult` is the cross-timeline adventurer-power
 * perk multiplier (computeModifiers(state).powerMult) — callers that have the
 * state pass it so the number they show is the number that fights; the default
 * of 1 is for comparisons where it would cancel out anyway (e.g. ranking two
 * candidate items in autoEquipBest).
 */
export function adventurerStats(adv: Adventurer, powerMult = 1): {
  atk: number;
  def: number;
  maxHp: number;
} {
  const cls = CLASS_DEFS[adv.className];
  const attrs = effectiveAttributes(adv);
  let atk = attrs[cls.primary] * ATK_PER_PRIMARY;
  let def = attrs.con * DEF_PER_CON + attrs.res * DEF_PER_RES;
  for (const item of Object.values(adv.equipment)) {
    if (!item) continue;
    const type = equipTypeDef(item.typeId);
    if (type?.scaling) {
      // Weapon: scale by governing stat and class proficiency.
      const proficiency = cls.weaponProficiency[type.id] ?? 0.5;
      atk += item.atk * weaponStatScale(attrs[type.scaling]) * proficiency;
    } else {
      atk += item.atk;
    }
    def += item.def;
  }
  return {
    atk: Math.round(atk * powerMult),
    def: Math.round(def * powerMult),
    maxHp: maxHp(adv),
  };
}

/** Convenience wrapper for the common "stats as they'll actually fight" call. */
export function adventurerStatsIn(state: GameState, adv: Adventurer) {
  return adventurerStats(adv, computeModifiers(state).powerMult);
}

/** Single combat rating (atk + def), for rough strength comparisons. */
export function adventurerPower(state: GameState, adv: Adventurer): number {
  const { atk, def } = adventurerStatsIn(state, adv);
  return atk + def;
}

/** Stats this adventurer would have with `item` occupying its slot. */
export function statsWithItem(adv: Adventurer, item: Equipment, powerMult = 1): {
  atk: number;
  def: number;
  maxHp: number;
} {
  return adventurerStats(
    { ...adv, equipment: { ...adv.equipment, [item.slot]: item } },
    powerMult,
  );
}

/**
 * Stat change from equipping `item` into its slot, vs whatever is there now
 * (weapon scaling and any replaced item are accounted for). Positive = gain.
 */
export function equipDelta(
  adv: Adventurer,
  item: Equipment,
): { atk: number; def: number; hp: number } {
  const before = adventurerStats(adv);
  const after = statsWithItem(adv, item);
  return {
    atk: after.atk - before.atk,
    def: after.def - before.def,
    hp: after.maxHp - before.maxHp,
  };
}

/** Find-chance multiplier from LCK (materials, equipment, shards). */
export function luckFindMult(adv: Adventurer): number {
  return 1 + effectiveAttributes(adv).lck * LCK_FIND_PER_POINT;
}

export function isInjured(adv: Adventurer, runTimeSeconds: number): boolean {
  return adv.injuredUntil > runTimeSeconds;
}

/** Returns a new adventurer with XP added and any level-ups applied. The
 *  champion's perk xpMult scales the incoming amount (applies everywhere,
 *  including Auto-Explore / offline). */
export function gainXp(adv: Adventurer, amount: number): Adventurer {
  let { level, xp } = adv;
  xp += Math.round(amount * perkMult(championPerkEffects(adv), 'xpMult'));
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  if (level === adv.level) return { ...adv, xp };
  // Level-ups raise CON; grow current HP by the same amount max HP grew.
  const next = { ...adv, level, xp };
  return { ...next, hp: Math.min(maxHp(next), next.hp + (maxHp(next) - maxHp(adv))) };
}
