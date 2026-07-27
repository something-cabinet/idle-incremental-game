import { ATTRIBUTES, EQUIP_TYPES } from '../game/config';
import type { AttributeId, Equipment } from '../game/types';

const ATTR_ABBR: Record<AttributeId, string> = Object.fromEntries(
  ATTRIBUTES.map((a) => [a.id, a.abbr]),
) as Record<AttributeId, string>;

const TYPE_ICON: Record<string, string> = Object.fromEntries(
  EQUIP_TYPES.map((t) => [t.id, t.icon]),
);

const SLOT_FALLBACK_ICON: Record<string, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  trinket: '💍',
};

/** Icon for an item's equipment type (falls back to its slot). */
export function itemIcon(item: Equipment): string {
  return TYPE_ICON[item.typeId] ?? SLOT_FALLBACK_ICON[item.slot] ?? '❔';
}

/** Human-readable equipment subtype label, e.g. "greatsword" → "greatsword". */
export function itemTypeLabel(item: Equipment): string {
  return EQUIP_TYPES.find((t) => t.id === item.typeId)?.id ?? item.slot;
}

/** Short stat chips for an item: ["⚔ 12", "🛡 3", "+20 HP", "+2 STR"]. */
export function itemStatParts(item: Equipment): string[] {
  const parts: string[] = [];
  if (item.atk) parts.push(`⚔ ${item.atk}`);
  if (item.def) parts.push(`🛡 ${item.def}`);
  if (item.hp) parts.push(`+${item.hp} HP`);
  for (const [attr, value] of Object.entries(item.attrs ?? {})) {
    if (value) parts.push(`+${value} ${ATTR_ABBR[attr as AttributeId]}`);
  }
  return parts;
}

/** One before→after line for a stat that changed (or appeared/disappeared). */
export interface ItemStatDeltaLine {
  label: string;
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
  if (before.atk !== after.atk) lines.push({ label: '⚔ ATK', before: before.atk, after: after.atk });
  if (before.def !== after.def) lines.push({ label: '🛡 DEF', before: before.def, after: after.def });
  if (before.hp !== after.hp) lines.push({ label: '❤ HP', before: before.hp, after: after.hp });
  for (const { id, abbr } of ATTRIBUTES) {
    const b = before.attrs?.[id] ?? 0;
    const a = after.attrs?.[id] ?? 0;
    if (b !== a) lines.push({ label: abbr, before: b, after: a });
  }
  return lines;
}
