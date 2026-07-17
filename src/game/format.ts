import type { NumberFormat } from './types';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** Format a number the idle-game way: 1.23K, 45.6M, ... or scientific. */
export function formatNumber(value: number, format: NumberFormat = 'short'): string {
  if (!Number.isFinite(value)) return '∞';
  if (value < 0) return '-' + formatNumber(-value, format);
  if (value < 1000) {
    return value < 100 && !Number.isInteger(value)
      ? value.toFixed(1)
      : Math.floor(value).toString();
  }
  if (format === 'scientific') {
    return value.toExponential(2).replace('e+', 'e');
  }
  const tier = Math.min(Math.floor(Math.log10(value) / 3), SUFFIXES.length - 1);
  const scaled = value / Math.pow(10, tier * 3);
  return scaled.toFixed(scaled < 100 ? 2 : 1) + SUFFIXES[tier];
}

export function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
