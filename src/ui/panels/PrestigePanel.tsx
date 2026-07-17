import { PRESTIGE_UNLOCK_ENERGY } from '../../game/config';
import { canPrestige, performPrestige, prestigeGain } from '../../game/prestige';
import { useFormat } from '../../hooks/useFormat';
import { useGameState, useGameStore } from '../../hooks/useGame';

export function PrestigePanel() {
  const store = useGameStore();
  const state = useGameState();
  const fmt = useFormat();

  const gain = prestigeGain(state);
  const ready = canPrestige(state);
  const progress = Math.min(1, state.totalEnergyEarned / PRESTIGE_UNLOCK_ENERGY);

  const doPrestige = () => {
    if (!ready) return;
    if (
      state.settings.confirmPrestige &&
      !confirm(
        `Prestige now for ${fmt(gain)} prestige points? This resets your energy and generators, but keeps perks.`,
      )
    ) {
      return;
    }
    store.dispatch((s) => performPrestige(s));
  };

  return (
    <div className="panel prestige-panel">
      <div className="currency-banner">
        <span className="currency-amount">{fmt(state.prestigePoints)}</span>
        <span className="currency-label">prestige points banked</span>
      </div>

      <p className="prestige-blurb">
        Prestige resets your energy and generators, but grants permanent{' '}
        <strong>prestige points</strong> to spend on perks. Your perks and
        settings carry over.
      </p>

      <div className="prestige-gain">
        <span className="prestige-gain-value">+{fmt(gain)}</span>
        <span className="prestige-gain-label">points on prestige</span>
      </div>

      {!ready && (
        <div className="prestige-progress">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="progress-label">
            {fmt(state.totalEnergyEarned)} / {fmt(PRESTIGE_UNLOCK_ENERGY)} energy this run
          </span>
        </div>
      )}

      <button className="prestige-button" disabled={!ready} onClick={doPrestige}>
        {ready ? `Prestige for ${fmt(gain)} points` : 'Not enough energy yet'}
      </button>

      <div className="prestige-stats">
        <Stat label="Prestiges" value={state.prestigeCount.toString()} />
        <Stat label="Lifetime energy" value={fmt(state.lifetimeEnergyEarned + state.totalEnergyEarned)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
