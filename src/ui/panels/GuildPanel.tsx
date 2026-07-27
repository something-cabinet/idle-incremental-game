import { useState } from 'react';
import { adventurerStats, championPerk, championSkill, effectiveAttributes, equipDelta, isInjured, maxHp } from '../../game/adventurers';
import { ATTRIBUTES, GUILD_UPGRADES, xpToNext } from '../../game/config';
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
import type { Adventurer, Attributes, EquipSlot, Quest } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { usePanelSection } from '../../hooks/usePanelSection';
import { InfoNote, Modal, NoteRow, Stat, StatChips } from '../components';
import {
  CLASS_DESCRIPTION,
  CLASS_ICON,
  CLASS_LABEL,
  SLOT_ICON,
  itemIcon,
  itemStatParts,
  itemStatText,
  itemTypeLabel,
  materialName,
  rate,
} from '../display';
import { GearPerkBadge } from '../GearPerkBadge';
import { Icon } from '../icons';

type Section = 'champions' | 'quests' | 'upgrades';

const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'armor', 'trinket'];

/** The champion's passive perk, shown in detail views. */
function PerkBadge({ adv }: { adv: Adventurer }) {
  const perk = championPerk(adv.perkId);
  if (!perk) return null;
  return (
    <div className={`row perk-row perk-${perk.tier} has-actions`}>
      <div className="row-info">
        <span className="row-name">
          <Icon name={perk.tier === 'major' ? 'star' : 'sparkle'} /> {perk.name}
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
    <div className="row skill-row has-actions">
      <div className="row-info">
        <span className="row-name">
          <Icon name="target" /> {skill.name}
          <span className="perk-tag">{skill.cooldownTurns}-turn CD</span>
        </span>
        <span className="row-desc">{skill.description}</span>
      </div>
    </div>
  );
}

export function GuildPanel() {
  const [section, setSection] = usePanelSection<Section>('guild', 'champions');

  return (
    <div className="panel">
      <div className="subtab-bar">
        <button
          className={`subtab ${section === 'champions' ? 'active' : ''}`}
          onClick={() => setSection('champions')}
        >
          Champions
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

      {section === 'champions' && <ChampionsSection />}
      {section === 'quests' && <QuestsSection />}
      {section === 'upgrades' && <UpgradesSection />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Champions — the hand-picked roster, plus the anonymous town pool that
// reputation draws in to work the quest board.
// ---------------------------------------------------------------------------

function ChampionsSection() {
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
      <div className="detail-stats">
        <Stat value={fmt(Math.floor(state.reputation))} label="Reputation" icon="star" tone="accent" />
        <Stat value={count} label="Adventurers" />
        <Stat value={`${state.adventurers.length}/${cap}`} label="Champions" />
        <Stat value={state.quests.length} label="Quests" />
      </div>

      <InfoNote
        id="guild-roster"
        title="Adventurers vs. champions"
        defaultOpen={state.adventurers.length === 0}
      >
        Adventurers are the anonymous crowd your <strong>reputation</strong> attracts — they split
        their effort across every quest on the board. Champions are the few you recruit, equip and
        send out yourself.
      </InfoNote>

      {nextZone && (
        <NoteRow icon="lock" tone="muted">
          <span className="row-desc">
            {nextZone.name} unlocks at {fmt(nextZone.repRequired ?? 0)} reputation —{' '}
            {fmt(Math.max(0, Math.ceil((nextZone.repRequired ?? 0) - state.reputation)))} to go
          </span>
        </NoteRow>
      )}

      <h3 className="section-title">
        Champions ({state.adventurers.length}/{cap})
      </h3>
      <div className="rows">
        {state.adventurers.map((adv) => (
          <ChampionCard key={adv.id} adv={adv} onOpen={() => setDetailId(adv.id)} />
        ))}
        {Array.from({ length: Math.max(0, cap - state.adventurers.length) }, (_, i) => (
          <button key={i} className="empty-slot" onClick={openRecruit}>
            <Icon name="plus" /> Recruit Champion
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
  const stats = adventurerStats(adv);
  const injured = isInjured(adv, state.runTimeSeconds);
  const exploring = adv.assignment?.mode === 'auto-explore';
  return (
    <button className="row adventurer-card" onClick={onOpen}>
      <div className="row-info">
        <span className="row-name">
          <Icon name={CLASS_ICON[adv.className]} /> {adv.name}
          <span className="row-sub"> Lv {adv.level}</span>
        </span>
        <span className="row-sub">
          <StatChips parts={[
            { key: 'atk', icon: 'sword', text: String(stats.atk) },
            { key: 'def', icon: 'shield', text: String(stats.def) },
            { key: 'hp', icon: 'heart', text: String(maxHp(adv)) },
          ]} />
        </span>
        {injured ? (
          <span className="row-bad">
            <Icon name="bandage" /> Recovering —{' '}
            {formatDuration(Math.max(0, adv.injuredUntil - state.runTimeSeconds))} left
          </span>
        ) : exploring ? (
          <span className="row-good">
            <Icon name="map" /> Auto-exploring{' '}
            {locationDef(adv.assignment!.locationId)?.name ?? adv.assignment!.locationId}
          </span>
        ) : null}
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
  const fmt = useFormat();
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

  return (
    <Modal
      title={selected ? selected.name : 'Recruit a Champion'}
      onClose={onClose}
      footer={
        selected ? (
          <>
            <button className="small-button" onClick={() => setSelectedId(null)}>
              Back
            </button>
            <button
              className="small-button primary"
              disabled={!canAfford}
              onClick={() => handleRecruit(selected.id)}
            >
              Recruit — {fmt(cost)} gold
            </button>
          </>
        ) : (
          <button className="small-button" disabled={!canAffordReroll} onClick={() => {
            store.dispatch((s) => rerollRecruits(s));
            setSelectedId(null);
          }}>
            <Icon name="dice" /> Reroll — {fmt(rerollPrice)} gold
          </button>
        )
      }
    >
      {selected ? (
        <ChampionDetail adv={selected} />
      ) : (
        <div className="rows">
          {candidates.map((c) => {
            const stats = adventurerStats(c);
            return (
              <button key={c.id} className="row" onClick={() => setSelectedId(c.id)}>
                <div className="row-info">
                  <span className="row-name">
                    <Icon name={CLASS_ICON[c.className]} /> {c.name}
                  </span>
                  <span className="row-desc">{CLASS_DESCRIPTION[c.className]}</span>
                  <span className="row-sub">
                    <StatChips parts={[
                      { key: 'atk', icon: 'sword', text: String(stats.atk) },
                      { key: 'def', icon: 'shield', text: String(stats.def) },
                      { key: 'hp', icon: 'heart', text: String(stats.maxHp) },
                    ]} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function ChampionDetail({ adv }: { adv: Adventurer }) {
  const stats = adventurerStats(adv);
  return (
    <div className="rows">
      <p className="detail-sub">
        <Icon name={CLASS_ICON[adv.className]} /> {CLASS_LABEL[adv.className]} · Level {adv.level}
      </p>
      <div className="detail-stats">
        <Stat value={stats.atk} label="Attack" icon="sword" />
        <Stat value={stats.def} label="Defense" icon="shield" />
        <Stat value={stats.maxHp} label="Max HP" icon="heart" />
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
// Champion detail modal
//
// Split into three tabs. As one scroll it ran to ~20 distinct blocks — XP,
// three stats, six attribute bars, perk, skill, lifetime counters, three
// equipment slots each with their own picker, then recall and fire — which is
// far past what anyone holds in working memory, and buried the equipment
// controls (the reason you open this) under a wall of numbers.
// ---------------------------------------------------------------------------

type DetailTab = 'stats' | 'gear' | 'manage';

function ChampionDetailModal({ adv, onClose }: { adv: Adventurer; onClose: () => void }) {
  const [tab, setTab] = useState<DetailTab>('stats');

  return (
    <Modal
      title={
        <>
          <Icon name={CLASS_ICON[adv.className]} /> {adv.name}
        </>
      }
      onClose={onClose}
    >
      <p className="detail-sub">
        Level {adv.level} {CLASS_LABEL[adv.className]}
      </p>

      <div className="subtab-bar">
        {(['stats', 'gear', 'manage'] as DetailTab[]).map((t) => (
          <button
            key={t}
            className={`subtab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'stats' ? 'Stats' : t === 'gear' ? 'Equipment' : 'Manage'}
          </button>
        ))}
      </div>

      {tab === 'stats' && <ChampionStatsTab adv={adv} />}
      {tab === 'gear' && <ChampionGearTab adv={adv} />}
      {tab === 'manage' && <ChampionManageTab adv={adv} onClose={onClose} />}
    </Modal>
  );
}

function ChampionStatsTab({ adv }: { adv: Adventurer }) {
  const stats = adventurerStats(adv);
  const attrs = effectiveAttributes(adv);
  const xpPct = Math.floor((adv.xp / xpToNext(adv.level)) * 100);

  return (
    <div className="rows">
      <div className="progress-line">
        <div className="progress-track">
          <div className="progress-fill xp" style={{ width: `${xpPct}%` }} />
        </div>
        <span className="progress-time">
          {adv.xp}/{xpToNext(adv.level)} XP
        </span>
      </div>

      <div className="detail-stats">
        <Stat value={stats.atk} label="Attack" icon="sword" />
        <Stat value={stats.def} label="Defense" icon="shield" />
        <Stat value={maxHp(adv)} label="Max HP" icon="heart" />
      </div>

      <AttributeBars attributes={attrs} />
      <PerkBadge adv={adv} />
      <SkillBadge adv={adv} />

      {(adv.enemiesDefeated > 0 || adv.totalDamageDealt > 0) && (
        <div className="detail-stats">
          <Stat value={adv.enemiesDefeated} label="Enemies Defeated" />
          <Stat value={adv.totalDamageDealt} label="Total Damage" />
        </div>
      )}
    </div>
  );
}

function ChampionGearTab({ adv }: { adv: Adventurer }) {
  const store = useGameStore();
  const state = useGameState();
  const [pickerSlot, setPickerSlot] = useState<EquipSlot | null>(null);

  return (
    <div className="rows">
      <div className="section-title-row">
        <h3 className="section-title">Equipment</h3>
        <button
          className="small-button"
          disabled={state.inventory.length === 0}
          onClick={() => store.dispatch((s) => autoEquipBest(s, adv.id))}
        >
          <Icon name="sparkle" /> Auto-equip
        </button>
      </div>

      {EQUIP_SLOTS.map((slot) => {
        const item = adv.equipment[slot];
        const candidates = state.inventory.filter((i) => i.slot === slot);
        return (
          <div key={slot}>
            <div className={`row has-actions ${item ? `item-${item.rarity}` : 'row-locked'}`}>
              <div className="row-info">
                <span className="row-name">
                  <Icon name={item ? itemIcon(item) : SLOT_ICON[slot]} />{' '}
                  {item ? item.name : `No ${slot}`}
                </span>
                {item && (
                  <span className="row-desc">
                    {item.rarity} {itemTypeLabel(item)} · {itemStatText(item)}
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
                    Remove
                  </button>
                )}
              </div>
            </div>
            {item && <GearPerkBadge item={item} />}
            {pickerSlot === slot && (
              <div className="equip-picker">
                {candidates.map((cand) => (
                  <button
                    key={cand.id}
                    className={`equip-picker-item item-${cand.rarity}`}
                    onClick={() => {
                      store.dispatch((s) => equipItem(s, adv.id, cand.id));
                      setPickerSlot(null);
                    }}
                  >
                    <span className="row-name">
                      <Icon name={itemIcon(cand)} /> {cand.name}
                    </span>
                    <span className="row-desc">
                      {cand.rarity} · <StatChips parts={itemStatParts(cand)} />
                    </span>
                    <EquipDeltaChips delta={equipDelta(adv, cand)} />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChampionManageTab({ adv, onClose }: { adv: Adventurer; onClose: () => void }) {
  const store = useGameStore();
  const [confirmFire, setConfirmFire] = useState(false);
  const onExpedition = adv.assignment?.mode === 'expedition';

  function handleFire() {
    store.dispatch((s) => fireAdventurer(s, adv.id));
    onClose();
  }

  return (
    <div className="rows">
      {adv.assignment?.mode === 'auto-explore' && (
        <div className="row has-actions">
          <div className="row-info">
            <span className="row-name">Auto-exploring</span>
            <span className="row-desc">Bring them home to reassign or equip them.</span>
          </div>
          <button
            className="small-button"
            onClick={() => store.dispatch((s) => recallAdventurer(s, adv.id))}
          >
            Recall
          </button>
        </div>
      )}

      {confirmFire ? (
        <div className="row row-warning has-actions">
          <div className="row-info">
            <span className="row-name">Dismiss {adv.name}?</span>
            <span className="row-desc">
              They leave the guild for good — no permadeath, but this can't be undone. Equipped
              gear returns to your inventory first.
            </span>
            <div className="equip-detail-actions">
              <button className="small-button" onClick={() => setConfirmFire(false)}>
                Cancel
              </button>
              <button className="small-button danger" onClick={handleFire}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          className="small-button danger"
          disabled={onExpedition}
          onClick={() => setConfirmFire(true)}
        >
          Dismiss from guild
        </button>
      )}
    </div>
  );
}

/** Green/red chips showing how a candidate item changes atk/def/HP. */
function EquipDeltaChips({ delta }: { delta: ReturnType<typeof equipDelta> }) {
  const parts = [
    { key: 'atk', icon: 'sword' as const, value: delta.atk },
    { key: 'def', icon: 'shield' as const, value: delta.def },
    { key: 'hp', icon: 'heart' as const, value: delta.hp },
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
        <span key={p.key} className={`equip-delta ${p.value > 0 ? 'up' : 'down'}`}>
          <Icon name={p.icon} />
          <Icon name={p.value > 0 ? 'up' : 'down'} />
          {Math.abs(p.value)}
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
        {state.quests.length > 0 && (
          <button className="small-button" onClick={() => setShowPerSecond((v) => !v)}>
            {showPerSecond ? 'Round totals' : 'Per-second'}
          </button>
        )}
      </div>

      {state.quests.length === 0 ? (
        <NoteRow icon="info" tone="muted">
          No quests posted. Open the Map tab and post a bounty on a monster or gatherable.
        </NoteRow>
      ) : (
        <NoteRow icon="coin">
          <span className="row-desc">
            Total upkeep <strong>{fmt(totalGoldPerSec)} gold/s</strong> across the whole board
          </span>
        </NoteRow>
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

  const stalled = rates.goldStarved || rates.adventurerStarved;

  return (
    <div className={`row has-actions ${stalled ? 'row-warning' : 'item-common'}`}>
      <div className="row-info">
        <span className="row-name">{questTitle(quest)}</span>
        {rates.goldStarved ? (
          <span className="row-bad">
            <Icon name="warning" /> Not enough gold — this quest is stalled.
          </span>
        ) : rates.adventurerStarved ? (
          <span className="row-bad">
            <Icon name="warning" /> No adventurers assigned right now.
          </span>
        ) : showPerSecond ? (
          <>
            <span className="row-desc">
              {Object.entries(rates.materialsPerSec)
                .map(([id, perSec]) => `~${rate(perSec)} ${materialName(id)}/s`)
                .join(' · ')}{' '}
              · −{rate(rates.goldPerSec)} gold/s · +{rate(rates.reputationPerSec)} rep/s
            </span>
            <span className="row-good">{rates.adventurers} adventurers assigned</span>
          </>
        ) : (
          <span className="row-desc">
            {summary.materials.map((m) => `${m.amount} ${materialName(m.materialId)}`).join(', ')} ·
            −{rate(summary.gold)} gold · +{rate(summary.reputation)} rep ·{' '}
            {formatDuration(summary.timeSeconds)}/round · {summary.assigned}/
            {summary.maxAdventurers} adventurers
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
        className="icon-button"
        aria-label={`Delete ${questTitle(quest)}`}
        onClick={() => store.dispatch((s) => deleteQuest(s, quest.id))}
      >
        <Icon name="close" />
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
      {GUILD_UPGRADES.map((def) => {
        const level = state.guildUpgrades[def.id] ?? 0;
        const maxed = level >= def.maxLevel;
        const cost = guildUpgradeCost(state, def.id);
        const affordable = canBuyGuildUpgrade(state, def.id);
        const repLocked = !maxed && state.reputation < cost.reputation;
        return (
          <button
            key={def.id}
            className={`row ${affordable ? '' : 'unaffordable'} ${maxed ? 'maxed' : ''}`}
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
                  <Icon name="lock" /> Requires {fmt(cost.reputation)} reputation (
                  {fmt(Math.floor(state.reputation))} so far)
                </span>
              )}
            </div>
            <div className="row-cost">
              {maxed ? (
                'Max'
              ) : (
                <>
                  <span>
                    <Icon name="coin" /> {fmt(cost.gold)}
                  </span>
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
