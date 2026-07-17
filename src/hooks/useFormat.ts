import { useCallback } from 'react';
import { formatNumber } from '../game/format';
import { useGameState } from './useGame';

/** Returns a formatter bound to the player's current number-format setting. */
export function useFormat(): (value: number) => string {
  const format = useGameState().settings.numberFormat;
  return useCallback((value: number) => formatNumber(value, format), [format]);
}
