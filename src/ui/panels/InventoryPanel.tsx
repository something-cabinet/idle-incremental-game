import { useState } from 'react';
import { MATERIALS, RARITY_SELL_GOLD } from '../../game/config';
import { equipItem, sellItem, unequipItem } from '../../game/guild';
import type { EquipSlot } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';

export function InventoryPanel() {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();
  const [target, setTarget] = useState<number | ''>('');

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
        {state.inventory.length > 0 && (
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
        )}
        {state.inventory.map((item) => (
          <div key={item.id} className={`row item-${item.rarity}`}>
            <div className="row-info">
              <span className="row-name">{item.name}</span>
              <span className="row-desc">
                {item.slot} · ⚔ {item.atk} · 🛡 {item.def} · {item.rarity}
              </span>
            </div>
            <div className="zone-actions">
              <button
                className="small-button"
                disabled={target === ''}
                onClick={() => store.dispatch((s) => equipItem(s, target as number, item.id))}
              >
                Equip
              </button>
              <button
                className="small-button"
                onClick={() => store.dispatch((s) => sellItem(s, item.id))}
              >
                Sell {RARITY_SELL_GOLD[item.rarity]} 🪙
              </button>
            </div>
          </div>
        ))}
        {state.inventory.length === 0 && (
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
