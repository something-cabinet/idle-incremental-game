/**
 * The single source of truth for turning game data into display strings and
 * icon names. Every panel imports from here rather than keeping its own copy —
 * previously `materialName` lived in five files and the warrior/ranger/mage
 * icon map in four (and disagreed between them: a mage was a crystal ball in
 * battle but a sparkle in the forge).
 *
 * Nothing here reaches into React; it maps game types to plain strings and
 * `IconName`s, and the components do the rendering.
 */

import { ATTRIBUTES, EQUIP_TYPES, MATERIALS } from '../game/config';
import type { AdventurerClass, AttributeId, EquipSlot, Equipment, Rarity } from '../game/types';
import type { IconName } from './icons';

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

const MATERIAL_BY_ID = new Map(MATERIALS.map((m) => [m.id, m]));

export function materialName(id: string): string {
  return MATERIAL_BY_ID.get(id)?.name ?? id;
}

export function materialIcon(id: string): IconName {
  return (MATERIAL_BY_ID.get(id)?.icon as IconName | undefined) ?? 'gem';
}

/** "5 Beast Pelt · 3 Wild Herbs" from a {materialId: amount} record. */
export function materialsSummary(materials: Record<string, number>): string {
  return Object.entries(materials)
    .map(([id, n]) => `${Math.floor(n)} ${materialName(id)}`)
    .join(' · ');
}

// ---------------------------------------------------------------------------
// Champion classes
// ---------------------------------------------------------------------------

/**
 * Warrior takes the axe rather than the sword: the sword glyph is already the
 * ATK stat icon, and a champion row shows both ("[sword] Perrin ... [sword] 16"),
 * so sharing it made the class and the stat indistinguishable.
 */
export const CLASS_ICON: Record<AdventurerClass, IconName> = {
  warrior: 'axe',
  ranger: 'bow',
  mage: 'sparkle',
};

export const CLASS_LABEL: Record<AdventurerClass, string> = {
  warrior: 'Warrior',
  ranger: 'Ranger',
  mage: 'Mage',
};

export const CLASS_DESCRIPTION: Record<AdventurerClass, string> = {
  warrior: 'Front-line brawler — high STR/CON, soaks damage',
  ranger: 'Agile skirmisher — high DEX/LCK, balanced offense',
  mage: 'Spellcaster — high INT, fragile but powerful',
};

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

export const SLOT_ICON: Record<EquipSlot, IconName> = {
  weapon: 'sword',
  armor: 'shield',
  trinket: 'ring',
};

export const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  trinket: 'Trinket',
};

const TYPE_ICON = new Map(EQUIP_TYPES.map((t) => [t.id, t.icon as IconName]));

/** Icon for an item's equipment type, falling back to its slot. */
export function itemIcon(item: Equipment): IconName {
  return TYPE_ICON.get(item.typeId) ?? SLOT_ICON[item.slot] ?? 'gem';
}

/** Human-readable equipment subtype label, e.g. "greatsword". */
export function itemTypeLabel(item: Equipment): string {
  return EQUIP_TYPES.find((t) => t.id === item.typeId)?.id ?? item.slot;
}

export const RARITY_ORDER: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  exalted: 3,
  ascendant: 4,
};

// ---------------------------------------------------------------------------
// Stat chips
// ---------------------------------------------------------------------------

const ATTR_ABBR: Record<AttributeId, string> = Object.fromEntries(
  ATTRIBUTES.map((a) => [a.id, a.abbr]),
) as Record<AttributeId, string>;

/** One stat on an item: an optional icon plus its text, e.g. sword + "12". */
export interface StatChip {
  key: string;
  icon: IconName | null;
  text: string;
}

/** Short stat chips for an item: ATK, DEF, HP, then any bonus attributes. */
export function itemStatParts(item: Equipment): StatChip[] {
  const parts: StatChip[] = [];
  if (item.atk) parts.push({ key: 'atk', icon: 'sword', text: String(item.atk) });
  if (item.def) parts.push({ key: 'def', icon: 'shield', text: String(item.def) });
  if (item.hp) parts.push({ key: 'hp', icon: 'heart', text: String(item.hp) });
  for (const [attr, value] of Object.entries(item.attrs ?? {})) {
    if (value) {
      parts.push({
        key: attr,
        icon: null,
        text: `+${value} ${ATTR_ABBR[attr as AttributeId]}`,
      });
    }
  }
  return parts;
}

/** Flat text form of `itemStatParts`, for places that can't render icons. */
export function itemStatText(item: Equipment): string {
  return itemStatParts(item)
    .map((p) => (p.icon === 'sword' ? `ATK ${p.text}` : p.icon === 'shield' ? `DEF ${p.text}` : p.icon === 'heart' ? `HP ${p.text}` : p.text))
    .join(' · ');
}

/** One before→after line for a stat that changed (or appeared/disappeared). */
export interface ItemStatDeltaLine {
  label: string;
  icon: IconName | null;
  before: number;
  after: number;
}

/**
 * Every stat that differs between two versions of "the same" item (an
 * ascension upgrade — see guild.ts ascendItem) — atk/def/hp plus every
 * attribute either side rolled. Unchanged stats are omitted; a stat only one
 * side has shows the other side as 0, same as a normal gain/loss.
 */
export function itemStatDelta(before: Equipment, after: Equipment): ItemStatDeltaLine[] {
  const lines: ItemStatDeltaLine[] = [];
  if (before.atk !== after.atk) {
    lines.push({ label: 'ATK', icon: 'sword', before: before.atk, after: after.atk });
  }
  if (before.def !== after.def) {
    lines.push({ label: 'DEF', icon: 'shield', before: before.def, after: after.def });
  }
  if (before.hp !== after.hp) {
    lines.push({ label: 'HP', icon: 'heart', before: before.hp, after: after.hp });
  }
  for (const { id, abbr } of ATTRIBUTES) {
    const b = before.attrs?.[id] ?? 0;
    const a = after.attrs?.[id] ?? 0;
    if (b !== a) lines.push({ label: abbr, icon: null, before: b, after: a });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/** Compact rate number: 12.3, 0.45, 1,240. */
export function rate(n: number): string {
  if (n === 0) return '0';
  if (n < 10) return n.toFixed(2);
  if (n < 100) return n.toFixed(1);
  return Math.round(n).toLocaleString();
}
