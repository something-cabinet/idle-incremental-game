import { useState } from 'react';
import { CRAFT_QUANTITIES, EXALTED_MIN_TIER, MATERIALS } from '../../game/config';
import { formatDuration } from '../../game/format';
import {
  canStartCraft,
  craftDurationSeconds,
  craftGoldCost,
  craftMaterialsCost,
  maxCraftableTier,
  startCraft,
} from '../../game/guild';
import type { CraftJob, EquipSlot } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';

function materialName(id: string): string {
  return MATERIALS.find((m) => m.id === id)?.name ?? id;
}

const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  trinket: 'Trinket',
};

const SLOT_ICON: Record<EquipSlot, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  trinket: '💍',
};

const SLOTS: EquipSlot[] = ['weapon', 'armor', 'trinket'];

export function CraftingPanel() {
  const state = useGameState();
  const store = useGameStore();
  const fmt = useFormat();
  const maxTier = maxCraftableTier(state);
  const [slot, setSlot] = useState<EquipSlot>('weapon');
  const [tier, setTier] = useState(1);
  const [quantity, setQuantity] = useState(1);

  const job = state.crafting;
  const clampedTier = Math.min(tier, Math.max(1, maxTier));
  const goldCost = craftGoldCost(clampedTier, quantity);
  const materialsCost = craftMaterialsCost(clampedTier, quantity);
  const duration = craftDurationSeconds(clampedTier, quantity);
  const canCraft = canStartCraft(state, slot, clampedTier, quantity);

  function handleCraft() {
    store.dispatch((s) => startCraft(s, slot, clampedTier, quantity));
  }

  return (
    <div className="panel">
      <section className="rows">
        <h3 className="section-title">The Forge</h3>
        <p className="detail-sub">
          Spend gold and materials to forge equipment. Higher tiers need more — and
          rarer — materials, but tier never changes your odds of common/rare/epic; it
          only unlocks a shot at ✦ Exalted from tier {EXALTED_MIN_TIER} up.
        </p>

        {job ? (
          <CraftingProgress job={job} />
        ) : maxTier === 0 ? (
          <div className="row locked">Unlock a wilds zone before the forge has anything to work with.</div>
        ) : (
          <>
            <h4 className="section-title">Slot</h4>
            <div className="craft-options">
              {SLOTS.map((s) => (
                <button
                  key={s}
                  className={`small-button ${slot === s ? 'active' : ''}`}
                  onClick={() => setSlot(s)}
                >
                  {SLOT_ICON[s]} {SLOT_LABEL[s]}
                </button>
              ))}
            </div>

            <h4 className="section-title">Tier</h4>
            <div className="craft-options">
              {Array.from({ length: maxTier }, (_, i) => i + 1).map((t) => (
                <button
                  key={t}
                  className={`small-button ${clampedTier === t ? 'active' : ''}`}
                  onClick={() => setTier(t)}
                >
                  T{t}
                  {t >= EXALTED_MIN_TIER ? ' ✦' : ''}
                </button>
              ))}
            </div>

            <h4 className="section-title">Quantity</h4>
            <div className="craft-options">
              {CRAFT_QUANTITIES.map((q) => (
                <button
                  key={q}
                  className={`small-button ${quantity === q ? 'active' : ''}`}
                  onClick={() => setQuantity(q)}
                >
                  ×{q}
                </button>
              ))}
            </div>

            <div className="row locked">
              {fmt(goldCost)} 🪙
              {Object.entries(materialsCost).map(([id, n]) => (
                <span key={id} className="mat-cost">
                  {n} {materialName(id)}
                </span>
              ))}
              <br />~{formatDuration(duration)} to finish
            </div>

            <button className="small-button" disabled={!canCraft} onClick={handleCraft}>
              🔨 Craft
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function CraftingProgress({ job }: { job: CraftJob }) {
  const state = useGameState();
  const total = job.endsAt - job.startedAt;
  const elapsed = Math.min(total, state.runTimeSeconds - job.startedAt);
  const fraction = total > 0 ? elapsed / total : 1;
  const remaining = Math.max(0, job.endsAt - state.runTimeSeconds);

  return (
    <div className="row item-common">
      <div className="row-info">
        <span className="row-name">
          {SLOT_ICON[job.slot]} Forging {job.quantity}× {SLOT_LABEL[job.slot]} (tier {job.tier})
        </span>
        <div className="progress-line">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${fraction * 100}%` }} />
          </div>
          <span className="progress-time">{formatDuration(remaining)} left</span>
        </div>
      </div>
    </div>
  );
}
