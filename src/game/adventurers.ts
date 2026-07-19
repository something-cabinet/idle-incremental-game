import {
  ADVENTURER_EPITHETS,
  ADVENTURER_FIRST_NAMES,
  ATK_PER_PRIMARY,
  ATTRIBUTES,
  BONUS_ATTR_TIER_DIV,
  CLASS_DEFS,
  DEF_PER_CON,
  DEF_PER_RES,
  EQUIP_TYPES,
  HIRE_ATTR_VARIANCE,
  HP_BASE,
  HP_BONUS_PER_TIER,
  HP_PER_CON,
  ITEM_PREFIXES,
  LCK_FIND_PER_POINT,
  RARITY_BONUS_ATTRS,
  RARITY_MULT,
  RARITY_WEIGHTS,
  WEAPON_SCALE_BASE,
  WEAPON_SCALE_DIV,
  WEAPON_SCALE_MAX,
  xpToNext,
} from './config';
import { computeModifiers } from './perks';
import type {
  Adventurer,
  AdventurerClass,
  AttributeId,
  Attributes,
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

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

export function rollRarity(rng: Rng): Rarity {
  let roll = rng();
  for (const [rarity, weight] of RARITY_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return 'common';
}

// ---------------------------------------------------------------------------
// Equipment generation
// ---------------------------------------------------------------------------

export function equipTypeDef(typeId: string): EquipTypeDef | undefined {
  return EQUIP_TYPES.find((t) => t.id === typeId);
}

function rollPrefix(rng: Rng) {
  const total = ITEM_PREFIXES.reduce((sum, p) => sum + p.weight, 0);
  let roll = rng() * total;
  for (const prefix of ITEM_PREFIXES) {
    roll -= prefix.weight;
    if (roll <= 0) return prefix;
  }
  return ITEM_PREFIXES[0];
}

/** Attribute points granted per bonus/prefix unit at a given tier. */
function attrPointsForTier(tier: number): number {
  return 1 + Math.floor(tier / BONUS_ATTR_TIER_DIV);
}

/** Generate a piece of equipment scaled to a location tier. */
export function generateEquipment(id: number, tier: number, rng: Rng): Equipment {
  const slot = pick(SLOTS, rng);
  const type = pick(EQUIP_TYPES.filter((t) => t.slot === slot), rng);
  const rarity = rollRarity(rng);
  const prefix = rollPrefix(rng);
  const mult = RARITY_MULT[rarity];
  const budget = (4 + tier * 4) * mult * type.budgetMult * (0.8 + rng() * 0.4);

  let atk = budget * type.atkShare;
  let def = budget * (1 - type.atkShare);
  let hp = 0;
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
  if (type.bonusHp && rarity !== 'common') {
    hp += HP_BONUS_PER_TIER * tier * (rarity === 'epic' ? 2 : 1);
  }

  return {
    id,
    slot,
    typeId: type.id,
    rarity,
    name: `${prefix.name} ${pick(type.names, rng)}`,
    atk: Math.round(atk),
    def: Math.round(def),
    hp: Math.round(hp),
    attrs,
  };
}

// ---------------------------------------------------------------------------
// Adventurers
// ---------------------------------------------------------------------------

export function generateAdventurer(id: number, rng: Rng): Adventurer {
  const className = pick(CLASSES, rng);
  const base = CLASS_DEFS[className].base;
  const attributes = {} as Attributes;
  for (const { id: attr } of ATTRIBUTES) {
    const variance = Math.round((rng() * 2 - 1) * HIRE_ATTR_VARIANCE);
    attributes[attr] = Math.max(1, base[attr] + variance);
  }
  const adv: Adventurer = {
    id,
    name: `${pick(ADVENTURER_FIRST_NAMES, rng)} ${pick(ADVENTURER_EPITHETS, rng)}`,
    className,
    level: 1,
    xp: 0,
    attributes,
    hp: 0,
    equipment: {},
    assignment: null,
    injuredUntil: 0,
    injuredDuration: 0,
    lastAssignment: null,
  };
  return { ...adv, hp: maxHp(adv) };
}

/** Effective attributes: level-1 roll + class growth per level + gear bonuses. */
export function effectiveAttributes(adv: Adventurer): Attributes {
  const growth = CLASS_DEFS[adv.className].growth;
  const result = {} as Attributes;
  for (const { id } of ATTRIBUTES) {
    result[id] = Math.round(adv.attributes[id] + growth[id] * (adv.level - 1));
  }
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
  let bonus = 0;
  for (const item of Object.values(adv.equipment)) {
    if (item) bonus += item.hp ?? 0;
  }
  return Math.round(HP_BASE + attrs.con * HP_PER_CON + bonus);
}

/**
 * Weapon damage multiplier from its governing attribute — a high-STR wielder
 * makes a greatsword hit far harder than a low-STR one.
 */
function weaponStatScale(stat: number): number {
  return Math.min(WEAPON_SCALE_MAX, WEAPON_SCALE_BASE + stat / WEAPON_SCALE_DIV);
}

export function adventurerStats(adv: Adventurer): {
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
  return { atk: Math.round(atk), def: Math.round(def), maxHp: maxHp(adv) };
}

/** Combat rating used against location power (perk multiplier applied). */
export function adventurerPower(state: GameState, adv: Adventurer): number {
  const { atk, def } = adventurerStats(adv);
  return (atk + def) * computeModifiers(state).powerMult;
}

/** Find-chance multiplier from LCK (materials, equipment, shards). */
export function luckFindMult(adv: Adventurer): number {
  return 1 + effectiveAttributes(adv).lck * LCK_FIND_PER_POINT;
}

export function isInjured(adv: Adventurer, runTimeSeconds: number): boolean {
  return adv.injuredUntil > runTimeSeconds;
}

/** Returns a new adventurer with XP added and any level-ups applied. */
export function gainXp(adv: Adventurer, amount: number): Adventurer {
  let { level, xp } = adv;
  xp += amount;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  if (level === adv.level) return { ...adv, xp };
  // Level-ups raise CON; grow current HP by the same amount max HP grew.
  const next = { ...adv, level, xp };
  return { ...next, hp: Math.min(maxHp(next), next.hp + (maxHp(next) - maxHp(adv))) };
}
