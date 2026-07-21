import { useState } from 'react';

/**
 * Module-scoped (not React-tree-scoped) store for panel subtab selection —
 * survives the panel unmounting when the player switches to a different top
 * tab and back, unlike plain useState. Resets on a full page reload, which
 * is fine: this is UI navigation state, not something that belongs in
 * GameState/saves.
 */
const store: Record<string, string> = {};

export function usePanelSection<T extends string>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>((store[key] as T | undefined) ?? initial);
  function set(next: T) {
    store[key] = next;
    setValue(next);
  }
  return [value, set];
}
