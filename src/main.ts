import Phaser from 'phaser';
import { bgm } from './bgm';
import { L, applyOrientation, viewportIsPortrait } from './layout';
import { BattleScene } from './scenes/battle';
import { GenreScene } from './scenes/genre';
import { HomeScene, RosterScene } from './scenes/home';
import { JobScene } from './scenes/job';
import { QuizScene } from './scenes/quiz';
import { ResultScene } from './scenes/result';
import { BootScene, SettingsScene, TitleScene } from './scenes/title';
import { FONT } from './ui';

async function loadFont() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load(`30px ${FONT}`, '攻撃力あア'), document.fonts.ready]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* フォールバックフォントで続行 */
  }
}

void loadFont().then(() => {
  applyOrientation(viewportIsPortrait());
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: L.W,
    height: L.H,
    backgroundColor: '#05060f',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, TitleScene, SettingsScene, JobScene, HomeScene, RosterScene, GenreScene, QuizScene, BattleScene, ResultScene],
  });

  // 縦横が切り替わったら、レイアウトを作り直して現在の画面を再表示する
  let timer: number | undefined;
  const onResize = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const p = viewportIsPortrait();
      if (p === L.portrait) return;
      applyOrientation(p);
      game.scale.setGameSize(L.W, L.H);
      const active = game.scene.getScenes(true)[0];
      if (!active || active.scene.key === 'Boot') return;
      // 戦闘・問題の途中では進行を壊さないよう、安全な画面へ戻す
      const key = active.scene.key;
      if (key === 'Battle') active.scene.start('Home');
      else if (key === 'Quiz') active.scene.start('Genre');
      else active.scene.restart();
    }, 150);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  if (location.search.includes('debug')) {
    (window as unknown as { __game: Phaser.Game; __bgm: typeof bgm }).__game = game;
    (window as unknown as { __bgm: typeof bgm }).__bgm = bgm;
  }
});
