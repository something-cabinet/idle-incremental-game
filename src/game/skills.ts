import { TOWN_SKILLS } from './config';
import { computeModifiers } from './perks';
import type { GameState, TownSkillBonuses, TownSkillDef } from './types';

/**
 * Town skill tree: gold (sometimes material) sinks that boost the town economy.
 * Unlike perks, these reset on time travel. Nodes unlock down the tree —
 * a skill needs its `requires` parent at level ≥ 1.
 */

export function townSkillDef(id: string): TownSkillDef | undefined {
  return TOWN_SKILLS.find((s) => s.id === id);
}

export function townSkillLevel(state: GameState, id: string): number {
  return state.townSkills[id] ?? 0;
}

export function townSkillCost(
  state: GameState,
  id: string,
): { gold: number; materials: Record<string, number> } {
  const def = townSkillDef(id);
  if (!def) return { gold: Infinity, materials: {} };
  const scale = Math.pow(def.costGrowth, townSkillLevel(state, id));
  const costMult = computeModifiers(state).costMult;
  return {
    gold: Math.ceil(def.baseCostGold * scale * costMult),
    materials: Object.fromEntries(
      Object.entries(def.materials ?? {}).map(([mid, n]) => [mid, Math.ceil(n * scale)]),
    ),
  };
}

export function isTownSkillUnlocked(state: GameState, id: string): boolean {
  const def = townSkillDef(id);
  if (!def) return false;
  return !def.requires || townSkillLevel(state, def.requires) > 0;
}

export function canBuyTownSkill(state: GameState, id: string): boolean {
  const def = townSkillDef(id);
  if (!def) return false;
  if (!isTownSkillUnlocked(state, id)) return false;
  if (townSkillLevel(state, id) >= def.maxLevel) return false;
  const cost = townSkillCost(state, id);
  if (state.gold < cost.gold) return false;
  return Object.entries(cost.materials).every(
    ([mid, n]) => (state.materials[mid] ?? 0) >= n,
  );
}

export function buyTownSkill(state: GameState, id: string): GameState {
  if (!canBuyTownSkill(state, id)) return state;
  const cost = townSkillCost(state, id);
  const materials = { ...state.materials };
  for (const [mid, n] of Object.entries(cost.materials)) {
    materials[mid] = (materials[mid] ?? 0) - n;
  }
  return {
    ...state,
    gold: state.gold - cost.gold,
    materials,
    townSkills: { ...state.townSkills, [id]: townSkillLevel(state, id) + 1 },
  };
}

/** Fold owned town skills into flat/multiplier bonuses for the economy. */
export function computeTownSkillBonuses(state: GameState): TownSkillBonuses {
  const bonuses: TownSkillBonuses = {
    flatGold: 0,
    jobMult: 1,
    clickFlat: 0,
    clickMult: 1,
    clickGpsPercent: 0,
  };
  for (const def of TOWN_SKILLS) {
    const level = townSkillLevel(state, def.id);
    if (level <= 0) continue;
    const { effect } = def;
    switch (effect.kind) {
      case 'flatGold':
        bonuses.flatGold += effect.perLevel * level;
        break;
      case 'jobMult':
        bonuses.jobMult += effect.perLevel * level;
        break;
      case 'clickFlat':
        bonuses.clickFlat += effect.perLevel * level;
        break;
      case 'clickMult':
        bonuses.clickMult += effect.perLevel * level;
        break;
      case 'clickGpsPercent':
        bonuses.clickGpsPercent += effect.perLevel * level;
        break;
    }
  }
  return bonuses;
}
