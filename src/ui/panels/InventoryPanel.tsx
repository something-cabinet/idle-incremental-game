import { useState } from 'react';
import { MATERIALS, RARITY_SELL_GOLD } from '../../game/config';
import { sellItem } from '../../game/guild';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { itemIcon, itemStatParts, itemTypeLabel } from '../itemDisplay';

type Section = 'materials' | 'equipment';

const MATERIAL_ICON: Record<string, string> = {
  'beast-pelt': '🐾',
  'iron-ore': '⛏️',
  'spirit-essence': '✨',
  'demon-ash': '🔥',
  'raw-meat': '🍖',
  herbs: '🌿',
  timber: '🪵',
  silk: '🕸️',
  crystal: '💎',
};

export function InventoryPanel() {
  const [section, setSection] = useState<Section>('materials');

  return (
    <div className="panel">
      <div className="subtab-bar">
        <button
          className={`subtab ${section === 'materials' ? 'active' : ''}`}
          onClick={() => setSection('materials')}
        >
          Materials
        </button>
        <button
          className={`subtab ${section === 'equipment' ? 'active' : ''}`}
          onClick={() => setSection('equipment')}
        >
          Equipment
        </button>
      </div>

      {section === 'materials' && <MaterialsSection />}
      {section === 'equipment' && <EquipmentSection />}
    </div>
  );
}

function MaterialsSection() {
  const state = useGameState();
  const fmt = useFormat();

  const owned = MATERIALS.filter((m) => (state.materials[m.id] ?? 0) > 0);

  return (
    <section className="rows">
      <h3 className="section-title">Materials</h3>
      {owned.length === 0 && (
        <div className="row locked">
          No materials yet. Post quests on the Map tab to gather them.
        </div>
      )}
      <div className="materials-list">
        {owned.map((mat) => (
          <div key={mat.id} className="materials-list-item">
            <span className="materials-list-icon">{MATERIAL_ICON[mat.id] ?? '❔'}</span>
            <span className="materials-list-name">{mat.name}</span>
            <span className="materials-list-qty">{fmt(Math.floor(state.materials[mat.id] ?? 0))}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EquipmentSection() {
  const state = useGameState();
  const store = useGameStore();
  const fmt = useFormat();

  return (
    <section className="rows">
      <h3 className="section-title">Equipment ({state.inventory.length})</h3>
      {state.inventory.length === 0 && (
        <div className="row locked">
          No equipment yet — forge some in the Crafting tab, or quest for a drop.
        </div>
      )}
      {state.inventory.map((item) => (
        <div key={item.id} className={`row item-${item.rarity}`}>
          <div className="row-info">
            <span className="row-name">
              {itemIcon(item)} {item.name}
            </span>
            <span className="row-desc">
              {item.rarity} {itemTypeLabel(item)} · {itemStatParts(item).join(' · ')}
            </span>
          </div>
          <button
            className="small-button"
            onClick={() => store.dispatch((s) => sellItem(s, item.id))}
          >
            Sell {fmt(RARITY_SELL_GOLD[item.rarity])} 🪙
          </button>
        </div>
      ))}
    </section>
  );
}
