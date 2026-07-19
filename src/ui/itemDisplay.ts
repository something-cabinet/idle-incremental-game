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
