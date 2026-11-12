// Terky Spider – vykreslování a ovládání.
// Každá ze 104 karet má jeden trvalý prvek; render() jim jen nastaví pozici,
// takže přesuny animuje samo CSS (transition na transform).
import './style.css';
import * as E from './engine.js';
import { t, applyI18n, setLang, getLang, LANGS } from './i18n.js';
import { load, save } from './storage.js';
import { initNative, tick, thud, success } from './native.js';
import {
  initTheme,
  getTheme,
  loadSource,
  setPhoto,
  setWhere,
  removePhoto,
  shareCards,
  importCards,
  openCardsUrl,
  CARDS_EXT,
} from './theme.js';
import { DEFAULT_CROP, MAX_ZOOM, clampCrop, placement, panCrop } from './crop.js';
import { initPurchases, canStartGame, countGame, isUnlocked, freeGamesLeft, price, buy, restore } from './purchase.js';
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';

const AppExit = registerPlugin('AppExit'); // vlastní plugin v ios/App/App/SceneDelegate.swift

const SUITS = ['♠', '♥', '♣', '♦'].map((s) => s + '︎'); // FE0E = text, ne emoji
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const MOVE_MS = 220;
const MAX_HISTORY = 400;
// Fotky po výhře: složka fotky-vyhra/, připravené skriptem do src/assets/vyhra/
const WIN_PHOTOS = Object.entries(import.meta.glob('./assets/vyhra/*.jpg', { eager: true, query: '?url', import: 'default' }))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url);

const $ = (id) => document.getElementById(id);
const board = $('board');

let st = null; // stav hry (engine)
let history = []; // snapshoty pro Zpět
let stats = null;
let settings = {}; // { suits, lang }
let L = null; // rozměry plochy
let won = false;
let drag = null;
let collectTimer = null;
let hintIdx = 0;
let hintTimer = null;
let toastTimer = null;
const cardEls = [];
const slotEls = [];

// ---- Plocha a karty ---------------------------------------------------------

function createElements() {
  for (let c = 0; c < E.COLS; c++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    board.appendChild(slot);
    slotEls.push(slot);
  }
  for (let id = 0; id < E.RUNS * E.RANKS; id++) {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.id = id;
    el.innerHTML =
      '<div class="back"></div><div class="face"><div class="corner"><span class="rank"></span><span class="suit"></span></div><div class="pip"></div></div>';
    board.appendChild(el);
    cardEls.push(el);
  }
}

function paintCards() {
  st.deck.forEach((d, id) => {
    const el = cardEls[id];
    el.classList.toggle('red', d.s === 1 || d.s === 3);
    el.querySelector('.rank').textContent = RANKS[d.r];
    el.querySelector('.suit').textContent = SUITS[d.s];
    el.querySelector('.pip').textContent = SUITS[d.s];
  });
}

function layout() {
  const W = board.clientWidth;
  const H = board.clientHeight;
  if (!W || !H || (L && L.W === W && L.H === H)) return false;
  const pad = Math.max(4, W * 0.012);
  const gap = Math.max(2, W * 0.008);
  const cw = Math.floor(Math.min((W - 2 * pad - 9 * gap) / E.COLS, H / 6.2) * 2) / 2;
  const ch = Math.round(cw * 1.4);
  const rowY = H - pad - ch; // spodní řada: složené řady vlevo, talon vpravo
  L = { W, H, cw, ch, gap, top: pad, rowY, bottom: rowY - Math.max(gap * 2, 8), x0: (W - (E.COLS * cw + 9 * gap)) / 2 };
  board.style.setProperty('--cw', cw + 'px');
  board.style.setProperty('--ch', ch + 'px');
  slotEls.forEach((el, c) => (el.style.transform = `translate(${colX(c)}px,${L.top}px)`));
  return true;
}

const colX = (c) => L.x0 + c * (L.cw + L.gap);

/** Svislé pozice karet ve sloupci; dlouhý sloupec se stlačí, aby se vešel. */
function columnYs(cs) {
  const down = L.ch * 0.14;
  const up = L.ch * 0.32;
  let need = 0;
  for (let i = 0; i < cs.length - 1; i++) need += cs[i].up ? up : down;
  const avail = L.bottom - L.top - L.ch;
  const scale = need > avail ? avail / need : 1;
  const ys = [];
  let y = L.top;
  for (const card of cs) {
    ys.push(y);
    y += (card.up ? up : down) * scale;
  }
  return ys;
}

function render({ instant = false, delays = null, lift = null } = {}) {
  if (!st || !L) return;
  if (instant) board.classList.add('instant');

  const place = (id, x, y, z, up) => {
    const el = cardEls[id];
    const moved = el._x !== x || el._y !== y;
    const delay = delays?.get(id) ?? 0;
    el._z = z;
    if (!instant && (moved || lift?.has(el))) {
      // letící karta musí být nad ostatními, dokud nedoletí
      el.style.zIndex = 1000 + z;
      el.style.transitionDelay = delay ? delay + 'ms' : '';
      clearTimeout(el._zt);
      el._zt = setTimeout(() => {
        el._zt = null;
        el.style.zIndex = el._z;
        el.style.transitionDelay = '';
      }, MOVE_MS + delay + 30);
    } else if (!el._zt || instant) {
      el.style.zIndex = z;
    }
    el._x = x;
    el._y = y;
    el.style.transform = `translate(${x}px,${y}px)`;
    if (delay && up && !el.classList.contains('up')) {
      setTimeout(() => el.classList.add('up'), delay + MOVE_MS / 2); // otočit až za letu
    } else {
      el.classList.toggle('up', up);
    }
  };

  st.cols.forEach((cs, c) => {
    const ys = columnYs(cs);
    cs.forEach((card, i) => place(card.id, colX(c), ys[i], i + 1, card.up));
  });
  // talon: 5 hromádek po 10 kartách, vějíř doleva
  st.stock.forEach((id, i) => place(id, colX(9) - Math.floor(i / E.COLS) * L.cw * 0.22, L.rowY, i + 1, false));
  // složené řady: král navrchu
  st.done.forEach((run, k) =>
    run.forEach((id, j) => place(id, colX(0) + k * L.cw * 0.45, L.rowY, 200 + k * E.RANKS + (E.RANKS - j), true))
  );

  if (instant) {
    void board.offsetWidth; // vynutit překreslení bez animace
    board.classList.remove('instant');
  }
  updateHud();
}

function updateHud() {
  $('hud-score').textContent = st.score;
  $('hud-moves').textContent = st.moves;
  $('hud-time').textContent = fmtTime(st.time);
  $('btn-undo').disabled = !history.length || won;
  $('btn-hint').disabled = won || st.hints <= 0;
  $('hint-count').textContent = st.hints;
}

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ---- Tahy -------------------------------------------------------------------

function persist() {
  save('game', { g: E.serialize(st), h: history });
}

function pushHistory() {
  history.push(E.snapshot(st));
  if (history.length > MAX_HISTORY) history.shift();
  hintIdx = 0;
  if (!st.counted) {
    st.counted = true;
    countGame();
    stats[st.suitCount].played++;
    save('stats', stats);
  }
}

/** Před prvním tahem nové hry: je ještě hra zdarma, nebo je odemčeno? */
function mayPlay() {
  if (st.counted || canStartGame()) return true;
  openPaywall();
  return false;
}

/** Po tahu: složenou řadu odklidit až po doletu karet, ať je vidět, co se stalo. */
function afterAction(extraDelay = 0) {
  if (E.completeCols(st).length) {
    collectTimer = setTimeout(flushCollect, MOVE_MS + 80 + extraDelay);
  }
  persist();
}

function flushCollect() {
  if (collectTimer === null) return;
  clearTimeout(collectTimer);
  collectTimer = null;
  if (!E.collect(st)) return;
  success();
  render();
  persist();
  if (E.isWon(st)) onWin();
}

function doMove(col, idx, to) {
  if (!mayPlay()) return false;
  pushHistory();
  E.move(st, col, idx, to);
  tick();
  render();
  afterAction();
  return true;
}

function doDeal() {
  flushCollect();
  if (won || !st.stock.length) return;
  if (!E.canDeal(st)) {
    thud();
    toast(t('emptyCol'));
    return;
  }
  if (!mayPlay()) return;
  pushHistory();
  const dealt = E.deal(st);
  const delays = new Map(dealt.map((id, k) => [id, k * 35]));
  tick();
  render({ delays });
  afterAction(dealt.length * 35);
}

function undo() {
  flushCollect();
  if (won || !history.length) return;
  clearHint();
  E.restore(st, history.pop());
  hintIdx = 0;
  render();
  persist();
}

function shake(els) {
  thud();
  els.forEach((el) => {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 300);
  });
}

// ---- Nápověda ---------------------------------------------------------------

function clearHint() {
  clearTimeout(hintTimer);
  board.querySelectorAll('.hint,.hint-to').forEach((el) => el.classList.remove('hint', 'hint-to'));
}

/** Max. 3 nápovědy za hru; „Zpět“ je nevrací. Hláška „žádné tahy“ se nepočítá. */
function useHint() {
  st.hints--;
  updateHud();
  persist();
}

function hint() {
  flushCollect();
  clearHint();
  if (won) return;
  if (st.hints <= 0) return;
  const moves = E.listMoves(st);
  if (!moves.length) {
    if (E.canDeal(st)) {
      useHint();
      toast(t('hintDeal'));
      st.stock.slice(-E.COLS).forEach((id) => cardEls[id].classList.add('hint'));
    } else {
      toast(st.stock.length ? t('emptyCol') : t('noMoves'));
    }
  } else {
    useHint();
    const m = moves[hintIdx++ % moves.length];
    st.cols[m.from].slice(m.idx).forEach((x) => cardEls[x.id].classList.add('hint'));
    const target = st.cols[m.to];
    (target.length ? cardEls[target[target.length - 1].id] : slotEls[m.to]).classList.add('hint-to');
  }
  hintTimer = setTimeout(clearHint, 1600);
}

// ---- Dotyk / myš ------------------------------------------------------------

function locate(id) {
  for (let c = 0; c < E.COLS; c++) {
    const i = st.cols[c].findIndex((x) => x.id === id);
    if (i >= 0) return { c, i };
  }
  return null;
}

/** Sloupec pod taženou kartou, na který ji lze položit (-1 = žádný). */
function dropTarget(d) {
  const center = d.els[0]._x + d.dx + L.cw / 2;
  return Array.from({ length: E.COLS }, (_, c) => c)
    .map((c) => ({ c, dist: Math.abs(colX(c) + L.cw / 2 - center) }))
    .filter((o) => o.dist < L.cw * 0.95 && E.canDrop(st, d.c, d.i, o.c))
    .sort((a, b) => a.dist - b.dist)[0]?.c ?? -1;
}

function markTarget(col) {
  board.querySelectorAll('.target').forEach((el) => el.classList.remove('target'));
  if (col < 0) return;
  const cs = st.cols[col];
  (cs.length ? cardEls[cs[cs.length - 1].id] : slotEls[col]).classList.add('target');
}

board.addEventListener('pointerdown', (e) => {
  if (drag || won || !st || !e.isPrimary) return;
  const el = e.target.closest('.card');
  clearHint();
  if (!el) return;
  flushCollect();
  if (won) return;
  const id = Number(el.dataset.id);
  const loc = locate(id);
  if (!loc) {
    if (st.stock.includes(id)) doDeal();
    return;
  }
  if (!st.cols[loc.c][loc.i].up) return;
  const els = st.cols[loc.c].slice(loc.i).map((x) => cardEls[x.id]);
  if (!E.isRun(st, loc.c, loc.i)) {
    shake([el]);
    return;
  }
  drag = { pid: e.pointerId, c: loc.c, i: loc.i, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, els, active: false, to: -1 };
  board.setPointerCapture(e.pointerId);
});

board.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.pid) return;
  drag.dx = e.clientX - drag.sx;
  drag.dy = e.clientY - drag.sy;
  if (!drag.active) {
    if (Math.hypot(drag.dx, drag.dy) < 8) return; // do 8 px je to ťuknutí
    drag.active = true;
    drag.els.forEach((el, k) => {
      el.classList.add('dragging');
      clearTimeout(el._zt);
      el._zt = null;
      el.style.zIndex = 2000 + k;
    });
  }
  drag.els.forEach((el) => (el.style.transform = `translate(${el._x + drag.dx}px,${el._y + drag.dy}px)`));
  const to = dropTarget(drag);
  if (to !== drag.to) markTarget((drag.to = to));
});

function endDrag(e, cancelled) {
  if (!drag || e.pointerId !== drag.pid) return;
  const d = drag;
  drag = null;
  if (board.hasPointerCapture(e.pointerId)) board.releasePointerCapture(e.pointerId);
  markTarget(-1);
  if (!d.active) return; // ťuknutí bez tažení nic nedělá – cíl si hráč najde sám
  d.els.forEach((el) => el.classList.remove('dragging'));
  const to = cancelled ? -1 : dropTarget(d);
  if (to < 0 || !doMove(d.c, d.i, to)) {
    render({ lift: new Set(d.els) }); // vrátit zpět
  }
}

board.addEventListener('pointerup', (e) => endDrag(e, false));
board.addEventListener('pointercancel', (e) => endDrag(e, true));
board.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- Dialogy ----------------------------------------------------------------

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function openSheet(title, build) {
  $('modal-title').textContent = title;
  const body = $('modal-body');
  body.replaceChildren();
  build(body);
  $('modal').classList.remove('hidden');
}

function closeSheet() {
  $('modal').classList.add('hidden');
}

function button(parent, html, onClick, cls = '') {
  const b = document.createElement('button');
  b.innerHTML = html;
  if (cls) b.className = cls;
  b.addEventListener('click', onClick);
  parent.appendChild(b);
  return b;
}

const LEVELS = [
  [1, 'suits1', 'easy'],
  [2, 'suits2', 'medium'],
  [4, 'suits4', 'hard'],
];

function levelButtons(body) {
  for (const [n, label, level] of LEVELS) {
    button(body, `${t(label)} <small>· ${t(level)}</small>`, () => {
      closeSheet();
      startGame(n);
    });
  }
}

/** Tlačítko „Jazyk: …“, které otevře výběr jazyka; po výběru se vrátí přes back(). */
function langButton(body, back) {
  const name = LANGS.find(([code]) => code === getLang())?.[1] ?? '';
  button(body, `${t('language')} <small>· ${name}</small>`, () => openLanguages(back), 'secondary');
}

function openLanguages(back) {
  openSheet(t('language'), (body) => {
    const grid = document.createElement('div');
    grid.className = 'grid2';
    for (const [code, name] of LANGS) {
      button(grid, name, () => {
        setLang(code);
        settings.lang = code;
        save('settings', settings);
        back();
      }, code === getLang() ? 'active' : 'secondary');
    }
    body.appendChild(grid);
    button(body, t('back'), back, 'secondary');
  });
}

function openFirstRun() {
  openSheet(t('chooseLevel'), (body) => {
    levelButtons(body);
    langButton(body, openFirstRun);
  });
}

// ---- Vzhled karet: vlastní fotka ----------------------------------------------

const photoInput = document.createElement('input');
photoInput.type = 'file';
photoInput.accept = `image/*,${CARDS_EXT}`; // jde vybrat i soubor karet od kamaráda
photoInput.hidden = true;
document.body.appendChild(photoInput);
photoInput.addEventListener('change', async () => {
  const file = photoInput.files?.[0];
  photoInput.value = '';
  if (!file) return;
  try {
    if (file.name.toLowerCase().endsWith(CARDS_EXT)) {
      if (!importCards(await file.text())) throw new Error('bad cards file');
      toast(t('importDone'));
      openLook();
    } else {
      openCrop(await loadSource(file), DEFAULT_CROP);
    }
  } catch {
    toast(t('photoError'));
    openLook();
  }
});

/** Ruční výřez: tažení posouvá, dva prsty / kolečko / posuvník přibližují. */
function openCrop(src, startCrop) {
  openSheet(t('adjustPhoto'), (body) => {
    const frame = document.createElement('div');
    frame.className = 'crop-frame';
    const img = new Image();
    img.draggable = false;
    img.alt = '';
    frame.appendChild(img);
    const help = document.createElement('p');
    help.className = 'crop-help';
    help.textContent = t('cropHelp');
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 1;
    slider.max = MAX_ZOOM;
    slider.step = 0.01;
    slider.className = 'zoom';
    slider.setAttribute('aria-label', t('zoom'));
    body.append(frame, slider, help);

    let nw = 1;
    let nh = 1;
    let crop = { ...DEFAULT_CROP };
    let ready = false;
    const draw = () => {
      const p = placement(crop, nw, nh, frame.clientWidth, frame.clientHeight);
      img.style.width = p.w + 'px';
      img.style.height = p.h + 'px';
      img.style.transform = `translate(${p.x}px,${p.y}px)`;
      slider.value = crop.z;
    };
    /** Přiblížení se středem v bodě (fx, fy) rámečku – ten bod zůstane pod prstem. */
    const zoomAt = (base, z, fx, fy) => {
      const fw = frame.clientWidth;
      const fh = frame.clientHeight;
      const p0 = placement(base, nw, nh, fw, fh);
      const px = (fx - p0.x) / p0.w;
      const py = (fy - p0.y) / p0.h;
      const next = clampCrop({ ...base, z }, nw, nh);
      const p1 = placement(next, nw, nh, fw, fh);
      return panCrop(next, fx - (p1.x + px * p1.w), fy - (p1.y + py * p1.h), nw, nh, fw, fh);
    };

    const pts = new Map();
    let g = null; // začátek gesta
    const local = (e) => {
      const r = frame.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const restart = () => (g = { crop: { ...crop }, pts: new Map([...pts].map(([k, v]) => [k, { ...v }])) });
    frame.addEventListener('pointerdown', (e) => {
      if (!ready) return;
      pts.set(e.pointerId, local(e));
      try {
        frame.setPointerCapture(e.pointerId);
      } catch {
        // ukazatel už neexistuje – gesto pojede i bez zachycení
      }
      restart();
    });
    frame.addEventListener('pointermove', (e) => {
      if (!g || !pts.has(e.pointerId)) return;
      pts.set(e.pointerId, local(e));
      const fw = frame.clientWidth;
      const fh = frame.clientHeight;
      const ids = [...pts.keys()].filter((id) => g.pts.has(id));
      if (ids.length === 1) {
        const [id] = ids;
        crop = panCrop(g.crop, pts.get(id).x - g.pts.get(id).x, pts.get(id).y - g.pts.get(id).y, nw, nh, fw, fh);
      } else if (ids.length >= 2) {
        const [a, b] = ids;
        const d0 = Math.hypot(g.pts.get(a).x - g.pts.get(b).x, g.pts.get(a).y - g.pts.get(b).y) || 1;
        const d1 = Math.hypot(pts.get(a).x - pts.get(b).x, pts.get(a).y - pts.get(b).y);
        const m0 = { x: (g.pts.get(a).x + g.pts.get(b).x) / 2, y: (g.pts.get(a).y + g.pts.get(b).y) / 2 };
        const m1 = { x: (pts.get(a).x + pts.get(b).x) / 2, y: (pts.get(a).y + pts.get(b).y) / 2 };
        crop = zoomAt(g.crop, g.crop.z * (d1 / d0), m0.x, m0.y);
        crop = panCrop(crop, m1.x - m0.x, m1.y - m0.y, nw, nh, fw, fh);
      }
      draw();
    });
    const lift = (e) => {
      pts.delete(e.pointerId);
      if (pts.size) restart();
      else g = null;
    };
    frame.addEventListener('pointerup', lift);
    frame.addEventListener('pointercancel', lift);
    frame.addEventListener(
      'wheel',
      (e) => {
        if (!ready) return;
        e.preventDefault();
        const p = local(e);
        crop = zoomAt(crop, crop.z * Math.exp(-e.deltaY * 0.002), p.x, p.y);
        draw();
      },
      { passive: false }
    );
    slider.addEventListener('input', () => {
      if (!ready) return;
      crop = zoomAt(crop, Number(slider.value), frame.clientWidth / 2, frame.clientHeight / 2);
      draw();
    });

    button(body, t('done'), async () => {
      if (!ready) return;
      try {
        await setPhoto(src, crop);
      } catch {
        toast(t('photoError'));
      }
      openLook();
    });
    button(body, t('cancel'), openLook, 'secondary');

    img.src = src;
    img.decode().then(
      () => {
        nw = img.naturalWidth;
        nh = img.naturalHeight;
        crop = clampCrop(startCrop, nw, nh);
        ready = true;
        draw();
      },
      () => {
        toast(t('photoError'));
        openLook();
      }
    );
  });
}

function openLook() {
  const theme = getTheme();
  openSheet(t('cardLook'), (body) => {
    // náhled: jedna karta lícem, jedna rubem
    const preview = document.createElement('div');
    preview.className = 'preview';
    preview.innerHTML = `<div class="card up"><div class="face"><div class="corner"><span>K</span><span>${SUITS[0]}</span></div><div class="pip">${SUITS[0]}</div></div></div><div class="card"><div class="back"></div></div>`;
    body.appendChild(preview);
    button(body, t('pickPhoto'), () => photoInput.click());
    if (theme.img) {
      button(body, t('adjustPhoto'), () => openCrop(theme.src, theme.crop), 'secondary');
      const seg = document.createElement('div');
      seg.className = 'seg';
      for (const [where, label] of [['both', 'whereBoth'], ['face', 'whereFace'], ['back', 'whereBack']]) {
        button(seg, t(label), () => { setWhere(where); openLook(); }, theme.where === where ? 'active' : '');
      }
      body.appendChild(seg);
      button(body, t('sharePhoto'), () => shareCards(t('shareText')));
      button(body, t('removePhoto'), () => { removePhoto(); openLook(); }, 'danger');
    }
    button(body, t('back'), openMenu, 'secondary');
  });
}

/** Aplikace otevřená souborem .spidercards (z WhatsAppu, Zpráv, e-mailu…). */
async function onOpenUrl(url) {
  if (!url || /^https?:/i.test(url)) return;
  if (await openCardsUrl(url)) {
    toast(t('importDone'));
    openLook();
  } else {
    toast(t('photoError'));
  }
}

function openMenu() {
  flushCollect();
  openSheet(t('settings'), (body) => {
    const label = document.createElement('div');
    label.className = 'seg-label';
    label.textContent = t('newGame');
    body.appendChild(label);
    levelButtons(body);
    if (st.moves > 0 && !won) {
      button(body, t('replay'), () => { closeSheet(); startGame(st.suitCount, st.seed); }, 'secondary');
    }
    if (!isUnlocked()) {
      const free = document.createElement('div');
      free.className = 'free-left';
      free.textContent = t('freeLeft').replace('{n}', freeGamesLeft());
      body.appendChild(free);
      button(body, t('unlockFull'), openPaywall);
    }
    button(body, t('stats'), openStats, 'secondary');
    button(body, t('cardLook'), openLook, 'secondary');
    langButton(body, openMenu);
    button(body, t('close'), closeSheet, 'secondary');
  });
}

// ---- Plná verze ---------------------------------------------------------------

function openPaywall() {
  openSheet(t('payTitle'), (body) => {
    const text = document.createElement('p');
    text.className = 'pay-text';
    text.textContent = t('payText');
    body.appendChild(text);
    const busy = (fn) => async (e) => {
      const btns = [...body.querySelectorAll('button')];
      btns.forEach((b) => (b.disabled = true));
      try {
        await fn(e);
      } finally {
        btns.forEach((b) => (b.disabled = false));
      }
    };
    button(body, t('unlock').replace('{price}', price()), busy(async () => {
      try {
        if (await buy()) {
          closeSheet();
          success();
          toast(t('unlockedMsg'));
        }
      } catch {
        toast(t('payError'));
      }
    }));
    button(body, t('restore'), busy(async () => {
      try {
        if (await restore()) {
          closeSheet();
          toast(t('unlockedMsg'));
        } else {
          toast(t('nothingToRestore'));
        }
      } catch {
        toast(t('payError'));
      }
    }), 'secondary');
    button(body, t('notNow'), closeSheet, 'secondary');
  });
}

function openStats() {
  openSheet(t('stats'), (body) => {
    const rows = LEVELS.map(([n, label]) => {
      const s = stats[n];
      return `<tr><td>${t(label)}</td><td>${s.played}</td><td>${s.won}</td><td>${s.best ?? '–'}</td><td>${
        s.bestTime != null ? fmtTime(s.bestTime) : '–'
      }</td></tr>`;
    }).join('');
    body.innerHTML = `<table><tr><th></th><th>${t('played')}</th><th>${t('wins')}</th><th>${t('best')}</th><th>${t(
      'bestTime'
    )}</th></tr>${rows}</table>`;
    button(body, t('back'), openMenu, 'secondary');
    button(body, t('resetStats'), () => { stats = emptyStats(); save('stats', stats); openStats(); }, 'danger');
  });
}

function onWin() {
  won = true;
  const s = stats[st.suitCount];
  s.won++;
  s.best = Math.max(s.best ?? -Infinity, st.score);
  s.bestTime = Math.min(s.bestTime ?? Infinity, st.time);
  save('stats', stats);
  updateHud();
  confetti();
  setTimeout(() => {
    openSheet(t('won'), (body) => {
      let photo = '';
      if (WIN_PHOTOS.length) {
        const i = (settings.winPhoto ?? 0) % WIN_PHOTOS.length;
        settings.winPhoto = i + 1; // příště další fotka
        save('settings', settings);
        photo = `<img class="win-photo" src="${WIN_PHOTOS[i]}" alt="">`;
      }
      body.innerHTML = `${photo}<p class="win-msg">${t('proud')}</p><div class="result"><div><b>${st.score}</b>${t('score')}</div><div><b>${st.moves}</b>${t(
        'moves'
      )}</div><div><b>${fmtTime(st.time)}</b>${t('time')}</div></div>`;
      levelButtons(body);
      button(body, t('stats'), openStats, 'secondary');
      button(body, t('enough'), quit, 'secondary');
    });
  }, 900);
}

/** „Už stačilo“: zavře aplikaci. Android ji ukončí, iOS ji pošle na plochu
    (jako gesto domů) a po návratu začne nová hra. V prohlížeči, kde zavřít
    nejde, se ukáže jen rozloučení. */
let saidGoodbye = false;

async function quit() {
  saidGoodbye = true;
  const platform = Capacitor.getPlatform();
  try {
    if (platform === 'android') return await App.exitApp();
    if (platform === 'ios') {
      closeSheet();
      return await AppExit.exit();
    }
  } catch {
    // nepovedlo se – aspoň rozloučení
  }
  openSheet(t('farewell'), (body) => {
    body.innerHTML = '<div class="farewell">👋</div>';
  });
}

function confetti() {
  for (let i = 0; i < 36; i++) {
    const el = document.createElement('span');
    el.className = 'confetti';
    el.textContent = SUITS[i % 4];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.color = i % 2 ? '#ff6b6b' : '#fff';
    el.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
    el.style.animationDelay = Math.random() * 0.8 + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }
}

// ---- Start ------------------------------------------------------------------

const emptyStats = () => ({
  1: { played: 0, won: 0, best: null, bestTime: null },
  2: { played: 0, won: 0, best: null, bestTime: null },
  4: { played: 0, won: 0, best: null, bestTime: null },
});

function startGame(suitCount, seed) {
  clearTimeout(collectTimer);
  collectTimer = null;
  clearHint();
  st = E.newGame(suitCount, seed);
  history = [];
  won = false;
  hintIdx = 0;
  settings.suits = suitCount;
  save('settings', settings);
  paintCards();
  // všechny karty nejdřív do talonu, odtud se rozdají
  board.classList.add('instant');
  cardEls.forEach((el) => {
    el._x = colX(9);
    el._y = L.rowY;
    el.style.transform = `translate(${el._x}px,${el._y}px)`;
    el.classList.remove('up');
  });
  void board.offsetWidth;
  board.classList.remove('instant');
  const delays = new Map();
  st.cols.forEach((cs, c) => cs.forEach((card, i) => delays.set(card.id, (i * E.COLS + c) * 12)));
  render({ delays });
  persist();
}

async function start() {
  initNative();
  applyI18n();
  createElements();
  // plocha může mít při startu nulovou velikost (okno na pozadí) – počkat, až ji dostane
  await new Promise((resolve) => {
    const ro = new ResizeObserver(() => {
      if (board.clientWidth && board.clientHeight) {
        ro.disconnect();
        resolve();
      }
    });
    ro.observe(board);
  });
  layout();

  stats = { ...emptyStats(), ...((await load('stats')) || {}) };
  settings = (await load('settings')) || {};
  const firstRun = !settings.suits;
  if (settings.lang) setLang(settings.lang);
  await initTheme();
  await initPurchases();
  const saved = await load('game');
  const game = saved && E.deserialize(saved.g);
  if (game && !E.isWon(game)) {
    st = game;
    history = Array.isArray(saved.h) ? saved.h.filter((x) => typeof x === 'string') : [];
    E.collect(st); // kdyby se aplikace zavřela těsně před odklizením řady
    paintCards();
    if (E.isWon(st)) startGame(st.suitCount);
    else render({ instant: true });
  } else {
    startGame(settings.suits ?? 1);
    if (firstRun) openFirstRun();
  }

  $('btn-new').addEventListener('click', openMenu);
  try {
    App.addListener('appUrlOpen', ({ url }) => onOpenUrl(url));
    const launch = await App.getLaunchUrl();
    if (launch?.url) onOpenUrl(launch.url);
  } catch {
    // v prohlížeči nic
  }
  $('btn-undo').addEventListener('click', undo);
  $('btn-hint').addEventListener('click', hint);
  $('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal' && !won) closeSheet();
  });

  new ResizeObserver(() => {
    if (layout()) render({ instant: true });
  }).observe(board);

  setInterval(() => {
    if (!st || won || st.moves === 0 || document.hidden) return;
    st.time++;
    $('hud-time').textContent = fmtTime(st.time);
    if (st.time % 10 === 0) persist();
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && st && !won) persist();
    if (!document.hidden && saidGoodbye) {
      saidGoodbye = false; // návrat po „Už stačilo“ → rovnou nová hra
      closeSheet();
      startGame(st.suitCount);
    }
  });
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') undo();
  });
}

start();

// Jen při vývoji (npm run dev): přístup ke stavu hry z konzole prohlížeče.
if (import.meta.env.DEV) {
  window.__spider = {
    E,
    get st() {
      return st;
    },
    get history() {
      return history;
    },
    set(next) {
      st = next;
      history = [];
      won = false;
      paintCards();
      render({ instant: true });
    },
  };
}
