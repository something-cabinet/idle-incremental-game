import { useState } from 'react';
import { MATERIALS, RARITY_SELL_GOLD } from '../../game/config';
import { sellItem, sellItems } from '../../game/guild';
import type { EquipSlot, Equipment, Rarity } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { itemIcon, itemStatParts, itemTypeLabel } from '../itemDisplay';

const SLOT_ICON: Record<EquipSlot, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  trinket: '💍',
};

const MATERIAL_ICON: Record<string, string> = {
  'beast-pelt': '🐾',
  'iron-ore': '⛏️',
  'spirit-essence': '✨',
  'demon-ash': '🔥',
};

type SortMode = 'newest' | 'rarity' | 'atk' | 'def';

const SORT_LABEL: Record<SortMode, string> = {
  newest: 'Newest',
  rarity: 'Rarity',
  atk: 'Attack',
  def: 'Defense',
};

const RARITY_ORDER: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, exalted: 3 };

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
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');
  const [slotFilter, setSlotFilter] = useState<EquipSlot | 'all'>('all');
  const [openMenu, setOpenMenu] = useState<'sort' | 'filter' | null>(null);
  const [confirmBulkSell, setConfirmBulkSell] = useState(false);

  const visibleItems = sortInventory(
    state.inventory.filter(
      (item) =>
        (rarityFilter === 'all' || item.rarity === rarityFilter) &&
        (slotFilter === 'all' || item.slot === slotFilter),
    ),
    sortMode,
  );

  const handleSell = () => {
    if (selected) {
      store.dispatch((s) => sellItem(s, selected.id));
      setSelected(null);
    }
  };

  const bulkSellGold = visibleItems.reduce(
    (sum, item) => sum + RARITY_SELL_GOLD[item.rarity],
    0,
  );

  const handleBulkSell = () => {
    const ids = visibleItems.map((i) => i.id);
    store.dispatch((s) => sellItems(s, ids));
    if (selected && ids.includes(selected.id)) setSelected(null);
    setConfirmBulkSell(false);
  };

  const filterActive = rarityFilter !== 'all' || slotFilter !== 'all';

  return (
    <div className="panel">
      <section className="rows">
        <h3 className="section-title">Materials</h3>
        <div className="materials-list">
          {MATERIALS.map((mat) => (
            <div key={mat.id} className="materials-list-item">
              <span className="materials-list-icon">{MATERIAL_ICON[mat.id] ?? '❔'}</span>
              <span className="materials-list-name">{mat.name}</span>
              <span className="materials-list-qty">{fmt(state.materials[mat.id] ?? 0)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rows">
        <h3 className="section-title">Equipment ({state.inventory.length})</h3>

        <div className="equip-toolbar">
          <div className="equip-menu-wrap">
            <button
              className={`small-button${sortMode !== 'newest' ? ' active' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'sort' ? null : 'sort')}
            >
              Sort: {SORT_LABEL[sortMode]} ▾
            </button>
            {openMenu === 'sort' && (
              <>
                <div className="equip-menu-backdrop" onClick={() => setOpenMenu(null)} />
                <div className="equip-menu">
                  {(Object.keys(SORT_LABEL) as SortMode[]).map((mode) => (
                    <button
                      key={mode}
                      className={`equip-menu-option${sortMode === mode ? ' active' : ''}`}
                      onClick={() => {
                        setSortMode(mode);
                        setOpenMenu(null);
                      }}
                    >
                      {SORT_LABEL[mode]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="equip-menu-wrap">
            <button
              className={`small-button${filterActive ? ' active' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'filter' ? null : 'filter')}
            >
              Filter{filterActive ? ' ●' : ''} ▾
            </button>
            {openMenu === 'filter' && (
              <>
                <div className="equip-menu-backdrop" onClick={() => setOpenMenu(null)} />
                <div className="equip-menu">
                  <div className="equip-menu-group">Rarity</div>
                  {(['all', 'common', 'rare', 'epic', 'exalted'] as const).map((r) => (
                    <button
                      key={r}
                      className={`equip-menu-option${rarityFilter === r ? ' active' : ''}`}
                      onClick={() => setRarityFilter(r)}
                    >
                      {r === 'all' ? 'All rarities' : r}
                    </button>
                  ))}
                  <div className="equip-menu-group">Type</div>
                  {(['all', 'weapon', 'armor', 'trinket'] as const).map((s) => (
                    <button
                      key={s}
                      className={`equip-menu-option${slotFilter === s ? ' active' : ''}`}
                      onClick={() => setSlotFilter(s)}
                    >
                      {s === 'all' ? 'All types' : `${SLOT_ICON[s]} ${s}`}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            className="small-button danger"
            disabled={visibleItems.length === 0}
            onClick={() => setConfirmBulkSell(true)}
          >
            Sell {filterActive ? 'filtered' : 'all'} ({visibleItems.length})
          </button>
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
                {itemIcon(selected)} {itemTypeLabel(selected)}
              </span>
              {itemStatParts(selected).map((part) => (
                <span key={part}>{part}</span>
              ))}
            </div>
            <div className="equip-detail-actions">
              <button className="small-button danger" onClick={handleSell}>
                Sell {RARITY_SELL_GOLD[selected.rarity]}🪙
              </button>
              <span className="equip-detail-hint">
                Equip from the Guild tab → tap an adventurer.
              </span>
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
                <span className="equip-grid-slot">{itemIcon(item)}</span>
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
        {state.adventurers.length === 0 && (
          <div className="row locked">No adventurers yet.</div>
        )}
        {state.adventurers.map((adv) => (
          <div key={adv.id} className="row">
            <div className="row-info">
              <span className="row-name">{adv.name}</span>
              <span className="row-desc equipped-slots">
                {(['weapon', 'armor', 'trinket'] as EquipSlot[]).map((slot) => {
                  const item = adv.equipment[slot];
                  return (
                    <span
                      key={slot}
                      className={`equipped-slot ${item ? `rarity-${item.rarity}` : 'empty'}`}
                      title={item ? item.name : `No ${slot}`}
                    >
                      {item ? `${itemIcon(item)} ${item.name}` : `${SLOT_ICON[slot]} —`}
                    </span>
                  );
                })}
              </span>
            </div>
          </div>
        ))}
      </section>

      {confirmBulkSell && (
        <div className="story-overlay" onClick={() => setConfirmBulkSell(false)}>
          <div className="story-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="story-title">Sell {visibleItems.length} items?</h2>
            <p className="story-text">
              This will sell {filterActive ? 'every item matching the current filters' : 'your entire equipment inventory'}{' '}
              for {fmt(bulkSellGold)}🪙. This cannot be undone.
            </p>
            <div className="equip-detail-actions">
              <button className="small-button danger" onClick={handleBulkSell}>
                Sell for {fmt(bulkSellGold)}🪙
              </button>
              <button className="small-button" onClick={() => setConfirmBulkSell(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}