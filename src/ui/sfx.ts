/**
 * Tiny synthesized sound effects via WebAudio — no asset files needed.
 * Callers check the sfxEnabled setting; this module just makes noise.
 */

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  // Browsers suspend contexts created before a user gesture.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  startIn: number,
  duration: number,
  type: OscillatorType,
  peak: number,
): void {
  const ac = audioContext();
  if (!ac) return;
  const t0 = ac.currentTime + startIn;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration);
}

/** Soft blip for button presses. */
export function playClick(): void {
  tone(660, 0, 0.06, 'triangle', 0.12);
}

/** Two-note chime for story beats and notifications. */
export function playNotify(): void {
  tone(523, 0, 0.15, 'sine', 0.18);
  tone(784, 0.12, 0.25, 'sine', 0.18);
}
