import { forgeUnlocked } from '../../game/guild';
import { useGameState } from '../../hooks/useGame';
import { usePanelSection } from '../../hooks/usePanelSection';
import { AscendSection, CraftSection } from './CraftingPanel';
import { EquipmentSection, MaterialsSection } from './InventoryPanel';

type Section = 'materials' | 'equipment' | 'forge' | 'ascend';

/**
 * "Your stuff", in one tab. Inventory and Crafting used to be two top-level
 * destinations, but they're the same mental category and the player bounces
 * between them constantly — check materials, forge a thing, break down the
 * leftovers. Merging them freed a nav slot and removed a round trip.
 *
 * Forge and Ascend only appear once the forge exists, so early-game players
 * see two sections rather than four.
 */
export function ItemsPanel() {
  const state = useGameState();
  const forge = forgeUnlocked(state);
  const [section, setSection] = usePanelSection<Section>('items', 'materials');
  const active = !forge && (section === 'forge' || section === 'ascend') ? 'materials' : section;

  const tabs: { id: Section; label: string }[] = [
    { id: 'materials', label: 'Materials' },
    { id: 'equipment', label: 'Equipment' },
    ...(forge
      ? ([
          { id: 'forge', label: 'Forge' },
          { id: 'ascend', label: 'Ascend' },
        ] as const)
      : []),
  ];

  return (
    <div className="panel">
      <div className="subtab-bar">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`subtab ${active === t.id ? 'active' : ''}`}
            onClick={() => setSection(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'materials' && <MaterialsSection />}
      {active === 'equipment' && <EquipmentSection />}
      {active === 'forge' && <CraftSection />}
      {active === 'ascend' && <AscendSection />}
    </div>
  );
}
