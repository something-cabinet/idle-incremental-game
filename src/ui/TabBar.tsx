import { isPrestigeUnlocked } from '../game/prestige';
import { useGameState } from '../hooks/useGame';

export type TabId = 'main' | 'skills' | 'prestige' | 'settings';

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: 'main', label: 'Generators', icon: '⚡' },
  { id: 'skills', label: 'Perks', icon: '✦' },
  { id: 'prestige', label: 'Prestige', icon: '♻' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  const state = useGameState();
  const prestigeReady = isPrestigeUnlocked(state);
  const hasPerks = state.prestigePoints > 0 || Object.keys(state.perks).length > 0;

  return (
    <nav className="tab-bar">
      {TABS.map((tab) => {
        // Gate late-game tabs until they're relevant, so early UI stays clean.
        if (tab.id === 'prestige' && !prestigeReady) return null;
        if (tab.id === 'skills' && !prestigeReady && !hasPerks) return null;
        return (
          <button
            key={tab.id}
            className={`tab ${active === tab.id ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
