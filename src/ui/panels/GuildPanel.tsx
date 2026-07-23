import { useState } from 'react';
import { adventurerStats, championPerk, championSkill, effectiveAttributes, equipDelta, isInjured, maxHp } from '../../game/adventurers';
import { ATTRIBUTES, GUILD_UPGRADES, MATERIALS, xpToNext } from '../../game/config';
import { formatDuration } from '../../game/format';
import {
  adventurerCount,
  autoEquipBest,
  buyGuildUpgrade,
  canBuyGuildUpgrade,
  deleteQuest,
  equipItem,
  fireAdventurer,
  guildUpgradeCost,
  hireCandidate,
  hireCost,
  locationDef,
  questBatchSummary,
  questProgress,
  questRates,
  questTargetDef,
  recallAdventurer,
  refreshRecruits,
  rerollCost,
  rerollRecruits,
  rosterCap,
  totalQuestGoldPerSec,
  unequipItem,
  zones,
} from '../../game/guild';
import type { Adventurer, AdventurerClass, Attributes, EquipSlot, Quest } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { usePanelSection } from '../../hooks/usePanelSection';
import { itemIcon, itemStatParts, itemTypeLabel } from '../itemDisplay';

type Section = 'adventurers' | 'quests' | 'upgrades';

function materialName(id: string): string {
  return MATERIALS.find((m) => m.id === id)?.name ?? id;
}

const CLASS_ICON: Record<AdventurerClass, string> = {
  warrior: '🗡️',
  ranger: '🏹',
  mage: '🔮',
};

const CLASS_LABEL: Record<AdventurerClass, string> = {
  warrior: 'Warrior',
  ranger: 'Ranger',
  mage: 'Mage',
};

const CLASS_DESCRIPTION: Record<AdventurerClass, string> = {
  warrior: 'Front-line brawler — high STR/CON, soaks damage',
  ranger: 'Agile skirmisher — high DEX/LCK, balanced offense',
  mage: 'Spellcaster — high INT, fragile but powerful',
};

const SLOT_FALLBACK_ICON: Record<EquipSlot, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  trinket: '💍',
};

const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'armor', 'trinket'];

/** The champion's passive perk, shown in detail views. */
function PerkBadge({ adv }: { adv: Adventurer }) {
  const perk = championPerk(adv.perkId);
  if (!perk) return null;
  return (
    <div className={`row perk-row perk-${perk.tier}`}>
      <div className="row-info">
        <span className="row-name">
          {perk.tier === 'major' ? '⭐' : '✨'} {perk.name}
          <span className="perk-tag">{perk.tier === 'major' ? 'Major' : 'Minor'} Perk</span>
        </span>
        <span className="row-desc">{perk.description}</span>
      </div>
    </div>
  );
}

/** The champion's active combat skill (auto-cast on cooldown in Explore). */
function SkillBadge({ adv }: { adv: Adventurer }) {
  const skill = championSkill(adv.skillId);
  if (!skill) return null;
  return (
    <div className="row skill-row">
      <div className="row-info">
        <span className="row-name">
          🎯 {skill.name}
          <span className="perk-tag">{skill.cooldownTurns}-turn CD</span>
        </span>
        <span className="row-desc">{skill.description}</span>
      </div>
    </div>
  );
}

function rate(n: number): string {
  if (n === 0) return '0';
  if (n < 10) return n.toFixed(2);
  if (n < 100) return n.toFixed(1);
  return Math.round(n).toLocaleString();
}

export function GuildPanel() {
  const [section, setSection] = usePanelSection<Section>('guild', 'adventurers');

  return (
    <div className="panel">
      <div className="subtab-bar">
        <button
          className={`subtab ${section === 'adventurers' ? 'active' : ''}`}
          onClick={() => setSection('adventurers')}
        >
          Adventurers
        </button>
        <button
          className={`subtab ${section === 'quests' ? 'active' : ''}`}
          onClick={() => setSection('quests')}
        >
          Quests
        </button>
        <button
          className={`subtab ${section === 'upgrades' ? 'active' : ''}`}
          onClick={() => setSection('upgrades')}
        >
          Upgrades
        </button>
      </div>

      {section === 'adventurers' && <AdventurersSection />}
      {section === 'quests' && <QuestsSection />}
      {section === 'upgrades' && <UpgradesSection />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adventurers — the numerous town pool, driven by reputation
// ---------------------------------------------------------------------------

function AdventurersSection() {
  const state = useGameState();
  const store = useGameStore();
  const fmt = useFormat();
  const count = adventurerCount(state);
  const cap = rosterCap(state);
  const [recruitOpen, setRecruitOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const detail = state.adventurers.find((a) => a.id === detailId) ?? null;

  // Next zone still locked behind a reputation threshold, if any.
  const nextZone = zones().find((z) => state.reputation < (z.repRequired ?? 0));

  function openRecruit() {
    store.dispatch((s) => refreshRecruits(s));
    setRecruitOpen(true);
  }

  return (
    <section className="rows">
      <h3 className="section-title">The Guild’s Adventurers</h3>

      <div className="detail-stats">
        <div className="stat">
          <span className="stat-value">{count}</span>
          <span className="stat-label">Adventurers</span>
        </div>
        <div className="stat">
          <span className="stat-value">★ {fmt(Math.floor(state.reputation))}</span>
          <span className="stat-label">Reputation</span>
        </div>
        <div className="stat">
          <span className="stat-value">{state.quests.length}</span>
          <span className="stat-label">Active Quests</span>
        </div>
      </div>

      <p className="detail-sub">
        These adventurers come and go, taking whatever bounties the guild posts. As
        your <strong>reputation</strong> grows, more of them turn up — and they split
        their effort across every quest on the board.
      </p>

      {nextZone ? (
        <div className="row locked">
          🔒 {nextZone.name} unlocks at ★ {fmt(nextZone.repRequired ?? 0)} reputation
          ({fmt(Math.max(0, Math.ceil((nextZone.repRequired ?? 0) - state.reputation)))} to go)
        </div>
      ) : (
        <div className="row item-common">All wilds unlocked.</div>
      )}

      <h3 className="section-title">
        Guild Champions ({state.adventurers.length}/{cap})
      </h3>
      <p className="detail-sub">
        A hand-picked few you recruit, equip, and command directly.
      </p>
      <div className="rows">
        {state.adventurers.map((adv) => (
          <ChampionCard key={adv.id} adv={adv} onOpen={() => setDetailId(adv.id)} />
        ))}
        {Array.from({ length: Math.max(0, cap - state.adventurers.length) }, (_, i) => (
          <button key={i} className="empty-slot" onClick={openRecruit}>
            + Recruit Champion
          </button>
        ))}
      </div>

      {recruitOpen && <RecruitDialog onClose={() => setRecruitOpen(false)} />}
      {detail && <ChampionDetailModal adv={detail} onClose={() => setDetailId(null)} />}
    </section>
  );
}

function ChampionCard({ adv, onOpen }: { adv: Adventurer; onOpen: () => void }) {
  const state = useGameState();
  const store = useGameStore();
  const stats = adventurerStats(adv);
  const hpMax = maxHp(adv);
  const injured = isInjured(adv, state.runTimeSeconds);
  return (
    <button className="row candidate-row adventurer-card" onClick={onOpen}>
      <div className="row-info">
        <span className="row-name">
          {CLASS_ICON[adv.className]} {adv.name}
        </span>
        <span className="row-desc">
          {CLASS_LABEL[adv.className]} · Lv {adv.level}
        </span>
        <span className="row-sub">
          ATK {stats.atk} · DEF {stats.def} · HP {hpMax}
        </span>
        {adv.assignment?.mode === 'auto-explore' && (
          <>
            <span className="row-good">
              🗺️ Auto-Exploring {locationDef(adv.assignment.locationId)?.name ?? adv.assignment.locationId}
            </span>
            <div className="equip-detail-actions">
              <button
                className="small-button danger"
                onClick={(e) => {
                  e.stopPropagation();
                  store.dispatch((s) => recallAdventurer(s, adv.id));
                }}
              >
                Recall
              </button>
            </div>
          </>
        )}
        {injured && (
          <span className="row-bad">
            🩹 Recovering — {formatDuration(Math.max(0, adv.injuredUntil - state.runTimeSeconds))} left
          </span>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Recruit dialog — 3 random candidates, simple view, then a detailed view
// with the actual recruit action once one is picked.
// ---------------------------------------------------------------------------

function RecruitDialog({ onClose }: { onClose: () => void }) {
  const store = useGameStore();
  const state = useGameState();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const candidates = state.recruitCandidates;
  const selected = candidates.find((c) => c.id === selectedId) ?? null;
  const cost = hireCost(state);
  const canAfford = state.gold >= cost;
  const rerollPrice = rerollCost(state);
  const canAffordReroll = state.gold >= rerollPrice;

  function handleRecruit(id: number) {
    store.dispatch((s) => hireCandidate(s, id));
    onClose();
  }

  function handleReroll() {
    store.dispatch((s) => rerollRecruits(s));
    setSelectedId(null);
  }

  return (
    <div className="story-overlay" onClick={onClose}>
      <div className="story-modal detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <h2 className="story-title">Recruit a Champion</h2>
          <button className="small-button" onClick={onClose}>✕</button>
        </div>

        {!selected ? (
          <>
            <p className="detail-sub">Pick one of these three adventurers to recruit.</p>
            <div className="rows">
              {candidates.map((c) => (
                <button key={c.id} className="row candidate-row" onClick={() => setSelectedId(c.id)}>
                  <div className="row-info">
                    <span className="row-name">
                      {CLASS_ICON[c.className]} {c.name}
                    </span>
                    <span className="row-desc">
                      {CLASS_LABEL[c.className]} — {CLASS_DESCRIPTION[c.className]}
                    </span>
                    <span className="row-sub">{compactStats(c)}</span>
                  </div>
                </button>
              ))}
            </div>
            <button
              className="small-button"
              disabled={!canAffordReroll}
              onClick={handleReroll}
            >
              🎲 Reroll for {Math.floor(rerollPrice).toLocaleString()} 🪙
            </button>
          </>
        ) : (
          <>
            <button className="small-button" onClick={() => setSelectedId(null)}>
              ← Back
            </button>
            <ChampionDetail adv={selected} />
            <button
              className="small-button"
              disabled={!canAfford}
              onClick={() => handleRecruit(selected.id)}
            >
              Recruit for {Math.floor(cost).toLocaleString()} 🪙
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function compactStats(adv: Adventurer): string {
  const stats = adventurerStats(adv);
  return `ATK ${stats.atk} · DEF ${stats.def} · HP ${stats.maxHp}`;
}

function ChampionDetail({ adv }: { adv: Adventurer }) {
  const stats = adventurerStats(adv);
  return (
    <div className="rows">
      <h3 className="section-title">{adv.name}</h3>
      <p className="detail-sub">
        {CLASS_ICON[adv.className]} {CLASS_LABEL[adv.className]} · Level {adv.level}
      </p>
      <div className="detail-stats">
        <div className="stat">
          <span className="stat-value">{stats.atk}</span>
          <span className="stat-label">Attack</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.def}</span>
          <span className="stat-label">Defense</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.maxHp}</span>
          <span className="stat-label">Max HP</span>
        </div>
      </div>
      <AttributeBars attributes={adv.attributes} />
      <PerkBadge adv={adv} />
      <SkillBadge adv={adv} />
    </div>
  );
}

/** One bar per attribute, scaled to the highest of the set shown. */
function AttributeBars({ attributes }: { attributes: Attributes }) {
  const barMax = Math.max(1, ...ATTRIBUTES.map((a) => attributes[a.id]));
  return (
    <div className="stat-bars">
      {ATTRIBUTES.map((a) => (
        <div className="stat-bar-row" key={a.id}>
          <span className="stat-bar-label">{a.abbr}</span>
          <div className="stat-bar-track">
            <div
              className="stat-bar-fill"
              style={{ width: `${(attributes[a.id] / barMax) * 100}%` }}
            />
          </div>
          <span className="stat-bar-value">{attributes[a.id]}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Champion detail modal — full stats plus equipment slots (weapon/armor/
// trinket), with a picker per slot showing candidates from the shared
// inventory and their stat delta versus what's currently equipped.
// ---------------------------------------------------------------------------

function ChampionDetailModal({ adv, onClose }: { adv: Adventurer; onClose: () => void }) {
  const store = useGameStore();
  const state = useGameState();
  const [pickerSlot, setPickerSlot] = useState<EquipSlot | null>(null);
  const [confirmFire, setConfirmFire] = useState(false);
  const stats = adventurerStats(adv);
  const attrs = effectiveAttributes(adv);
  const hpMax = maxHp(adv);
  const xpPct = Math.floor((adv.xp / xpToNext(adv.level)) * 100);
  const onExpedition = adv.assignment?.mode === 'expedition';

  function handleFire() {
    store.dispatch((s) => fireAdventurer(s, adv.id));
    onClose();
  }

  return (
    <div className="story-overlay" onClick={onClose}>
      <div className="story-modal detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <h2 className="story-title">{adv.name}</h2>
          <button className="small-button" onClick={onClose}>✕</button>
        </div>
        <p className="detail-sub">
          {CLASS_ICON[adv.className]} Level {adv.level} {CLASS_LABEL[adv.className]}
        </p>

        {confirmFire && (
          <div className="row row-bad">
            <div className="row-info">
              <span className="row-name">Fire {adv.name}?</span>
              <span className="row-desc">
                They leave the guild for good — no permadeath, but this can't be undone.
                Equipped gear returns to your inventory first.
              </span>
            </div>
            <div className="equip-detail-actions">
              <button className="small-button danger" onClick={handleFire}>Confirm</button>
              <button className="small-button" onClick={() => setConfirmFire(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="progress-line">
          <div className="progress-track">
            <div className="progress-fill xp" style={{ width: `${xpPct}%` }} />
          </div>
          <span className="progress-time">
            {adv.xp}/{xpToNext(adv.level)} XP
          </span>
        </div>

        <div className="detail-stats">
          <div className="stat">
            <span className="stat-value">{stats.atk}</span>
            <span className="stat-label">Attack</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.def}</span>
            <span className="stat-label">Defense</span>
          </div>
          <div className="stat">
            <span className="stat-value">{hpMax}</span>
            <span className="stat-label">Max HP</span>
          </div>
        </div>

        <AttributeBars attributes={attrs} />

        <PerkBadge adv={adv} />
        <SkillBadge adv={adv} />

        {(adv.enemiesDefeated > 0 || adv.totalDamageDealt > 0) && (
          <div className="detail-stats">
            {adv.enemiesDefeated > 0 && (
              <div className="stat">
                <span className="stat-value">{adv.enemiesDefeated}</span>
                <span className="stat-label">Enemies Defeated</span>
              </div>
            )}
            {adv.totalDamageDealt > 0 && (
              <div className="stat">
                <span className="stat-value">{adv.totalDamageDealt}</span>
                <span className="stat-label">Total Damage</span>
              </div>
            )}
          </div>
        )}

        <div className="section-title-row">
          <h3 className="section-title">Equipment</h3>
          <button
            className="small-button"
            disabled={state.inventory.length === 0}
            onClick={() => store.dispatch((s) => autoEquipBest(s, adv.id))}
          >
            ✨ Auto-equip
          </button>
        </div>
        <div className="rows">
          {EQUIP_SLOTS.map((slot) => {
            const item = adv.equipment[slot];
            const candidates = state.inventory.filter((i) => i.slot === slot);
            return (
              <div key={slot}>
                <div className={`row ${item ? `item-${item.rarity}` : 'locked'}`}>
                  <div className="row-info">
                    <span className="row-name">
                      {item ? `${itemIcon(item)} ${item.name}` : `${SLOT_FALLBACK_ICON[slot]} No ${slot}`}
                    </span>
                    {item && (
                      <span className="row-desc">
                        {item.rarity} {itemTypeLabel(item)} · {itemStatParts(item).join(' · ')}
                      </span>
                    )}
                  </div>
                  <div className="equip-detail-actions">
                    <button
                      className="small-button"
                      disabled={candidates.length === 0}
                      onClick={() => setPickerSlot(pickerSlot === slot ? null : slot)}
                    >
                      {item ? 'Change' : 'Equip'}
                      {candidates.length > 0 ? ` (${candidates.length})` : ''}
                    </button>
                    {item && (
                      <button
                        className="small-button"
                        onClick={() => store.dispatch((s) => unequipItem(s, adv.id, slot))}
                      >
                        Unequip
                      </button>
                    )}
                  </div>
                </div>
                {pickerSlot === slot && (
                  <div className="equip-picker">
                    {candidates.length === 0 ? (
                      <div className="row locked">No {slot} in inventory.</div>
                    ) : (
                      candidates.map((cand) => (
                        <button
                          key={cand.id}
                          className={`equip-picker-item item-${cand.rarity}`}
                          onClick={() => {
                            store.dispatch((s) => equipItem(s, adv.id, cand.id));
                            setPickerSlot(null);
                          }}
                        >
                          <span className="row-name">{itemIcon(cand)} {cand.name}</span>
                          <span className="row-desc">
                            {cand.rarity} · {itemStatParts(cand).join(' · ')}
                          </span>
                          <EquipDeltaChips delta={equipDelta(adv, cand)} />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="zone-actions">
          {adv.assignment?.mode === 'auto-explore' && (
            <button
              className="small-button danger"
              onClick={() => store.dispatch((s) => recallAdventurer(s, adv.id))}
            >
              Recall
            </button>
          )}
          <button
            className="small-button danger"
            disabled={onExpedition}
            onClick={() => setConfirmFire(true)}
          >
            🔥 Fire
          </button>
        </div>
      </div>
    </div>
  );
}

/** Green/red ▲▼ chips showing how a candidate item changes atk/def/HP. */
function EquipDeltaChips({ delta }: { delta: ReturnType<typeof equipDelta> }) {
  const parts: { label: string; value: number }[] = [
    { label: '⚔', value: delta.atk },
    { label: '🛡', value: delta.def },
    { label: '❤', value: delta.hp },
  ].filter((p) => p.value !== 0);
  if (parts.length === 0) {
    return (
      <span className="equip-delta-row">
        <span className="equip-delta same">no change</span>
      </span>
    );
  }
  return (
    <span className="equip-delta-row">
      {parts.map((p) => (
        <span key={p.label} className={`equip-delta ${p.value > 0 ? 'up' : 'down'}`}>
          {p.label} {p.value > 0 ? '▲' : '▼'}{Math.abs(p.value)}
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Quests — every standing bounty on the board
// ---------------------------------------------------------------------------

function QuestsSection() {
  const state = useGameState();
  const fmt = useFormat();
  const totalGoldPerSec = totalQuestGoldPerSec(state);
  const [showPerSecond, setShowPerSecond] = useState(false);

  return (
    <section className="rows">
      <div className="section-title-row">
        <h3 className="section-title">Running Quests ({state.quests.length})</h3>
        <button className="small-button" onClick={() => setShowPerSecond((v) => !v)}>
          {showPerSecond ? 'Show round totals' : 'Show per-second rates'}
        </button>
      </div>
      {state.quests.length > 0 && (
        <div className="row locked">
          Total upkeep: <strong>{fmt(totalGoldPerSec)} 🪙/s</strong> across the whole board
        </div>
      )}
      {state.quests.length === 0 && (
        <div className="row locked">
          No quests posted. Open the Map tab and post a bounty on a monster or gatherable.
        </div>
      )}
      {state.quests.map((q) => (
        <QuestRow key={q.id} quest={q} showPerSecond={showPerSecond} />
      ))}
    </section>
  );
}

function repeatsLabel(remaining: number, repeatCount: number, completedCount: number): string {
  if (repeatCount <= 0) return 'unlimited';
  return `${completedCount}/${repeatCount} done, ${Number.isFinite(remaining) ? remaining : '∞'} left`;
}

/** "5 Beast Pelt, 3 Wild Herbs" — one requirement's name isn't shown here
 * since a quest can bundle several different targets into one payout. */
function materialsSummary(materials: { materialId: string; amount: number }[]): string {
  return materials.map((m) => `${m.amount} ${materialName(m.materialId)}`).join(', ');
}

function questTitle(quest: Quest): string {
  const names = quest.requirements
    .map((r) => questTargetDef(r.targetId)?.name)
    .filter((n): n is string => !!n);
  return names.join(' + ') || 'Quest';
}

function QuestRow({ quest, showPerSecond }: { quest: Quest; showPerSecond: boolean }) {
  const store = useGameStore();
  const state = useGameState();
  const rates = questRates(state, quest);
  const progress = questProgress(state, quest);
  const summary = questBatchSummary(state, quest);
  if (!summary) return null;

  return (
    <div className="row item-common">
      <div className="row-info">
        <span className="row-name">{questTitle(quest)}</span>
        {rates.goldStarved ? (
          <span className="row-bad">⚠ Not enough gold — this quest is stalled.</span>
        ) : rates.adventurerStarved ? (
          <span className="row-bad">⚠ No adventurers assigned right now.</span>
        ) : showPerSecond ? (
          <>
            <span className="row-desc">
              {Object.entries(rates.materialsPerSec)
                .map(([id, perSec]) => `~${rate(perSec)} ${materialName(id)}/s`)
                .join(' · ')} · −{rate(rates.goldPerSec)} 🪙/s · +{rate(rates.reputationPerSec)} ★/s
              (reference)
            </span>
            <span className="row-good">{rates.adventurers} adventurers assigned</span>
          </>
        ) : (
          <span className="row-desc">
            {materialsSummary(summary.materials)} · −{rate(summary.gold)} 🪙 · +{rate(summary.reputation)} ★
            · {formatDuration(summary.timeSeconds)}/round · {summary.assigned}/{summary.maxAdventurers}{' '}
            adventurers
          </span>
        )}
        <span className="row-sub">
          {repeatsLabel(summary.repeatsRemaining, summary.repeatCount, summary.completedCount)}
        </span>
        <div className="progress-line">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress.fraction * 100}%` }} />
          </div>
          <span className="progress-time">
            {Number.isFinite(progress.etaSeconds)
              ? `${formatDuration(progress.etaSeconds)} to next round`
              : 'stalled'}
          </span>
        </div>
      </div>
      <button
        className="small-button danger"
        onClick={() => store.dispatch((s) => deleteQuest(s, quest.id))}
      >
        Delete
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upgrades
// ---------------------------------------------------------------------------

function UpgradesSection() {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();

  return (
    <section className="rows">
      <h3 className="section-title">Guild Upgrades</h3>
      {GUILD_UPGRADES.map((def) => {
        const level = state.guildUpgrades[def.id] ?? 0;
        const maxed = level >= def.maxLevel;
        const cost = guildUpgradeCost(state, def.id);
        const affordable = canBuyGuildUpgrade(state, def.id);
        const repLocked = !maxed && state.reputation < cost.reputation;
        return (
          <button
            key={def.id}
            className={`row ${affordable ? '' : 'unaffordable'}`}
            disabled={!affordable}
            onClick={() => store.dispatch((s) => buyGuildUpgrade(s, def.id))}
          >
            <div className="row-info">
              <span className="row-name">
                {def.name} <span className="row-sub">Lv {level}/{def.maxLevel}</span>
              </span>
              <span className="row-desc">{def.description}</span>
              {repLocked && (
                <span className="row-bad">
                  🔒 Requires ★ {fmt(cost.reputation)} reputation ({fmt(Math.floor(state.reputation))} so far)
                </span>
              )}
            </div>
            <div className="row-cost">
              {maxed ? (
                'Max'
              ) : (
                <>
                  {fmt(cost.gold)} 🪙
                  {Object.entries(cost.materials).map(([id, n]) => (
                    <span key={id} className="mat-cost">
                      {n} {materialName(id)}
                    </span>
                  ))}
                </>
              )}
            </div>
          </button>
        );
      })}
    </section>
  );
}
