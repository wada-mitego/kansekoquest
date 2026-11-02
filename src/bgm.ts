// BGM: 画面ごとに1曲を対応させ、ループ再生・クロスフェード・二重再生防止・音量/ON-OFF保存を行う。
// MP3は先頭/末尾の無音（エンコーダ遅延）を検出してループ区間から外し、つなぎ目の音切れを防ぐ。
export type BgmKey = 'title' | 'job' | 'genre' | 'quiz' | 'boss' | 'last';

interface TrackDef {
  file: string;
  /** 曲ごとの基準音量（ユーザー音量に掛ける）。問題出題中は小さめにして集中を妨げない */
  gain: number;
}
const TRACKS: Record<BgmKey, TrackDef> = {
  title: { file: 'bgm_title.mp3', gain: 0.8 },
  job: { file: 'bgm_job.mp3', gain: 0.8 },
  genre: { file: 'bgm_genre.mp3', gain: 0.75 },
  quiz: { file: 'bgm_quiz.mp3', gain: 0.4 },
  boss: { file: 'bgm_boss.mp3', gain: 0.85 },
  last: { file: 'bgm_last.mp3', gain: 0.9 },
};

export interface Settings {
  bgmOn: boolean;
  /** 0〜1 */
  bgmVol: number;
  sfxOn: boolean;
}
const SKEY = 'kankouji-rpg.settings.v1';
const defaults: Settings = { bgmOn: true, bgmVol: 0.7, sfxOn: true };
let settings: Settings = { ...defaults };
try {
  const raw = localStorage.getItem(SKEY);
  if (raw) {
    const p = JSON.parse(raw) as Partial<Settings>;
    settings = {
      bgmOn: typeof p.bgmOn === 'boolean' ? p.bgmOn : defaults.bgmOn,
      bgmVol: typeof p.bgmVol === 'number' ? Math.min(1, Math.max(0, p.bgmVol)) : defaults.bgmVol,
      sfxOn: typeof p.sfxOn === 'boolean' ? p.sfxOn : defaults.sfxOn,
    };
  }
} catch {
  /* 保存不可の環境ではデフォルトで動く */
}
const save = () => {
  try {
    localStorage.setItem(SKEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
};

interface Playing {
  key: BgmKey;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

const FADE_IN = 0.8;
const FADE_OUT = 0.6;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<BgmKey, { buf: AudioBuffer; start: number; end: number }>();
const loading = new Map<BgmKey, Promise<void>>();
let current: Playing | null = null;
/** いま鳴らしたい曲（ユーザー操作前・OFF中でも覚えておき、解除/ONで再生する） */
let wanted: BgmKey | null = null;
let unlocked = false;
let token = 0;
/** 鳴っている（フェード中を含む）音源の数。通常は1、切り替え中だけ2 */
let active = 0;

function ensureCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = settings.bgmVol;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** 先頭・末尾の無音を除いたループ区間（秒）を求める */
export function trimRange(chans: Float32Array[], sampleRate: number, threshold = 0.003): { start: number; end: number } {
  const len = chans[0]?.length ?? 0;
  let first = 0;
  let last = len - 1;
  const loud = (i: number) => chans.some((c) => Math.abs(c[i]) > threshold);
  while (first < len && !loud(first)) first++;
  while (last > first && !loud(last)) last--;
  if (first >= last) return { start: 0, end: len / sampleRate };
  return { start: first / sampleRate, end: (last + 1) / sampleRate };
}

function load(key: BgmKey): Promise<void> {
  if (buffers.has(key)) return Promise.resolve();
  let p = loading.get(key);
  if (p) return p;
  const c = ensureCtx();
  if (!c) return Promise.resolve();
  p = fetch(`assets/bgm/${TRACKS[key].file}`)
    .then((r) => {
      if (!r.ok) throw new Error(`bgm ${key}: ${r.status}`);
      return r.arrayBuffer();
    })
    .then((ab) => c.decodeAudioData(ab))
    .then((buf) => {
      const chans = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
      const { start, end } = trimRange(chans, buf.sampleRate);
      buffers.set(key, { buf, start, end });
    })
    .catch((e) => {
      console.warn(e);
      loading.delete(key);
    });
  loading.set(key, p);
  return p;
}

function fadeOutAndStop(p: Playing, sec: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  p.gain.gain.cancelScheduledValues(t);
  p.gain.gain.setValueAtTime(p.gain.gain.value, t);
  p.gain.gain.linearRampToValueAtTime(0, t + sec);
  try {
    p.src.stop(t + sec + 0.05);
  } catch {
    /* 既に停止 */
  }
  p.src.onended = () => {
    active--;
    try {
      p.src.disconnect();
      p.gain.disconnect();
    } catch {
      /* ignore */
    }
  };
}

async function start(key: BgmKey) {
  const my = ++token;
  const c = ensureCtx();
  if (!c || !master) return;
  await load(key);
  const t = buffers.get(key);
  // 待っている間に別の曲へ切り替わった・OFFにされた場合は鳴らさない（二重再生防止）
  if (!t || my !== token || wanted !== key || !settings.bgmOn || !unlocked) return;
  if (current?.key === key) return;
  const old = current;
  const src = c.createBufferSource();
  src.buffer = t.buf;
  src.loop = true;
  src.loopStart = t.start;
  src.loopEnd = t.end;
  const g = c.createGain();
  const now = c.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(TRACKS[key].gain, now + FADE_IN);
  src.connect(g).connect(master);
  src.start(now, t.start);
  active++;
  current = { key, src, gain: g };
  if (old) fadeOutAndStop(old, FADE_OUT);
  // 残りの曲も先に読み込んでおく（画面遷移時の待ちを減らす）
  (Object.keys(TRACKS) as BgmKey[]).forEach((k) => void load(k));
}

function stopCurrent(sec = FADE_OUT) {
  token++;
  if (current) {
    fadeOutAndStop(current, sec);
    current = null;
  }
}

export const bgm = {
  settings: () => ({ ...settings }),
  /** その画面のBGMを指定する。同じ曲が鳴っている間は何もしない（再スタートしない） */
  play(key: BgmKey) {
    wanted = key;
    if (!settings.bgmOn || !unlocked) {
      // 解除前でも先に読み込んでおき、最初のタップですぐ鳴らす
      void load(key);
      return;
    }
    if (current?.key === key) return;
    void start(key);
  },
  /** ブラウザの自動再生制限の解除。最初のクリック・タップ・キー操作で呼ぶ */
  unlock() {
    const c = ensureCtx();
    if (!c) return;
    const go = () => {
      unlocked = true;
      if (wanted && settings.bgmOn && !current) void start(wanted);
    };
    if (c.state === 'suspended') void c.resume().then(go, go);
    else go();
  },
  setOn(on: boolean) {
    settings.bgmOn = on;
    save();
    if (!on) stopCurrent(0.3);
    else if (wanted) {
      unlocked = true;
      void ensureCtx()?.resume();
      void start(wanted);
    }
  },
  setVolume(v: number) {
    settings.bgmVol = Math.min(1, Math.max(0, v));
    save();
    if (master && ctx) master.gain.setTargetAtTime(settings.bgmVol, ctx.currentTime, 0.03);
  },
  setSfx(on: boolean) {
    settings.sfxOn = on;
    save();
  },
  /** テスト・確認用 */
  debug: () => ({ unlocked, wanted, playing: current?.key ?? null, state: ctx?.state ?? 'none', loaded: [...buffers.entries()].map(([k, v]) => ({ k, start: +v.start.toFixed(3), end: +v.end.toFixed(3), dur: +v.buf.duration.toFixed(3) })), vol: master?.gain.value ?? null, active }),
};

// タブが隠れたら止め、戻ったら再開（スマホのバックグラウンド対策）
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) void ctx.suspend();
  else if (unlocked) void ctx.resume();
});

// 最初のユーザー操作でBGMを解禁（Phaserの外のイベントも拾う）
const unlockOnce = () => {
  bgm.unlock();
  window.removeEventListener('pointerdown', unlockOnce, true);
  window.removeEventListener('keydown', unlockOnce, true);
  window.removeEventListener('touchend', unlockOnce, true);
};
window.addEventListener('pointerdown', unlockOnce, true);
window.addEventListener('keydown', unlockOnce, true);
window.addEventListener('touchend', unlockOnce, true);
