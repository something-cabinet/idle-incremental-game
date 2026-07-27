import {
  createInitialState,
  debugAddGold,
  debugAddMaterials,
  debugAddShards,
  updateSettings,
} from '../../game/logic';
import type { NumberFormat } from '../../game/types';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { localStorageAdapter } from '../../platform/storage';
import { Icon } from '../icons';

export function SettingsPanel() {
  const store = useGameStore();
  const state = useGameState();
  const { settings } = state;

  return (
    <div className="panel settings-panel">
      <Row label="Number format" hint="How big numbers are displayed.">
        <select
          value={settings.numberFormat}
          onChange={(e) =>
            store.dispatch((s) =>
              updateSettings(s, { numberFormat: e.target.value as NumberFormat }),
            )
          }
        >
          <option value="short">Short (1.2M)</option>
          <option value="scientific">Scientific (1.2e6)</option>
        </select>
      </Row>

      <Toggle
        label="Offline progress"
        hint="Earn energy while the game is closed."
        checked={settings.offlineProgress}
        onChange={(v) => store.dispatch((s) => updateSettings(s, { offlineProgress: v }))}
      />

      <Toggle
        label="Confirm before prestige"
        hint="Ask before resetting your run."
        checked={settings.confirmPrestige}
        onChange={(v) => store.dispatch((s) => updateSettings(s, { confirmPrestige: v }))}
      />

      <Toggle
        label="Reduced motion"
        hint="Minimize animations."
        checked={settings.reducedMotion}
        onChange={(v) => store.dispatch((s) => updateSettings(s, { reducedMotion: v }))}
      />

      <Toggle
        label="Sound effects"
        hint="Click and notification sounds."
        checked={settings.sfxEnabled}
        onChange={(v) => store.dispatch((s) => updateSettings(s, { sfxEnabled: v }))}
      />

      <h3 className="section-title">Debug</h3>

      <Row label="Game speed" hint="Debug: run the simulation faster.">
        <select
          value={settings.gameSpeed}
          onChange={(e) =>
            store.dispatch((s) => updateSettings(s, { gameSpeed: Number(e.target.value) }))
          }
        >
          <option value={1}>×1</option>
          <option value={2}>×2</option>
          <option value={5}>×5</option>
          <option value={10}>×10</option>
          <option value={50}>×50</option>
        </select>
      </Row>

      <Row label="Cheats" hint="Grant resources for quick testing.">
        <div className="debug-buttons">
          <button
            className="small-button"
            onClick={() => store.dispatch((s) => debugAddGold(s, 10_000))}
          >
            +10K <Icon name="coin" />
          </button>
          <button
            className="small-button"
            onClick={() => store.dispatch((s) => debugAddGold(s, 1_000_000))}
          >
            +1M <Icon name="coin" />
          </button>
          <button
            className="small-button"
            onClick={() => store.dispatch((s) => debugAddMaterials(s, 50))}
          >
            +50 materials
          </button>
          <button
            className="small-button"
            onClick={() => store.dispatch((s) => debugAddShards(s, 10))}
          >
            +10 <Icon name="hourglass" />
          </button>
        </div>
      </Row>

      <div className="settings-danger">
        <button
          className="danger-button"
          onClick={() => {
            if (confirm('Wipe your entire save and start over? This cannot be undone.')) {
              localStorageAdapter.clear();
              store.dispatch(() => createInitialState());
            }
          }}
        >
          Reset all progress
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-text">
        <span className="settings-label">{label}</span>
        {hint && <span className="settings-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Row label={label} hint={hint}>
      <button
        className={`toggle ${checked ? 'on' : ''}`}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-knob" />
      </button>
    </Row>
  );
}
