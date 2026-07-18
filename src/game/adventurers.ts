import {
  ADVENTURER_EPITHETS,
  ADVENTURER_FIRST_NAMES,
  CLASS_DEFS,
  RARITY_MULT,
  RARITY_WEIGHTS,
  xpToNext,
} from './config';
import { computeModifiers } from './perks';
import type {
  Adventurer,
  AdventurerClass,
  EquipSlot,
  Equipment,
  GameState,
  Rarity,
  Rng,
} from './types';

/** Adventurer generation, stats, XP, and equipment generation. */

const CLASSES: AdventurerClass[] = ['warrior', 'ranger', 'mage'];
const SLOTS: EquipSlot[] = ['weapon', 'armor', 'trinket'];

const SLOT_BASE_NAMES: Record<EquipSlot, string[]> = {
  weapon: ['Sword', 'Bow', 'Staff', 'Axe', 'Dagger'],
  armor: ['Mail', 'Leathers', 'Robe', 'Plate', 'Cloak'],
  trinket: ['Ring', 'Charm', 'Talisman', 'Band', 'Idol'],
};

const RARITY_PREFIX: Record<Rarity, string> = {
  common: 'Plain',
  rare: 'Fine',
  epic: 'Heroic',
};

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

/** Generate a piece of equipment scaled to a location tier. */
export function generateEquipment(id: number, tier: number, rng: Rng): Equipment {
  const slot = pick(SLOTS, rng);
  const rarity = rollRarity(rng);
  const mult = RARITY_MULT[rarity];
  // Weapons skew atk, armor skews def, trinkets are balanced.
  const budget = (4 + tier * 4) * mult * (0.8 + rng() * 0.4);
  const atkShare = slot === 'weapon' ? 0.8 : slot === 'armor' ? 0.2 : 0.5;
  return {
    id,
    slot,
    rarity,
    name: `${RARITY_PREFIX[rarity]} ${pick(SLOT_BASE_NAMES[slot], rng)}`,
    atk: Math.round(budget * atkShare),
    def: Math.round(budget * (1 - atkShare)),
  };
}

export function generateAdventurer(id: number, rng: Rng): Adventurer {
  return {
    id,
    name: `${pick(ADVENTURER_FIRST_NAMES, rng)} ${pick(ADVENTURER_EPITHETS, rng)}`,
    className: pick(CLASSES, rng),
    level: 1,
    xp: 0,
    equipment: {},
    assignment: null,
    injuredUntil: 0,
  };
}

export function adventurerStats(adv: Adventurer): { atk: number; def: number } {
  const cls = CLASS_DEFS[adv.className];
  let atk = cls.atk + cls.atkGrowth * (adv.level - 1);
  let def = cls.def + cls.defGrowth * (adv.level - 1);
  for (const item of Object.values(adv.equipment)) {
    if (!item) continue;
    atk += item.atk;
    def += item.def;
  }
  return { atk, def };
}

/** Combat rating used against location power (perk multiplier applied). */
export function adventurerPower(state: GameState, adv: Adventurer): number {
  const { atk, def } = adventurerStats(adv);
  return (atk + def) * computeModifiers(state).powerMult;
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
  return { ...adv, level, xp };
}
