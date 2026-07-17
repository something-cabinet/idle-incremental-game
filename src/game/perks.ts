import { OFFLINE_CAP_HOURS, PERKS } from './config';
import type { GameState, Modifiers, PerkDef } from './types';

/** Perk logic: reading levels, costs, availability, and derived modifiers. */

export function perkDef(id: string): PerkDef | undefined {
  return PERKS.find((p) => p.id === id);
}

export function perkLevel(state: GameState, id: string): number {
  return state.perks[id] ?? 0;
}

export function perkCost(state: GameState, id: string): number {
  const def = perkDef(id);
  if (!def) return Infinity;
  const level = perkLevel(state, id);
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, level));
}

export function isPerkUnlocked(state: GameState, id: string): boolean {
  const def = perkDef(id);
  if (!def?.requires) return true;
  // A requirement is met once you own at least one level of it.
  return def.requires.every((req) => req === id || perkLevel(state, req) > 0);
}

export function isPerkMaxed(state: GameState, id: string): boolean {
  const def = perkDef(id);
  return !!def && perkLevel(state, id) >= def.maxLevel;
}

export function canBuyPerk(state: GameState, id: string): boolean {
  const def = perkDef(id);
  if (!def) return false;
  return (
    isPerkUnlocked(state, id) &&
    !isPerkMaxed(state, id) &&
    state.prestigePoints >= perkCost(state, id)
  );
}

export function buyPerk(state: GameState, id: string): GameState {
  if (!canBuyPerk(state, id)) return state;
  const cost = perkCost(state, id);
  return {
    ...state,
    prestigePoints: state.prestigePoints - cost,
    perks: { ...state.perks, [id]: perkLevel(state, id) + 1 },
  };
}

/** Fold all owned perk effects into a single set of multipliers. */
export function computeModifiers(state: GameState): Modifiers {
  const mods: Modifiers = {
    productionMult: 1,
    clickMult: 1,
    costMult: 1,
    offlineCapHours: OFFLINE_CAP_HOURS,
    prestigeGainMult: 1,
  };

  for (const def of PERKS) {
    const level = perkLevel(state, def.id);
    if (level <= 0) continue;
    const { effect } = def;
    switch (effect.kind) {
      case 'globalProduction':
        mods.productionMult += effect.perLevel * level;
        break;
      case 'clickPower':
        mods.clickMult += effect.perLevel * level;
        break;
      case 'costReduction':
        mods.costMult *= Math.max(0, 1 - effect.perLevel * level);
        break;
      case 'offlineCap':
        mods.offlineCapHours += effect.perLevel * level;
        break;
      case 'prestigeGain':
        mods.prestigeGainMult += effect.perLevel * level;
        break;
    }
  }

  return mods;
}
