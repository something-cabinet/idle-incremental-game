import { useState } from 'react';
import { applyOfflineProgress, createInitialState, normalizeState, productionPerSecond } from './game/logic';
import { GameStore } from './game/store';
import { formatDuration } from './game/format';
import { GameContext, useGameLoop, useGameState } from './hooks/useGame';
import { useFormat } from './hooks/useFormat';
import { localStorageAdapter } from './platform/storage';
import { TabBar, type TabId } from './ui/TabBar';
import { MainPanel } from './ui/panels/MainPanel';
import { SkillsPanel } from './ui/panels/SkillsPanel';
import { PrestigePanel } from './ui/panels/PrestigePanel';
import { SettingsPanel } from './ui/panels/SettingsPanel';
import './App.css';

interface OfflineReport {
  seconds: number;
  earnings: number;
}

function initGame(): { store: GameStore; offline: OfflineReport | null } {
  const saved = localStorageAdapter.load();
  if (!saved) return { store: new GameStore(createInitialState()), offline: null };
  const normalized = normalizeState(saved.state);
  const { state, offlineSeconds, offlineEarnings } = applyOfflineProgress(normalized);
  return {
    store: new GameStore(state),
    offline:
      offlineSeconds > 60 && offlineEarnings > 0
        ? { seconds: offlineSeconds, earnings: offlineEarnings }
        : null,
  };
}

export default function App() {
  const [init] = useState(initGame);
  const [offlineReport, setOfflineReport] = useState(init.offline);
  const [tab, setTab] = useState<TabId>('main');

  useGameLoop(init.store);

  return (
    <GameContext.Provider value={init.store}>
      <div className="game">
        <Header />
        <TabBar active={tab} onChange={setTab} />
        <main className="panel-host">
          {tab === 'main' && <MainPanel />}
          {tab === 'skills' && <SkillsPanel />}
          {tab === 'prestige' && <PrestigePanel />}
          {tab === 'settings' && <SettingsPanel />}
        </main>

        {offlineReport && (
          <OfflineToast report={offlineReport} onDismiss={() => setOfflineReport(null)} />
        )}
      </div>
    </GameContext.Provider>
  );
}

function Header() {
  const state = useGameState();
  const fmt = useFormat();
  return (
    <header className="header">
      <h1>⚡ Idle Energy</h1>
      <div className="energy-display">
        <span className="energy-amount">{fmt(state.energy)}</span>
        <span className="energy-label">energy</span>
      </div>
      <div className="eps">{fmt(productionPerSecond(state))} /sec</div>
    </header>
  );
}

function OfflineToast({
  report,
  onDismiss,
}: {
  report: OfflineReport;
  onDismiss: () => void;
}) {
  const fmt = useFormat();
  return (
    <div className="offline-toast" onClick={onDismiss}>
      Welcome back! You were away for {formatDuration(report.seconds)} and earned{' '}
      <strong>{fmt(report.earnings)}</strong> energy. ✕
    </div>
  );
}
