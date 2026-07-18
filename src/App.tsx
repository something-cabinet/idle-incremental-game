import { useState } from 'react';
import { applyOfflineProgress } from './game/engine';
import {
  createInitialState,
  currentDay,
  migrateSave,
  productionPerSecond,
} from './game/logic';
import { GameStore } from './game/store';
import { formatDuration } from './game/format';
import { GameContext, useGameLoop, useGameState } from './hooks/useGame';
import { useFormat } from './hooks/useFormat';
import { localStorageAdapter } from './platform/storage';
import { StoryModal } from './ui/StoryModal';
import { TabBar, type TabId } from './ui/TabBar';
import { TownPanel } from './ui/panels/TownPanel';
import { GuildPanel } from './ui/panels/GuildPanel';
import { MapPanel } from './ui/panels/MapPanel';
import { InventoryPanel } from './ui/panels/InventoryPanel';
import { TimelinePanel } from './ui/panels/TimelinePanel';
import { SettingsPanel } from './ui/panels/SettingsPanel';
import './App.css';

interface OfflineReport {
  seconds: number;
  gold: number;
  shards: number;
}

function initGame(): { store: GameStore; offline: OfflineReport | null } {
  const saved = localStorageAdapter.load();
  if (!saved) return { store: new GameStore(createInitialState()), offline: null };
  const migrated = migrateSave(saved);
  const { state, offlineSeconds, goldEarned, shardsFound } =
    applyOfflineProgress(migrated);
  return {
    store: new GameStore(state),
    offline:
      offlineSeconds > 60 && goldEarned > 0
        ? { seconds: offlineSeconds, gold: goldEarned, shards: shardsFound }
        : null,
  };
}

export default function App() {
  const [init] = useState(initGame);
  const [offlineReport, setOfflineReport] = useState(init.offline);
  const [tab, setTab] = useState<TabId>('town');

  useGameLoop(init.store);

  return (
    <GameContext.Provider value={init.store}>
      <div className="game">
        <Header />
        <TabBar active={tab} onChange={setTab} />
        <main className="panel-host">
          {tab === 'town' && <TownPanel />}
          {tab === 'guild' && <GuildPanel />}
          {tab === 'map' && <MapPanel />}
          {tab === 'inventory' && <InventoryPanel />}
          {tab === 'timeline' && <TimelinePanel />}
          {tab === 'settings' && <SettingsPanel />}
        </main>

        <StoryModal />

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
      <h1>🛡 Guild of Second Chances</h1>
      <div className="energy-display">
        <span className="energy-amount">{fmt(state.gold)}</span>
        <span className="energy-label">gold</span>
      </div>
      <div className="header-sub">
        <span className="eps">{fmt(productionPerSecond(state))} /sec</span>
        <span className="day-counter">Day {currentDay(state)}</span>
        {(state.timeShards > 0 || state.prestigeCount > 0) && (
          <span className="shard-counter">⏳ {fmt(state.timeShards)}</span>
        )}
      </div>
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
      Welcome back! While you were away ({formatDuration(report.seconds)}), the town
      earned <strong>{fmt(report.gold)}</strong> gold
      {report.shards > 0 && (
        <>
          {' '}and your adventurers found <strong>{fmt(report.shards)}</strong> time shards
        </>
      )}
      . ✕
    </div>
  );
}
