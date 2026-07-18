import { useState } from 'react';
import { MATERIALS, RARITY_SELL_GOLD } from '../../game/config';
import { equipItem, sellItem, sellItems, unequipItem } from '../../game/guild';
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
                  {(['all', 'common', 'rare', 'epic'] as const).map((r) => (
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