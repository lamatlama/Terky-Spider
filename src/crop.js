// Výřez fotky ve formátu karty (5 : 7). Čistá matematika bez DOM – testuje se v Node.
//
// Výřez = { z, cx, cy }:
//   z      – přiblížení, 1 = fotka právě pokryje kartu, víc = bližší
//   cx, cy – bod fotky (0–1 zleva/shora), který je uprostřed karty

export const CARD_W = 480;
export const CARD_H = 672;
export const MAX_ZOOM = 5;
export const DEFAULT_CROP = { z: 1, cx: 0.5, cy: 0.5 };

const ASPECT_W = 5;
const ASPECT_H = 7;

/** Měřítko, při kterém fotka nw×nh právě pokryje rámeček fw×fh. */
export function coverScale(nw, nh, fw, fh) {
  return Math.max(fw / nw, fh / nh);
}

function clamp(v, lo, hi) {
  if (lo > hi) return 0.5;
  return Math.min(hi, Math.max(lo, v));
}

/** Upraví výřez tak, aby fotka vždy celou kartu pokryla (žádné prázdné okraje). */
export function clampCrop(crop, nw, nh) {
  const z = clamp(Number(crop?.z) || 1, 1, MAX_ZOOM);
  const s = coverScale(nw, nh, ASPECT_W, ASPECT_H) * z;
  const hw = ASPECT_W / 2 / (nw * s); // polovina viditelné šířky, v jednotkách fotky
  const hh = ASPECT_H / 2 / (nh * s);
  const cx = clamp(Number.isFinite(crop?.cx) ? crop.cx : 0.5, hw, 1 - hw);
  const cy = clamp(Number.isFinite(crop?.cy) ? crop.cy : 0.5, hh, 1 - hh);
  return { z, cx, cy };
}

/** Kam a jak velkou fotku vykreslit do rámečku fw×fh. */
export function placement(crop, nw, nh, fw, fh) {
  const s = coverScale(nw, nh, fw, fh) * crop.z;
  const w = nw * s;
  const h = nh * s;
  return { x: fw / 2 - crop.cx * w, y: fh / 2 - crop.cy * h, w, h };
}

/** Posun výřezu o dx, dy pixelů rámečku (tažení prstem). */
export function panCrop(crop, dx, dy, nw, nh, fw, fh) {
  const p = placement(crop, nw, nh, fw, fh);
  return clampCrop({ z: crop.z, cx: crop.cx - dx / p.w, cy: crop.cy - dy / p.h }, nw, nh);
}
