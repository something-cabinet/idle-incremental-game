import { useState } from 'react';
import {
  adventurerStats,
  effectiveAttributes,
  isInjured,
  maxHp,
} from '../../game/adventurers';
import {
  ATTRIBUTES,
  CLASS_DEFS,
  DAY_LENGTH_SECONDS,
  ENCOUNTER_INTERVAL,
  GUILD_UPGRADES,
  MATERIALS,
  xpToNext,
} from '../../game/config';
import { formatDuration } from '../../game/format';
import {
  buyGuildUpgrade,
  canBuyGuildUpgrade,
  equipItem,
  guildUpgradeCost,
  hireAdventurer,
  hireCost,
  locationDef,
  recallAdventurer,
  rosterCap,
  unequipItem,
} from '../../game/guild';
import type { Adventurer, EquipSlot, GameState, LogEntry } from '../../game/types';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { itemIcon, itemStatParts, itemTypeLabel } from '../itemDisplay';

export function GuildPanel() {
  const state = useGameState();
  const [section, setSection] = useState<'adventurers' | 'upgrades' | 'logs'>('adventurers');
  const [detailId, setDetailId] = useState<number | null>(null);
  const detail = state.adventurers.find((a) => a.id === detailId);

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
          className={`subtab ${section === 'upgrades' ? 'active' : ''}`}
          onClick={() => setSection('upgrades')}
        >
          Upgrades
        </button>
        <button
          className={`subtab ${section === 'logs' ? 'active' : ''}`}
          onClick={() => setSection('logs')}
        >
          Logs
        </button>
      </div>

      {section === 'adventurers' && (
        <AdventurersSection onOpen={(id) => setDetailId(id)} />
      )}
      {section === 'upgrades' && <UpgradesSection />}
      {section === 'logs' && <ActivityLog />}

      {detail && <AdventurerDetail adv={detail} onClose={() => setDetailId(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adventurers section
// ---------------------------------------------------------------------------

function AdventurersSection({ onOpen }: { onOpen: (id: number) => void }) {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();
  const canHire =
    state.adventurers.length < rosterCap(state) && state.gold >= hireCost(state);

  return (
    <section className="rows">
      <h3 className="section-title">
        Adventurers ({state.adventurers.length}/{rosterCap(state)})
      </h3>
      {state.adventurers.map((adv) => (
        <AdventurerCard key={adv.id} adv={adv} onOpen={() => onOpen(adv.id)} />
      ))}
      <button
        className={`row ${canHire ? '' : 'unaffordable'}`}
        disabled={!canHire}
        onClick={() => store.dispatch((s) => hireAdventurer(s))}
      >
        <div className="row-info">
          <span className="row-name">Hire Adventurer</span>
          <span className="row-desc">
            {state.adventurers.length >= rosterCap(state)
              ? 'Roster full — upgrade the Guild Hall.'
              : 'A new blade for the guild.'}
          </span>
        </div>
        <div className="row-cost">{fmt(hireCost(state))} 🪙</div>
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Upgrades section
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
            </div>
            <div className="row-cost">
              {maxed ? 'Max' : (
                <>
                  {fmt(cost.gold)} 🪙
                  {Object.entries(cost.materials).map(([id, n]) => (
                    <span key={id} className="mat-cost">
                      {n} {MATERIALS.find((m) => m.id === id)?.name ?? id}
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

// ---------------------------------------------------------------------------
// Adventurer cards
// ---------------------------------------------------------------------------

function xpPercent(adv: Adventurer): number {
  return Math.floor((adv.xp / xpToNext(adv.level)) * 100);
}

/** Current timed activity: progress fraction, seconds left, and a label. */
function activityProgress(
  state: GameState,
  adv: Adventurer,
): { label: string; fraction: number; secondsLeft: number } | null {
  const now = state.runTimeSeconds;
  if (isInjured(adv, now)) {
    const left = adv.injuredUntil - now;
    const total = adv.injuredDuration || left;
    return { label: 'recovered', fraction: 1 - left / total, secondsLeft: left };
  }
  if (!adv.assignment) return null;
  if (adv.assignment.mode === 'quest') {
    const endsAt = adv.assignment.questEndsAt ?? now;
    const total = locationDef(adv.assignment.locationId)?.questDuration ?? 1;
    const left = Math.max(0, endsAt - now);
    return { label: 'quest done', fraction: 1 - left / total, secondsLeft: left };
  }
  if (adv.assignment.mode === 'patrol') {
    const elapsed = now - adv.assignment.lastEncounterAt;
    const left = Math.max(0, ENCOUNTER_INTERVAL - elapsed);
    return { label: 'next drop', fraction: elapsed / ENCOUNTER_INTERVAL, secondsLeft: left };
  }
  return null; // expeditions show party-wide status on the Map tab
}

function AdventurerCard({ adv, onOpen }: { adv: Adventurer; onOpen: () => void }) {
  const store = useGameStore();
  const state = useGameState();
  const { atk, def } = adventurerStats(adv);
  const injured = isInjured(adv, state.runTimeSeconds);
  const hpMax = maxHp(adv);
  const hpNow = injured ? 0 : Math.round(adv.hp);
  const hpPct = injured ? 0 : Math.min(100, Math.max(0, (adv.hp / hpMax) * 100));
  const status = injured
    ? '🩹 Recovering'
    : adv.assignment
      ? assignmentLabel(adv)
      : 'Idle at the guild hall';
  const progress = activityProgress(state, adv);

  return (
    <div
      className={`adventurer-card clickable ${injured ? 'injured' : ''}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <div className="row-info">
        <span className="row-name">
          {adv.name}{' '}
          <span className="row-sub">
            Lv {adv.level} ({xpPercent(adv)}%) {adv.className}
          </span>
        </span>
        <span className="row-desc">⚔ {atk} · 🛡 {def} · ❤ {hpNow}/{hpMax}</span>
        <div className="progress-line">
          <div className="progress-track">
            <div className="progress-fill hp" style={{ width: `${hpPct}%` }} />
          </div>
        </div>
        <span className={injured ? 'row-bad' : 'row-good'}>{status}</span>
        {progress && (
          <div className="progress-line">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, progress.fraction * 100))}%` }}
              />
            </div>
            <span className="progress-time">
              {formatDuration(progress.secondsLeft)} to {progress.label}
            </span>
          </div>
        )}
      </div>
      {adv.assignment && adv.assignment.mode !== 'expedition' && (
        <button
          className="small-button"
          onClick={(e) => {
            e.stopPropagation();
            store.dispatch((s) => recallAdventurer(s, adv.id));
          }}
        >
          Recall
        </button>
      )}
    </div>
  );
}

function assignmentLabel(adv: Adventurer): string {
  const loc = locationDef(adv.assignment!.locationId);
  const name = loc?.name ?? '???';
  switch (adv.assignment!.mode) {
    case 'quest':
      return `📜 On quest — ${name}`;
    case 'expedition':
      return `⚔ On expedition — ${name}`;
    default:
      return `🐾 Patrolling — ${name}`;
  }
}

// ---------------------------------------------------------------------------
// Detail popup
// ---------------------------------------------------------------------------

function AdventurerDetail({ adv, onClose }: { adv: Adventurer; onClose: () => void }) {
  const store = useGameStore();
  const state = useGameState();
  const { atk, def } = adventurerStats(adv);
  const attrs = effectiveAttributes(adv);
  const primary = CLASS_DEFS[adv.className].primary;
  const injured = isInjured(adv, state.runTimeSeconds);
  const hpMax = maxHp(adv);
  const hpNow = injured ? 0 : Math.round(adv.hp);
  const status = injured
    ? `🩹 Recovering — ${formatDuration(adv.injuredUntil - state.runTimeSeconds)} left`
    : adv.assignment
      ? assignmentLabel(adv)
      : 'Idle at the guild hall';
  const [pickerSlot, setPickerSlot] = useState<EquipSlot | null>(null);

  return (
    <div className="story-overlay" onClick={onClose}>
      <div className="story-modal detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <h2 className="story-title">{adv.name}</h2>
          <button className="small-button" onClick={onClose}>✕</button>
        </div>
        <p className="detail-sub">
          Level {adv.level} {adv.className} · {status}
        </p>

        <div className="progress-line">
          <div className="progress-track">
            <div className="progress-fill xp" style={{ width: `${xpPercent(adv)}%` }} />
          </div>
          <span className="progress-time">
            {adv.xp}/{xpToNext(adv.level)} XP
          </span>
        </div>

        <div className="detail-stats">
          <div className="stat">
            <span className="stat-value">⚔ {atk}</span>
            <span className="stat-label">Attack</span>
          </div>
          <div className="stat">
            <span className="stat-value">🛡 {def}</span>
            <span className="stat-label">Defense</span>
          </div>
          <div className="stat">
            <span className="stat-value">❤ {hpNow}/{hpMax}</span>
            <span className="stat-label">Health</span>
          </div>
        </div>

        <h3 className="section-title">Attributes</h3>
        <div className="attr-grid">
          {ATTRIBUTES.map((a) => (
            <div key={a.id} className={`attr-cell ${a.id === primary ? 'primary' : ''}`}>
              <span className="attr-abbr">{a.abbr}</span>
              <span className="attr-value">{attrs[a.id]}</span>
            </div>
          ))}
        </div>
        <p className="detail-sub attr-hint">
          {CLASS_DEFS[adv.className].primary.toUpperCase()} drives this {adv.className}'s
          attack — match their weapon to it.
        </p>

        <h3 className="section-title">Equipment</h3>
        <div className="rows">
          {(['weapon', 'armor', 'trinket'] as EquipSlot[]).map((slot) => {
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
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const SLOT_FALLBACK_ICON: Record<EquipSlot, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  trinket: '💍',
};

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

const LOG_ICONS: Record<LogEntry['kind'], string> = {
  quest: '📜',
  patrol: '🐾',
  injury: '🩹',
  expedition: '⚔',
};

function ActivityLog() {
  const state = useGameState();
  const entries = [...state.activityLog].reverse();

  return (
    <section className="rows">
      <h3 className="section-title">Activity Log</h3>
      {entries.length === 0 && (
        <div className="row locked">Quest and patrol reports will appear here.</div>
      )}
      <div className="activity-log">
        {entries.map((e) => (
          <div key={e.id} className={`log-entry log-${e.kind}`}>
            <span className="log-day">
              Day {Math.floor(e.at / DAY_LENGTH_SECONDS) + 1}
            </span>
            <span className="log-text">
              {LOG_ICONS[e.kind]} {e.text}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
