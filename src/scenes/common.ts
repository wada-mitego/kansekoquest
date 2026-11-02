import Phaser from 'phaser';
import { JOBS, JobId, STAT_COLORS, STAT_KEYS, STAT_NAMES, StatKey, Stats } from '../data';
import { bar, txt } from '../ui';

export function hero(scene: Phaser.Scene, job: JobId, x: number, yBottom: number, scale: number, bob = true) {
  const img = scene.add.image(x, yBottom, 'job_' + job).setOrigin(0.5, 1).setScale(scale);
  if (bob) scene.tweens.add({ targets: img, y: yBottom - 6, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return img;
}

export const jobName = (id: JobId) => JOBS.find((j) => j.id === id)!.name;
export const jobBest = (id: JobId): StatKey => JOBS.find((j) => j.id === id)!.best;

export const ICON: Record<StatKey, string> = {
  atk: 'ic_atk',
  def: 'ic_def',
  mag: 'ic_mag',
  mdef: 'ic_mdef',
  spd: 'ic_spd',
};

/** 5能力をアイコン付きで縦に並べる */
export function statRows(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  stats: Stats,
  best: StatKey | null,
  rowH = 46,
  size = 26,
) {
  STAT_KEYS.forEach((k, i) => {
    const yy = y + i * rowH;
    scene.add.image(x, yy + rowH / 2 - 4, ICON[k]).setOrigin(0, 0.5).setScale(Math.max(2, Math.floor(rowH / 16)));
    const nx = x + 12 * Math.max(2, Math.floor(rowH / 16)) + 12;
    txt(scene, nx, yy + 2, STAT_NAMES[k], size, '#ffffff');
    txt(scene, x + w, yy + 2, String(stats[k]), size + 4, k === best ? '#ffd83a' : '#ffffff').setOrigin(1, 0);
    bar(scene, nx, yy + rowH - 12, w - (nx - x), 7, STAT_COLORS[k]).set(Math.min(1, stats[k] / 40), false);
  });
}
