import { useState } from 'react';
import { MATERIALS, RARITY_SELL_GOLD } from '../../game/config';
import { equipItem, sellItem, unequipItem } from '../../game/guild';
import type { EquipSlot, Equipment } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';

const SLOT_ICON: Record<EquipSlot, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  trinket: '💍',
};

export function InventoryPanel() {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();
  const [target, setTarget] = useState<number | ''>('');
  const [selected, setSelected] = useState<Equipment | null>(null);

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

        {state.inventory.length > 0 ? (
          <div className="equip-grid">
            {state.inventory.map((item) => (
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