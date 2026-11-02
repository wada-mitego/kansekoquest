// WebAudioで鳴らす簡易効果音(音源ファイル不要)
import { bgm } from './bgm';

let ctx: AudioContext | null = null;
let muted = !bgm.settings().sfxOn;

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.08, delay = 0, slideTo?: number) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol = 0.1, delay = 0) {
  const c = ac();
  if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource();
  const g = c.createGain();
  g.gain.value = vol;
  s.buffer = buf;
  s.connect(g).connect(c.destination);
  s.start(c.currentTime + delay);
}

export const sfx = {
  setMuted(m: boolean) {
    muted = m;
    bgm.setSfx(!m);
  },
  isMuted: () => muted,
  unlock() {
    ac();
  },
  select() {
    tone(880, 0.06, 'square', 0.05);
  },
  ok() {
    tone(660, 0.07, 'square', 0.06);
    tone(990, 0.09, 'square', 0.06, 0.07);
  },
  correct() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.07, i * 0.09));
  },
  wrong() {
    tone(220, 0.25, 'sawtooth', 0.07, 0, 110);
    tone(165, 0.3, 'sawtooth', 0.07, 0.15, 80);
  },
  statUp() {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.08, 'triangle', 0.08, i * 0.05));
  },
  hit() {
    noise(0.15, 0.18);
    tone(160, 0.12, 'square', 0.1, 0, 60);
  },
  miss() {
    tone(500, 0.15, 'triangle', 0.05, 0, 900);
  },
  hurt() {
    noise(0.22, 0.2);
    tone(120, 0.2, 'sawtooth', 0.1, 0, 50);
  },
  fire() {
    noise(0.7, 0.14);
    tone(300, 0.6, 'sawtooth', 0.06, 0, 900);
  },
  boom() {
    noise(0.5, 0.25);
    tone(90, 0.45, 'square', 0.12, 0, 30);
  },
  heal() {
    [523, 659, 784, 988, 1319].forEach((f, i) => tone(f, 0.18, 'sine', 0.09, i * 0.08));
  },
  guard() {
    tone(300, 0.1, 'square', 0.07);
    tone(450, 0.12, 'square', 0.07, 0.08);
  },
  focus() {
    tone(400, 0.5, 'sine', 0.07, 0, 1200);
  },
  win() {
    [523, 523, 523, 659, 523, 659, 784].forEach((f, i) => tone(f, 0.2, 'square', 0.07, i * 0.16));
  },
  lose() {
    [392, 370, 349, 330, 262].forEach((f, i) => tone(f, 0.35, 'triangle', 0.09, i * 0.3));
  },
};
