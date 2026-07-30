import { createContext, useContext } from 'react';
import type { TabId } from '../ui/TabBar';

/**
 * Exposes the top-level tab setter so child panels can navigate without prop
 * drilling. The only consumer today is OverviewPanel's milestone rows, which
 * route the player to the tab a milestone refers to.
 *
 * This is navigation, not mutation — it changes what the player sees, not what
 * the game stores. The Overview's "no actions" rule stays intact.
 */
export const NavigationContext = createContext<((tab: TabId) => void) | null>(null);

export function useNavigation(): (tab: TabId) => void {
  const navigate = useContext(NavigationContext);
  if (!navigate) throw new Error('useNavigation must be used within NavigationContext.Provider');
  return navigate;
}
