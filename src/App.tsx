import { useState } from 'react';
import { GENERATORS } from './game/config';
import {
  applyOfflineProgress,
  click,
  createInitialState,
  productionPerSecond,
} from './game/logic';
import { GameStore } from './game/store';
import { formatDuration, formatNumber } from './game/format';
import { GameContext, useGameLoop, useGameState, useGameStore } from './hooks/useGame';
import { localStorageAdapter } from './platform/storage';
import { GeneratorRow } from './ui/GeneratorRow';
import './App.css';

interface OfflineReport {
  seconds: number;
  earnings: number;
}

function initGame(): { store: GameStore; offline: OfflineReport | null } {
  const saved = localStorageAdapter.load();
  if (!saved) return { store: new GameStore(createInitialState()), offline: null };
  const { state, offlineSeconds, offlineEarnings } = applyOfflineProgress(saved.state);
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

  useGameLoop(init.store);

  return (
    <GameContext.Provider value={init.store}>
      <div className="game">
        <Header />
        <ClickerPanel />
        <GeneratorList />
        {offlineReport && (
          <div className="offline-toast" onClick={() => setOfflineReport(null)}>
            Welcome back! You were away for {formatDuration(offlineReport.seconds)} and
            earned <strong>{formatNumber(offlineReport.earnings)}</strong> energy. ✕
          </div>
        )}
        <DevBar />
      </div>
    </GameContext.Provider>
  );
}

function Header() {
  const state = useGameState();
  return (
    <header className="header">
      <h1>⚡ Idle Energy</h1>
      <div className="energy-display">
        <span className="energy-amount">{formatNumber(state.energy)}</span>
        <span className="energy-label">energy</span>
      </div>
      <div className="eps">{formatNumber(productionPerSecond(state))} /sec</div>
    </header>
  );
}

function ClickerPanel() {
  const store = useGameStore();
  const state = useGameState();
  return (
    <button className="click-button" onClick={() => store.dispatch(click)}>
      Generate ⚡
      <span className="click-power">+{formatNumber(state.clickPower)} per click</span>
    </button>
  );
}

function GeneratorList() {
  return (
    <section className="generators">
      {GENERATORS.map((g) => (
        <GeneratorRow key={g.id} def={g} />
      ))}
    </section>
  );
}

function DevBar() {
  const store = useGameStore();
  return (
    <footer className="dev-bar">
      <button
        onClick={() => {
          if (confirm('Wipe your save and start over?')) {
            localStorageAdapter.clear();
            store.dispatch(() => createInitialState());
          }
        }}
      >
        Reset save
      </button>
    </footer>
  );
}
