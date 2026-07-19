import { useCallback, useEffect, useState } from 'react';
import { applyOfflineProgress } from './game/engine';
import {
  createInitialState,
  currentDay,
  migrateSave,
  productionPerSecond,
} from './game/logic';
import { GameStore } from './game/store';
import { formatDuration } from './game/format';
import { GameContext, useGameLoop, useGameState, type OfflineCatchupResult } from './hooks/useGame';
import { useFormat } from './hooks/useFormat';
import { localStorageAdapter } from './platform/storage';
import { playClick, playNotify } from './ui/sfx';
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
  materials: Record<string, number>;
  equipment: number;
}

/** Only worth surfacing as a "welcome back" toast past this length of absence. */
const OFFLINE_REPORT_THRESHOLD_SECONDS = 60;

function toOfflineReport(result: OfflineCatchupResult): OfflineReport | null {
  const { offlineSeconds, goldEarned, shardsFound, materialsGained, equipmentGained } = result;
  return offlineSeconds > OFFLINE_REPORT_THRESHOLD_SECONDS &&
    (goldEarned > 0 || Object.keys(materialsGained).length > 0 || equipmentGained > 0)
    ? { seconds: offlineSeconds, gold: goldEarned, shards: shardsFound, materials: materialsGained, equipment: equipmentGained }
    : null;
}

function initGame(): { store: GameStore; offline: OfflineReport | null } {
  const saved = localStorageAdapter.load();
  if (!saved) return { store: new GameStore(createInitialState()), offline: null };
  const migrated = migrateSave(saved);
  const result = applyOfflineProgress(migrated);
  return { store: new GameStore(result.state), offline: toOfflineReport(result) };
}

export default function App() {
  const [init] = useState(initGame);
  const [offlineReport, setOfflineReport] = useState(init.offline);
  const [tab, setTab] = useState<TabId>('town');

  // Backgrounded tabs don't remount the app, so a long absence (tab switch,
  // minimized browser, mobile suspension) needs the same "welcome back"
  // treatment at runtime that a fresh page load gets.
  const handleOfflineCatchup = useCallback((result: OfflineCatchupResult) => {
    const report = toOfflineReport(result);
    if (report) setOfflineReport(report);
  }, []);

  useGameLoop(init.store, handleOfflineCatchup);
  useClickSfx(init.store);

  return (
    <GameContext.Provider value={init.store}>
      <div className="game">
        <Header />
        <main className="panel-host">
          {tab === 'town' && <TownPanel />}
          {tab === 'guild' && <GuildPanel />}
          {tab === 'map' && <MapPanel />}
          {tab === 'inventory' && <InventoryPanel />}
          {tab === 'timeline' && <TimelinePanel />}
          {tab === 'settings' && <SettingsPanel />}
        </main>
        <TabBar active={tab} onChange={setTab} />

        <StoryModal />

        {offlineReport && (
          <OfflineToast report={offlineReport} onDismiss={() => setOfflineReport(null)} />
        )}
      </div>
    </GameContext.Provider>
  );
}

/** Plays the click blip for any button press while SFX is enabled. */
function useClickSfx(store: GameStore) {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!store.getState().settings.sfxEnabled) return;
      if ((e.target as HTMLElement | null)?.closest('button')) playClick();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [store]);
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

function materialName(id: string): string {
  const names: Record<string, string> = {
    'beast-pelt': 'Beast Pelt',
    'iron-ore': 'Iron Ore',
    'spirit-essence': 'Spirit Essence',
    'demon-ash': 'Demon Ash',
  };
  return names[id] ?? id;
}

function OfflineToast({
  report,
  onDismiss,
}: {
  report: OfflineReport;
  onDismiss: () => void;
}) {
  const state = useGameState();
  const fmt = useFormat();
  useEffect(() => {
    if (state.settings.sfxEnabled) playNotify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const materialEntries = Object.entries(report.materials);
  return (
    <div className="offline-toast" onClick={onDismiss}>
      Welcome back! While you were away ({formatDuration(report.seconds)}), the town
      earned <strong>{fmt(report.gold)}</strong> gold
      {materialEntries.length > 0 && (
        <>
          , <strong>{materialEntries.map(([id, n]) => `${n} ${materialName(id)}`).join(', ')}</strong>
        </>
      )}
      {report.equipment > 0 && (
        <>
          {' '}and <strong>{report.equipment}</strong> piece{report.equipment > 1 ? 's' : ''} of equipment
        </>
      )}
      {report.shards > 0 && (
        <>
          {' '}and <strong>{fmt(report.shards)}</strong> time shard{report.shards > 1 ? 's' : ''}
        </>
      )}
      . ✕
    </div>
  );
}
