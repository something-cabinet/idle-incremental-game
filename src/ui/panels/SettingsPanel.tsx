import { createInitialState, updateSettings } from '../../game/logic';
import type { NumberFormat } from '../../game/types';
import { useGameState, useGameStore } from '../../hooks/useGame';
import { localStorageAdapter } from '../../platform/storage';

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
