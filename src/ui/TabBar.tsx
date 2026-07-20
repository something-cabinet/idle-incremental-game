import { forgeUnlocked } from '../game/guild';
import { isTimeTravelUnlocked } from '../game/prestige';
import { useGameState } from '../hooks/useGame';

export type TabId = 'town' | 'guild' | 'map' | 'inventory' | 'crafting' | 'timeline' | 'settings';

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: 'town', label: 'Town', icon: '🏘' },
  { id: 'guild', label: 'Guild', icon: '🛡' },
  { id: 'map', label: 'Map', icon: '🗺' },
  { id: 'inventory', label: 'Inventory', icon: '🎒' },
  { id: 'crafting', label: 'Crafting', icon: '🔨' },
  { id: 'timeline', label: 'Timeline', icon: '⏳' },
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

  return (
    <nav className="tab-bar">
      {TABS.map((tab) => {
        // Tabs reveal as the acts unfold; locked tabs keep their slot so the
        // bar doesn't reflow when they appear.
        const locked =
          (state.act < 2 && ['guild', 'map', 'inventory'].includes(tab.id)) ||
          (tab.id === 'crafting' && !forgeUnlocked(state)) ||
          (tab.id === 'timeline' && !isTimeTravelUnlocked(state));
        return (
          <button
            key={tab.id}
            className={`tab ${active === tab.id ? 'active' : ''} ${locked ? 'tab-locked' : ''}`}
            aria-hidden={locked}
            tabIndex={locked ? -1 : undefined}
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
