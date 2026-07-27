import { useGameState } from '../hooks/useGame';
import { Icon, type IconName } from './icons';

export type TabId = 'overview' | 'town' | 'guild' | 'map' | 'items';

interface TabDef {
  id: TabId;
  label: string;
  icon: IconName;
}

/**
 * Five destinations, down from eight. Inventory and Crafting merged into
 * "Items" (they're the same mental category — your stuff), Settings moved to a
 * header button, and Timeline became an Overview section. Eight tabs forced
 * 10px labels and put eight top-level choices in front of the player at once;
 * five leaves room for legible text and a proper thumb target each.
 */
const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: 'chart' },
  { id: 'town', label: 'Town', icon: 'home' },
  { id: 'guild', label: 'Guild', icon: 'banner' },
  { id: 'map', label: 'Map', icon: 'map' },
  { id: 'items', label: 'Items', icon: 'pack' },
];

export function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  const state = useGameState();

  // Tabs reveal as the acts unfold. They're dropped rather than hidden-in-place:
  // holding the slot avoided a one-time reflow, but with five tabs instead of
  // eight it left most of the bar as empty gaps through the whole of Act 1.
  const visible = TABS.filter(
    (tab) => state.act >= 2 || !['guild', 'map', 'items'].includes(tab.id),
  );

  return (
    <nav className="tab-bar">
      {visible.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span className="tab-icon">
            <Icon name={tab.icon} />
          </span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
