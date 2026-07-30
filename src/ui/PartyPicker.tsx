import { adventurerStatsIn, isInjured } from '../game/adventurers';
import type { Adventurer } from '../game/types';
import { useGameState } from '../hooks/useGame';
import { CLASS_LABEL } from './display';

/**
 * One selectable champion in a "pick your party" list. Shared by every place
 * that sends a party out — Explore, dungeon runs and Act 3 campaign marches —
 * so the roster reads identically wherever you're choosing from it.
 */
export function ExplorePartyRow({
  adv,
  selected,
  disabled,
  onToggle,
}: {
  adv: Adventurer;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const state = useGameState();
  const stats = adventurerStatsIn(state, adv);
  const injured = isInjured(adv, state.runTimeSeconds);
  const unavailableReason = injured ? 'Injured — recovering' : adv.assignment ? 'Busy' : null;
  return (
    <label
      className={`row quest-checklist-row ${disabled ? 'disabled' : ''}`}
      htmlFor={`party-check-${adv.id}`}
    >
      <input
        id={`party-check-${adv.id}`}
        type="checkbox"
        checked={selected}
        disabled={disabled}
        onChange={() => !disabled && onToggle()}
      />
      <div className="row-info">
        <span className="row-name">{adv.name}</span>
        <span className="row-desc">
          {CLASS_LABEL[adv.className]} · Lv {adv.level} · ATK {stats.atk} · DEF {stats.def} · HP{' '}
          {stats.maxHp}
        </span>
        {unavailableReason && <span className="row-bad">{unavailableReason}</span>}
      </div>
    </label>
  );
}
