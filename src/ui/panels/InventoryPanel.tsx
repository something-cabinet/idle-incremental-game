import { useState } from 'react';
import { MATERIALS } from '../../game/config';
import { disassembleItem, disassembleItems, essenceMaterialId, essenceYield } from '../../game/guild';
import type { EquipSlot, Equipment, Rarity } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { InfoNote, Modal, NoteRow, StatChips } from '../components';
import {
  RARITY_ORDER,
  itemIcon,
  itemStatParts,
  itemTypeLabel,
  materialIcon,
  materialName,
} from '../display';
import { GearPerkBadge } from '../GearPerkBadge';
import { Icon } from '../icons';

export function MaterialsSection() {
  const state = useGameState();
  const fmt = useFormat();

  const owned = MATERIALS.filter((m) => (state.materials[m.id] ?? 0) > 0);

  if (owned.length === 0) {
    return (
      <section className="rows">
        <NoteRow icon="info" tone="muted">
          No materials yet — post a quest from the Map tab to start gathering.
        </NoteRow>
      </section>
    );
  }

  return (
    <section className="rows">
      <div className="materials-list">
        {owned.map((mat) => (
          <div key={mat.id} className="materials-list-item">
            <Icon name={materialIcon(mat.id)} className="materials-list-icon" />
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

export function EquipmentSection() {
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
  const bulkEssence = Object.entries(essencePreview(visibleItems));

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
      <div className="equip-toolbar">
        <div className="equip-menu-wrap">
          <button
            className={`small-button ${sortMode !== 'newest' ? 'active' : ''}`}
            onClick={() => setOpenMenu(openMenu === 'sort' ? null : 'sort')}
          >
            {SORT_LABEL[sortMode]}
            <Icon name="chevron" />
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
            Filter{filterActive ? ' •' : ''}
            <Icon name="chevron" />
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
          Break down {visibleItems.length}
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
              <Icon name={itemIcon(item)} className="equip-grid-slot" />
              <span className="equip-grid-name">{item.name}</span>
            </button>
          ))}
        </div>
      ) : state.inventory.length > 0 ? (
        <NoteRow icon="info" tone="muted">No equipment matches the current filters.</NoteRow>
      ) : (
        <NoteRow icon="info" tone="muted">
          No equipment yet — forge some at the Forge, or send champions out for a drop.
        </NoteRow>
      )}

      {selected && (
        <Modal
          title={
            <>
              <Icon name={itemIcon(selected)} /> {selected.name}
            </>
          }
          onClose={() => setSelected(null)}
          className={`item-${selected.rarity}`}
          footer={
            <button className="small-button danger" onClick={() => handleDisassemble(selected)}>
              Break down for {essenceYield(selected)}{' '}
              {materialName(essenceMaterialId(selected.rarity))}
            </button>
          }
        >
          <p className="detail-sub">
            <span className={`equip-detail-rarity rarity-${selected.rarity}`}>{selected.rarity}</span>{' '}
            {itemTypeLabel(selected)} · {selected.slot}
          </p>
          <StatChips parts={itemStatParts(selected)} />
          <GearPerkBadge item={selected} />
        </Modal>
      )}

      {confirmBulkDisassemble && (
        <Modal
          title={`Break down ${visibleItems.length} items?`}
          onClose={() => setConfirmBulkDisassemble(false)}
          footer={
            <>
              <button className="small-button" onClick={() => setConfirmBulkDisassemble(false)}>
                Cancel
              </button>
              <button className="small-button danger" onClick={handleBulkDisassemble}>
                Break down
              </button>
            </>
          }
        >
          <p className="detail-sub">
            {filterActive ? 'Every item matching the current filters' : 'Your entire inventory'}{' '}
            becomes:
          </p>
          <div className="materials-list">
            {bulkEssence.map(([id, n]) => (
              <div key={id} className="materials-list-item">
                <Icon name={materialIcon(id)} className="materials-list-icon" />
                <span className="materials-list-name">{materialName(id)}</span>
                <span className="materials-list-qty">{n}</span>
              </div>
            ))}
          </div>
          <InfoNote id="disassemble-warning" title="This cannot be undone" defaultOpen>
            Equipment currently worn by a champion is not included — only items sitting in your
            inventory are broken down.
          </InfoNote>
        </Modal>
      )}
    </section>
  );
}
