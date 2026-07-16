/**
 * Tiny WebAudio UI blips — no asset files.
 * Gated by settings.soundEnabled at call sites.
 */

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  gain = 0.04,
  when = 0,
): void {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export type UiSound = "tap" | "success" | "soft" | "error";

export function playUiSound(kind: UiSound, enabled: boolean): void {
  if (!enabled) return;
  try {
    switch (kind) {
      case "tap":
        tone(520, 0.06, "sine", 0.035);
        break;
      case "soft":
        tone(380, 0.08, "triangle", 0.03);
        break;
      case "success":
        tone(520, 0.08, "sine", 0.04);
        tone(780, 0.12, "sine", 0.035, 0.07);
        break;
      case "error":
        tone(220, 0.12, "triangle", 0.04);
        break;
      default:
        break;
    }
  } catch {
    /* ignore autoplay / audio errors */
  }
}
