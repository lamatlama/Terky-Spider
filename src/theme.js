// Vlastní fotka na kartách. Ukládá se jen v telefonu (nikam se neodesílá):
//   src  – původní fotka (zmenšená), aby šel výřez kdykoli upravit
//   crop – výřez {z, cx, cy}, viz crop.js
//   img  – hotový výřez ve formátu karty, ten se zobrazuje i posílá
// Zobrazení řeší CSS přes proměnnou --photo a třídy photo-face / photo-back na <body>.
//
// Posílání kamarádovi: soubor *.spidercards (JSON s výřezem). Když ho kamarád
// otevře, telefon nabídne tuhle hru a karty se nastaví samy (viz openCardsUrl).
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { load, save } from './storage.js';
import { CARD_W, CARD_H, DEFAULT_CROP, clampCrop, placement } from './crop.js';

export const CARDS_EXT = '.spidercards';
const CARDS_APP = 'spider-solitaire-cards';
const SOURCE_MAX = 1600; // delší strana uložené původní fotky
const WHERE = ['both', 'face', 'back'];

let theme = { src: null, crop: { ...DEFAULT_CROP }, img: null, where: 'both' };
let blobUrl = null;

export const getTheme = () => theme;

const isJpegData = (s) => typeof s === 'string' && s.startsWith('data:image/jpeg;base64,');

function toBlob(dataUrl) {
  const bytes = atob(dataUrl.split(',')[1]);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: 'image/jpeg' });
}

function apply() {
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = null;
  const root = document.documentElement;
  if (theme.img) {
    blobUrl = URL.createObjectURL(toBlob(theme.img));
    root.style.setProperty('--photo', `url("${blobUrl}")`);
  } else {
    root.style.removeProperty('--photo');
  }
  document.body.classList.toggle('photo-face', !!theme.img && theme.where !== 'back');
  document.body.classList.toggle('photo-back', !!theme.img && theme.where !== 'face');
}

function persist() {
  save('theme', theme);
  apply();
}

export async function initTheme() {
  const saved = await load('theme');
  if (saved && isJpegData(saved.img)) {
    theme = {
      img: saved.img,
      src: isJpegData(saved.src) ? saved.src : saved.img, // starší uložení mělo jen img
      crop: saved.crop && isJpegData(saved.src) ? saved.crop : { ...DEFAULT_CROP },
      where: WHERE.includes(saved.where) ? saved.where : 'both',
    };
  }
  apply();
}

async function decode(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/** Načte fotku ze souboru a zmenší ji. Vrací data URL; nic neukládá. */
export async function loadSource(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await decode(url);
    const s = Math.min(1, SOURCE_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * s);
    canvas.height = Math.round(img.naturalHeight * s);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Uloží fotku s daným výřezem a vyrobí z ní obrázek karty. */
export async function setPhoto(src, crop) {
  const img = await decode(src);
  const c = clampCrop(crop, img.naturalWidth, img.naturalHeight);
  const p = placement(c, img.naturalWidth, img.naturalHeight, CARD_W, CARD_H);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  canvas.getContext('2d').drawImage(img, p.x, p.y, p.w, p.h);
  theme = { ...theme, src, crop: c, img: canvas.toDataURL('image/jpeg', 0.82) };
  persist();
}

export function setWhere(where) {
  theme.where = WHERE.includes(where) ? where : 'both';
  persist();
}

export function removePhoto() {
  theme = { ...theme, src: null, img: null, crop: { ...DEFAULT_CROP } };
  persist();
}

// ---- Posílání a přijímání karet ----------------------------------------------

/** Obsah souboru .spidercards. Posílá se jen hotový výřez, ne celá fotka. */
export function exportCards() {
  return JSON.stringify({ app: CARDS_APP, v: 1, img: theme.img, where: theme.where });
}

/** Nastaví karty z obsahu souboru .spidercards. Vrací true, když se povedlo. */
export function importCards(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return false;
  }
  if (!data || data.app !== CARDS_APP || !isJpegData(data.img) || data.img.length > 3_000_000) return false;
  theme = {
    src: data.img,
    crop: { ...DEFAULT_CROP },
    img: data.img,
    where: WHERE.includes(data.where) ? data.where : 'both',
  };
  persist();
  return true;
}

/** Přečte soubor, kterým byla aplikace otevřena (file:// na iOS, content:// na Androidu). */
export async function openCardsUrl(url) {
  try {
    const res = await fetch(Capacitor.convertFileSrc(url));
    if (res.ok && importCards(await res.text())) return true;
  } catch {
    // zkusit ještě přes Filesystem
  }
  try {
    const { data } = await Filesystem.readFile({ path: url, encoding: Encoding.UTF8 });
    return importCards(typeof data === 'string' ? data : await data.text());
  } catch {
    return false;
  }
}

/** Pošle karty přes systémové sdílení: soubor ke hře + obrázek pro náhled ve zprávě. */
export async function shareCards(text) {
  if (!theme.img) return;
  const cardsName = 'moje-karty' + CARDS_EXT;
  const imageName = 'spider-karty.jpg';
  try {
    if (Capacitor.isNativePlatform()) {
      const cards = await Filesystem.writeFile({
        path: cardsName,
        data: exportCards(),
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      const image = await Filesystem.writeFile({
        path: imageName,
        data: theme.img.split(',')[1],
        directory: Directory.Cache,
      });
      await Share.share({ text, files: [cards.uri, image.uri] });
      return;
    }
    const files = [
      new File([exportCards()], cardsName, { type: 'application/octet-stream' }),
      new File([toBlob(theme.img)], imageName, { type: 'image/jpeg' }),
    ];
    if (navigator.canShare?.({ files })) {
      await navigator.share({ text, files });
    } else {
      // prohlížeč bez sdílení souborů: aspoň soubor stáhnout
      const a = document.createElement('a');
      a.href = URL.createObjectURL(files[0]);
      a.download = cardsName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  } catch {
    // uživatel sdílení zavřel – nic se neděje
  }
}
