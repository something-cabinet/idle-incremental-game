import { useState } from 'react';
import { MATERIALS } from '../../game/config';
import { disassembleItem, disassembleItems, essenceMaterialId, essenceYield } from '../../game/guild';
import type { EquipSlot, Equipment, Rarity } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { usePanelSection } from '../../hooks/usePanelSection';
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
  'common-essence': '🧪',
  'rare-essence': '💠',
  'epic-essence': '🌟',
  'exalted-essence': '☄️',
  'ascendant-essence': '🌌',
};

function materialName(id: string): string {
  return MATERIALS.find((m) => m.id === id)?.name ?? id;
}

export function InventoryPanel() {
  const [section, setSection] = usePanelSection<Section>('inventory', 'materials');

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

type SortMode = 'newest' | 'rarity' | 'atk' | 'def';

const SORT_LABEL: Record<SortMode, string> = {
  newest: 'Newest',
  rarity: 'Rarity',
  atk: 'Attack',
  def: 'Defense',
};

const RARITY_ORDER: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, exalted: 3, ascendant: 4 };
const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'exalted', 'ascendant'];
const SLOTS: EquipSlot[] = ['weapon', 'armor', 'trinket'];

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

/** materialId -> total amount, summed across a set of items being disassembled. */
function essencePreview(items: Equipment[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of items) {
    const id = essenceMaterialId(item.rarity);
    totals[id] = (totals[id] ?? 0) + essenceYield(item);
  }
  return totals;
}

function essencePreviewLines(items: Equipment[]): { id: string; label: string }[] {
  const totals = essencePreview(items);
  return Object.entries(totals).map(([id, n]) => ({ id, label: `${n} ${materialName(id)}` }));
}

function EquipmentSection() {
  const state = useGameState();
  const store = useGameStore();
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');
  const [slotFilter, setSlotFilter] = useState<EquipSlot | 'all'>('all');
  const [openMenu, setOpenMenu] = useState<'sort' | 'filter' | null>(null);
  const [confirmBulkDisassemble, setConfirmBulkDisassemble] = useState(false);

  const visibleItems = sortInventory(
    state.inventory.filter(
      (item) =>
        (rarityFilter === 'all' || item.rarity === rarityFilter) &&
        (slotFilter === 'all' || item.slot === slotFilter),
    ),
    sortMode,
  );
  const filterActive = rarityFilter !== 'all' || slotFilter !== 'all';
  const bulkEssenceLines = essencePreviewLines(visibleItems);

  function handleDisassemble(item: Equipment) {
    store.dispatch((s) => disassembleItem(s, item.id));
    setSelected(null);
  }

  function handleBulkDisassemble() {
    const ids = visibleItems.map((i) => i.id);
    store.dispatch((s) => disassembleItems(s, ids));
    if (selected && ids.includes(selected.id)) setSelected(null);
    setConfirmBulkDisassemble(false);
  }

  return (
    <section className="rows">
      <h3 className="section-title">Equipment ({state.inventory.length})</h3>

      <div className="equip-toolbar">
        <div className="equip-menu-wrap">
          <button
            className={`small-button ${sortMode !== 'newest' ? 'active' : ''}`}
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
                    className={`equip-menu-option ${sortMode === mode ? 'active' : ''}`}
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
            className={`small-button ${filterActive ? 'active' : ''}`}
            onClick={() => setOpenMenu(openMenu === 'filter' ? null : 'filter')}
          >
            Filter{filterActive ? ' ●' : ''} ▾
          </button>
          {openMenu === 'filter' && (
            <>
              <div className="equip-menu-backdrop" onClick={() => setOpenMenu(null)} />
              <div className="equip-menu">
                <div className="equip-menu-group">Rarity</div>
                {(['all', ...RARITIES] as const).map((r) => (
                  <button
                    key={r}
                    className={`equip-menu-option ${rarityFilter === r ? 'active' : ''}`}
                    onClick={() => setRarityFilter(r)}
                  >
                    {r === 'all' ? 'All rarities' : r}
                  </button>
                ))}
                <div className="equip-menu-group">Slot</div>
                {(['all', ...SLOTS] as const).map((s) => (
                  <button
                    key={s}
                    className={`equip-menu-option ${slotFilter === s ? 'active' : ''}`}
                    onClick={() => setSlotFilter(s)}
                  >
                    {s === 'all' ? 'All slots' : s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          className="small-button danger"
          disabled={visibleItems.length === 0}
          onClick={() => setConfirmBulkDisassemble(true)}
        >
          Disassemble {filterActive ? 'filtered' : 'all'} ({visibleItems.length})
        </button>
      </div>

      {visibleItems.length > 0 ? (
        <div className="equip-grid">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              className={`equip-grid-item item-${item.rarity}`}
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
        <div className="row locked">
          No equipment yet — forge some in the Crafting tab, or quest for a drop.
        </div>
      )}

      {selected && (
        <div className="story-overlay" onClick={() => setSelected(null)}>
          <div className={`story-modal detail-modal item-${selected.rarity}`} onClick={(e) => e.stopPropagation()}>
            <div className="detail-header">
              <h2 className="story-title">
                {itemIcon(selected)} {selected.name}
              </h2>
              <button className="small-button" onClick={() => setSelected(null)}>✕</button>
            </div>
            <p className="detail-sub">
              <span className={`equip-detail-rarity rarity-${selected.rarity}`}>{selected.rarity}</span>{' '}
              {itemTypeLabel(selected)} · {selected.slot}
            </p>
            <div className="equip-detail-stats">
              {itemStatParts(selected).map((part) => (
                <span key={part}>{part}</span>
              ))}
            </div>
            <button className="small-button" onClick={() => handleDisassemble(selected)}>
              Disassemble for {essenceYield(selected)} {materialName(essenceMaterialId(selected.rarity))}
            </button>
          </div>
        </div>
      )}

      {confirmBulkDisassemble && (
        <div className="story-overlay" onClick={() => setConfirmBulkDisassemble(false)}>
          <div className="story-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="story-title">Disassemble {visibleItems.length} items?</h2>
            <p className="story-text">
              This will break down{' '}
              {filterActive ? 'every item matching the current filters' : 'your entire equipment inventory'}{' '}
              into:
            </p>
            <div className="materials-list">
              {bulkEssenceLines.map((line) => (
                <div key={line.id} className="materials-list-item">
                  <span className="materials-list-name">{line.label}</span>
                </div>
              ))}
            </div>
            <p className="story-text">This cannot be undone.</p>
            <div className="equip-detail-actions">
              <button className="small-button danger" onClick={handleBulkDisassemble}>
                Disassemble
              </button>
              <button className="small-button" onClick={() => setConfirmBulkDisassemble(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
