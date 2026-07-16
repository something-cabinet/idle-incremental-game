/** Pure game types. No React, no DOM — keep it that way. */

export interface GeneratorDef {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  /** Cost multiplier per unit owned (classic idle curve, e.g. 1.15) */
  costGrowth: number;
  /** Energy produced per second per unit */
  baseProduction: number;
}

export interface GameState {
  energy: number;
  totalEnergyEarned: number;
  /** generator id -> count owned */
  generators: Record<string, number>;
  clickPower: number;
  /** unix ms of last tick, used for offline progress */
  lastUpdate: number;
}

export interface SaveData {
  version: number;
  state: GameState;
}
