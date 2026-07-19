import { MATERIALS } from '../../game/config';
import { useFormat } from '../../hooks/useFormat';
import { useGameState } from '../../hooks/useGame';

/**
 * Materials store. Equipment/inventory management is dormant while the Mercenary
 * system is parked (see types.ts) — for now this tab just shows the raw
 * materials your posted quests bring in.
 */

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
  const state = useGameState();
  const fmt = useFormat();

  const owned = MATERIALS.filter((m) => (state.materials[m.id] ?? 0) > 0);

  return (
    <div className="panel">
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
    </div>
  );
}
