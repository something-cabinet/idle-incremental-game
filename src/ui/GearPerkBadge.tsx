import { equipmentPerkDef, equipmentPerkText } from '../game/equipmentPerks';
import type { Equipment } from '../game/types';

/**
 * An ascendant item's perk, as a badge row — mirrors the champion PerkBadge
 * in GuildPanel, but for a trait belonging to the gear itself. Renders
 * nothing for any item without a perk (i.e. every non-ascendant item), so
 * callers can drop it in unconditionally.
 */
export function GearPerkBadge({ item }: { item: Equipment }) {
  const def = equipmentPerkDef(item.perkId);
  const text = equipmentPerkText(item);
  if (!def || !text) return null;
  return (
    <div className="row gear-perk-row">
      <div className="row-info">
        <span className="row-name">
          ◆ {def.name}
          <span className="perk-tag">Gear Perk</span>
        </span>
        <span className="row-desc">{text}</span>
      </div>
    </div>
  );
}
