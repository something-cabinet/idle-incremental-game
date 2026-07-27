import { EQUIPMENT_PERKS, EQUIPMENT_PERK_CAP, EQUIPMENT_PERK_TIER_RATE } from './config';
import type { Adventurer, Equipment, EquipmentPerkDef, EquipmentPerkEffect, Rng } from './types';

/**
 * Equipment perks: the single defining trait an ascendant item carries (see
 * EQUIPMENT_PERKS / guild.ts ascendItem). This module owns resolving a perk
 * id to its definition, scaling its potency by the item's tier, and rolling a
 * fresh one — combat.ts consumes the scaled effects, the UI the text.
 *
 * Pure: no React, no randomness beyond an injected `Rng`.
 */

export function equipmentPerkDef(perkId: string | undefined): EquipmentPerkDef | undefined {
  return perkId ? EQUIPMENT_PERKS.find((p) => p.id === perkId) : undefined;
}

/** Roll a perk for a freshly ascended item. */
export function rollEquipmentPerk(rng: Rng): string {
  return EQUIPMENT_PERKS[Math.floor(rng() * EQUIPMENT_PERKS.length)].id;
}

/** Growth factor applied to a tier-1 base potency at `tier`. */
function tierFactor(tier: number): number {
  return 1 + Math.max(0, tier - 1) * EQUIPMENT_PERK_TIER_RATE;
}

function scale(base: number, tier: number, kind: EquipmentPerkEffect['kind']): number {
  return Math.min(EQUIPMENT_PERK_CAP[kind], base * tierFactor(tier));
}

/**
 * The perk effect an item actually grants, with its potency scaled to the
 * item's tier and clamped by EQUIPMENT_PERK_CAP. Returns null for anything
 * without a (valid) perk — i.e. every non-ascendant item.
 *
 * `execute` scales the *bonus* above 1× rather than the multiplier itself, so
 * a tier-6 1.4× lands at 1.7×, not 2.45×; the HP threshold is a fixed
 * condition, not a potency, so it never scales.
 */
export function equipmentPerkEffect(item: Equipment): EquipmentPerkEffect | null {
  const def = equipmentPerkDef(item.perkId);
  if (!def) return null;
  const e = def.effect;
  const tier = item.tier;
  switch (e.kind) {
    case 'thorns':
    case 'pierce':
    case 'aegis':
    case 'regen':
      return { ...e, fraction: scale(e.fraction, tier, e.kind) };
    case 'block':
    case 'twinstrike':
      return { ...e, chance: scale(e.chance, tier, e.kind) };
    case 'execute':
      return { ...e, mult: 1 + scale(e.mult - 1, tier, e.kind) };
  }
}

/** The scaled perk effects of everything a champion currently has equipped. */
export function equippedPerkEffects(adv: Adventurer): EquipmentPerkEffect[] {
  const effects: EquipmentPerkEffect[] = [];
  for (const item of Object.values(adv.equipment)) {
    if (!item) continue;
    const effect = equipmentPerkEffect(item);
    if (effect) effects.push(effect);
  }
  return effects;
}

function percent(fraction: number): string {
  const pct = fraction * 100;
  return `${pct < 10 ? Math.round(pct * 10) / 10 : Math.round(pct)}%`;
}

/** The perk's description with this item's own scaled numbers filled in. */
export function equipmentPerkText(item: Equipment): string | null {
  const def = equipmentPerkDef(item.perkId);
  const effect = equipmentPerkEffect(item);
  if (!def || !effect) return null;
  switch (effect.kind) {
    case 'thorns':
    case 'pierce':
    case 'aegis':
    case 'regen':
      return def.description.replace('{v}', percent(effect.fraction));
    case 'block':
    case 'twinstrike':
      return def.description.replace('{v}', percent(effect.chance));
    case 'execute':
      return def.description
        .replace('{v}', String(Math.round(effect.mult * 100) / 100))
        .replace('{t}', percent(effect.threshold));
  }
}
