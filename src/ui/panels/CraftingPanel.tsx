import { useState } from 'react';
import { CRAFT_QUANTITIES, MATERIALS } from '../../game/config';
import { formatDuration } from '../../game/format';
import {
  ascendCost,
  ascendItem,
  canAscendItem,
  canStartCraft,
  craftDurationSeconds,
  craftGoldCost,
  craftMaterialsCost,
  exaltedItems,
  findEquipment,
  maxCraftableTier,
  startCraft,
} from '../../game/guild';
import type { AdventurerClass, CraftJob, EquipSlot, Equipment } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { usePanelSection } from '../../hooks/usePanelSection';
import { AscendCelebrationModal } from '../AscendCelebrationModal';
import { itemIcon, itemStatParts, itemTypeLabel } from '../itemDisplay';

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

const CLASS_ICON: Record<AdventurerClass, string> = {
  warrior: '⚔️',
  ranger: '🏹',
  mage: '✨',
};

export function CraftingPanel() {
  const [section, setSection] = usePanelSection<'craft' | 'ascend'>('crafting', 'craft');

  return (
    <div className="panel">
      <div className="subtab-bar">
        <button
          className={`subtab ${section === 'craft' ? 'active' : ''}`}
          onClick={() => setSection('craft')}
        >
          Craft
        </button>
        <button
          className={`subtab ${section === 'ascend' ? 'active' : ''}`}
          onClick={() => setSection('ascend')}
        >
          Ascend Equipment
        </button>
      </div>

      {section === 'craft' ? <CraftSection /> : <AscendSection />}
    </div>
  );
}

function CraftSection() {
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
    <section className="rows">
      <h3 className="section-title">The Forge</h3>
      <p className="detail-sub">
        Spend gold and materials to forge equipment. Higher tiers need more — and
        rarer — materials, and roll a bigger stat budget, but never change your
        common/rare odds. The Forge can only produce common and rare gear —
        epic and ✦ exalted only drop from monsters your champions defeat.
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

// ---------------------------------------------------------------------------
// Ascend equipment — upgrade an exalted item to ascendant rarity by burning
// essence. Candidates: champions' currently equipped exalted gear first
// (so the player sees what their roster is wearing), then unequipped exalted
// items sitting in inventory.
// ---------------------------------------------------------------------------

function AscendSection() {
  const state = useGameState();
  const candidates = exaltedItems(state);
  // Snapshot of the item as it was right before ascending, kept until the
  // celebration modal closes — the post-ascend item is looked up live by id
  // (see `after` below), so this never needs its own copy of ascend logic.
  const [justAscended, setJustAscended] = useState<Equipment | null>(null);
  const after = justAscended ? findEquipment(state, justAscended.id)?.item : undefined;

  return (
    <section className="rows">
      <h3 className="section-title">Ascend Equipment</h3>
      <p className="detail-sub">
        Upgrade an ✦ exalted item into a ◆ ascendant one — a far bigger stat budget
        and more bonus attributes, at the cost of a steep mix of essences scaled to
        the item's own tier. The item keeps its slot; equipped gear stays equipped.
      </p>

      {candidates.length === 0 ? (
        <div className="row locked">
          No exalted equipment yet — it only drops from monsters your champions
          defeat in the wilds.
        </div>
      ) : (
        candidates.map(({ item, advId }) => (
          <AscendRow key={item.id} item={item} advId={advId} onAscended={setJustAscended} />
        ))
      )}

      {justAscended && after && (
        <AscendCelebrationModal
          before={justAscended}
          after={after}
          onClose={() => setJustAscended(null)}
        />
      )}
    </section>
  );
}

function AscendRow({
  item,
  advId,
  onAscended,
}: {
  item: Equipment;
  advId?: number;
  onAscended: (before: Equipment) => void;
}) {
  const state = useGameState();
  const store = useGameStore();
  const fmt = useFormat();
  const cost = ascendCost(item.tier);
  const canAscend = canAscendItem(state, item.id);
  const wearer = advId !== undefined ? state.adventurers.find((a) => a.id === advId) : undefined;

  function handleAscend() {
    if (!canAscend) return;
    store.dispatch((s) => ascendItem(s, item.id));
    onAscended(item);
  }

  return (
    <div className={`row item-${item.rarity}`}>
      <div className="row-info">
        <span className="row-name">
          {itemIcon(item)} {item.name} <span className="row-sub">T{item.tier}</span>
        </span>
        <span className="row-sub">
          {itemTypeLabel(item)} · {itemStatParts(item).join(' · ')}
        </span>
        {wearer && (
          <span className="row-good">
            {CLASS_ICON[wearer.className]} Equipped by {wearer.name}
          </span>
        )}
        <span className={canAscend ? 'row-desc' : 'row-bad'}>
          {Object.entries(cost)
            .map(([id, n]) => `${fmt(n)} ${materialName(id)}`)
            .join(' · ')}
        </span>
      </div>
      <button className="small-button" disabled={!canAscend} onClick={handleAscend}>
        ◆ Ascend
      </button>
    </div>
  );
}
