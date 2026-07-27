import { useState } from 'react';
import { CRAFT_QUANTITIES } from '../../game/config';
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
import type { CraftJob, EquipSlot, Equipment } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { AscendCelebrationModal } from '../AscendCelebrationModal';
import { InfoNote, NoteRow, StatChips } from '../components';
import {
  CLASS_ICON,
  SLOT_ICON,
  SLOT_LABEL,
  itemIcon,
  itemStatParts,
  itemTypeLabel,
  materialIcon,
  materialName,
} from '../display';
import { Icon } from '../icons';

const SLOTS: EquipSlot[] = ['weapon', 'armor', 'trinket'];

export function CraftSection() {
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

  if (job) return <CraftingProgress job={job} />;

  if (maxTier === 0) {
    return (
      <NoteRow icon="lock" tone="muted">
        Unlock a wilds zone before the forge has anything to work with.
      </NoteRow>
    );
  }

  return (
    <section className="rows">
      <InfoNote id="forge-help" title="How the forge works">
        Higher tiers need more — and rarer — materials and roll a bigger stat budget, but never
        change your common/rare odds. The forge only produces common and rare gear; epic and
        exalted items drop from monsters your champions defeat.
      </InfoNote>

      <h4 className="section-title">Slot</h4>
      <div className="craft-options">
        {SLOTS.map((s) => (
          <button
            key={s}
            className={`small-button ${slot === s ? 'active' : ''}`}
            onClick={() => setSlot(s)}
          >
            <Icon name={SLOT_ICON[s]} /> {SLOT_LABEL[s]}
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

      <NoteRow icon="hammer">
        <span className="row-name">
          <Icon name="coin" /> {fmt(goldCost)}
          {Object.entries(materialsCost).map(([id, n]) => (
            <span key={id} className="cost-part">
              <Icon name={materialIcon(id)} /> {n} {materialName(id)}
            </span>
          ))}
        </span>
        <span className="row-desc">~{formatDuration(duration)} to finish</span>
      </NoteRow>

      <button className="small-button primary" disabled={!canCraft} onClick={() => store.dispatch((s) => startCraft(s, slot, clampedTier, quantity))}>
        <Icon name="hammer" /> Craft
      </button>
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
    <div className="row item-common has-actions">
      <div className="row-info">
        <span className="row-name">
          <Icon name={SLOT_ICON[job.slot]} /> Forging {job.quantity}× {SLOT_LABEL[job.slot]} (tier{' '}
          {job.tier})
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

export function AscendSection() {
  const state = useGameState();
  const candidates = exaltedItems(state);
  // Snapshot of the item as it was right before ascending, kept until the
  // celebration modal closes — the post-ascend item is looked up live by id
  // (see `after` below), so this never needs its own copy of ascend logic.
  const [justAscended, setJustAscended] = useState<Equipment | null>(null);
  const after = justAscended ? findEquipment(state, justAscended.id)?.item : undefined;

  return (
    <section className="rows">
      <InfoNote id="ascend-help" title="What ascending does" defaultOpen={candidates.length === 0}>
        Upgrades an exalted item to ascendant: a far bigger stat budget, more bonus attributes, and
        a gear perk only ascendant equipment can carry — for a steep mix of essences scaled to the
        item's own tier. The item keeps its slot, and equipped gear stays equipped.
      </InfoNote>

      {candidates.length === 0 ? (
        <NoteRow icon="lock" tone="muted">
          No exalted equipment yet — it only drops from monsters your champions defeat in the wilds.
        </NoteRow>
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
    <div className={`row item-${item.rarity} has-actions`}>
      <div className="row-info">
        <span className="row-name">
          <Icon name={itemIcon(item)} /> {item.name} <span className="row-sub">T{item.tier}</span>
        </span>
        <span className="row-sub">
          {itemTypeLabel(item)} · <StatChips parts={itemStatParts(item)} />
        </span>
        {wearer && (
          <span className="row-good">
            <Icon name={CLASS_ICON[wearer.className]} /> Equipped by {wearer.name}
          </span>
        )}
        <span className={canAscend ? 'row-desc' : 'row-bad'}>
          {Object.entries(cost)
            .map(([id, n]) => `${fmt(n)} ${materialName(id)}`)
            .join(' · ')}
        </span>
      </div>
      <button className="small-button primary" disabled={!canAscend} onClick={handleAscend}>
        Ascend
      </button>
    </div>
  );
}
