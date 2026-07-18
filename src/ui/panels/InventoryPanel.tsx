import { useState } from 'react';
import { MATERIALS, RARITY_SELL_GOLD } from '../../game/config';
import { equipItem, sellItem, unequipItem } from '../../game/guild';
import type { EquipSlot, Equipment, Rarity } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';

const SLOT_ICON: Record<EquipSlot, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  trinket: '💍',
};

type SortMode = 'newest' | 'rarity' | 'atk' | 'def';

const SORT_LABEL: Record<SortMode, string> = {
  newest: 'Newest',
  rarity: 'Rarity',
  atk: 'Attack',
  def: 'Defense',
};

const RARITY_ORDER: Record<Rarity, number> = { common: 0, rare: 1, epic: 2 };

function sortInventory(items: Equipment[], mode: SortMode): Equipment[] {
  const sorted = [...items];
  switch (mode) {
    case 'rarity':
      sorted.sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]);
      break;
    case 'atk':
      sorted.sort((a, b) => b.atk - a.atk);
      break;
    case 'def':
      sorted.sort((a, b) => b.def - a.def);
      break;
    case 'newest':
      sorted.reverse();
      break;
  }
  return sorted;
}

export function InventoryPanel() {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();
  const [target, setTarget] = useState<number | ''>('');
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');
  const [slotFilter, setSlotFilter] = useState<EquipSlot | 'all'>('all');

  const visibleItems = sortInventory(
    state.inventory.filter(
      (item) =>
        (rarityFilter === 'all' || item.rarity === rarityFilter) &&
        (slotFilter === 'all' || item.slot === slotFilter),
    ),
    sortMode,
  );

  const handleEquip = () => {
    if (selected && target !== '') {
      store.dispatch((s) => equipItem(s, target as number, selected.id));
      setSelected(null);
    }
  };

  const handleSell = () => {
    if (selected) {
      store.dispatch((s) => sellItem(s, selected.id));
      setSelected(null);
    }
  };

  return (
    <div className="panel">
      <section className="rows">
        <h3 className="section-title">Materials</h3>
        <div className="materials-grid">
          {MATERIALS.map((mat) => (
            <div key={mat.id} className="stat">
              <span className="stat-value">{fmt(state.materials[mat.id] ?? 0)}</span>
              <span className="stat-label">{mat.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rows">
        <h3 className="section-title">Equipment ({state.inventory.length})</h3>

        <div className="equip-toolbar">
          <label className="equip-toolbar-control">
            <span className="equip-toolbar-label">Sort</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              {(Object.keys(SORT_LABEL) as SortMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {SORT_LABEL[mode]}
                </option>
              ))}
            </select>
          </label>
          <label className="equip-toolbar-control">
            <span className="equip-toolbar-label">Rarity</span>
            <select
              value={rarityFilter}
              onChange={(e) => setRarityFilter(e.target.value as Rarity | 'all')}
            >
              <option value="all">All</option>
              <option value="common">Common</option>
              <option value="rare">Rare</option>
              <option value="epic">Epic</option>
            </select>
          </label>
          <label className="equip-toolbar-control">
            <span className="equip-toolbar-label">Type</span>
            <select
              value={slotFilter}
              onChange={(e) => setSlotFilter(e.target.value as EquipSlot | 'all')}
            >
              <option value="all">All</option>
              <option value="weapon">Weapon</option>
              <option value="armor">Armor</option>
              <option value="trinket">Trinket</option>
            </select>
          </label>
        </div>

        {selected && (
          <div className={`equip-detail item-${selected.rarity}`}>
            <div className="equip-detail-header">
              <span className="equip-detail-name">{selected.name}</span>
              <span className={`equip-detail-rarity rarity-${selected.rarity}`}>
                {selected.rarity}
              </span>
            </div>
            <div className="equip-detail-stats">
              <span className="equip-detail-slot">
                {SLOT_ICON[selected.slot]} {selected.slot}
              </span>
              <span>⚔ {selected.atk} attack</span>
              <span>🛡 {selected.def} defense</span>
            </div>
            <div className="equip-detail-actions">
              <select
                className="equip-target"
                value={target}
                onChange={(e) => setTarget(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">Equip to whom?</option>
                {state.adventurers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <button className="small-button" disabled={target === ''} onClick={handleEquip}>
                Equip
              </button>
              <button className="small-button" onClick={handleSell}>
                Sell {RARITY_SELL_GOLD[selected.rarity]}🪙
              </button>
            </div>
          </div>
        )}

        {visibleItems.length > 0 ? (
          <div className="equip-grid">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                className={`equip-grid-item item-${item.rarity}${selected?.id === item.id ? ' selected' : ''}`}
                onClick={() => setSelected(item)}
              >
                <span className="equip-grid-slot">{SLOT_ICON[item.slot]}</span>
                <span className="equip-grid-name">{item.name}</span>
              </button>
            ))}
          </div>
        ) : state.inventory.length > 0 ? (
          <div className="row locked">No equipment matches the current filters.</div>
        ) : (
          <div className="row locked">No equipment — quests guarantee a drop.</div>
        )}
      </section>

      <section className="rows">
        <h3 className="section-title">Equipped</h3>
        {state.adventurers.map((adv) => (
          <div key={adv.id} className="row">
            <div className="row-info">
              <span className="row-name">{adv.name}</span>
              <span className="row-desc">
                {(['weapon', 'armor', 'trinket'] as EquipSlot[]).map((slot) => {
                  const item = adv.equipment[slot];
                  return (
                    <span key={slot} className="equipped-slot">
                      {item ? (
                        <button
                          className="link-button"
                          onClick={() => store.dispatch((s) => unequipItem(s, adv.id, slot))}
                          title="Unequip"
                        >
                          {item.name}
                        </button>
                      ) : (
                        `no ${slot}`
                      )}
                    </span>
                  );
                })}
              </span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}