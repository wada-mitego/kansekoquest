/** PC=横長16:9(1280x720) / スマホ=縦長9:16(720x1280) を別レイアウトとして扱う */
export const L = { W: 1280, H: 720, portrait: false };

export function viewportIsPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}

export function applyOrientation(portrait: boolean): void {
  L.portrait = portrait;
  L.W = portrait ? 720 : 1280;
  L.H = portrait ? 1280 : 720;
}
