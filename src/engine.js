// Terky Spider (Spider Solitaire) – herní logika. Žádný DOM, dá se testovat v Node.
//
// Stav hry:
//   deck   – 104 karet {s: barva 0–3, r: hodnota 1–13}, index = id karty
//   cols   – 10 sloupců, každý pole {id, up}; poslední prvek je vrchní karta
//   stock  – id karet v talonu (rozdává se od konce)
//   done   – složené řady K→A, každá jako pole 13 id (král první)

export const COLS = 10;
export const RUNS = 8;
export const RANKS = 13;
export const START_SCORE = 500;
export const RUN_BONUS = 100;
export const HINTS_PER_GAME = 3;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 32) >>> 0;
}

function buildDeck(suitCount) {
  const suits = suitCount === 4 ? [0, 1, 2, 3] : suitCount === 2 ? [0, 1] : [0];
  const deck = [];
  for (let i = 0; i < RUNS * RANKS; i++) {
    deck.push({ s: suits[Math.floor(i / RANKS) % suits.length], r: (i % RANKS) + 1 });
  }
  return deck;
}

export function newGame(suitCount = 1, seed = randomSeed()) {
  if (![1, 2, 4].includes(suitCount)) suitCount = 1;
  const rng = mulberry32(seed);
  const order = Array.from({ length: RUNS * RANKS }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const cols = [];
  let k = 0;
  for (let c = 0; c < COLS; c++) {
    const n = c < 4 ? 6 : 5;
    const col = [];
    for (let i = 0; i < n; i++) col.push({ id: order[k++], up: i === n - 1 });
    cols.push(col);
  }
  return {
    suitCount,
    seed,
    deck: buildDeck(suitCount),
    cols,
    stock: order.slice(k),
    done: [],
    moves: 0,
    score: START_SCORE,
    time: 0,
    counted: false,
    hints: HINTS_PER_GAME,
  };
}

/** Dá se zvednout řada od indexu idx po vrchní kartu? (lícem nahoru, stejná barva, sestupně) */
export function isRun(st, col, idx) {
  const cs = st.cols[col];
  if (!cs || idx < 0 || idx >= cs.length) return false;
  for (let i = idx; i < cs.length; i++) {
    if (!cs[i].up) return false;
    if (i > idx) {
      const a = st.deck[cs[i - 1].id];
      const b = st.deck[cs[i].id];
      if (a.s !== b.s || a.r !== b.r + 1) return false;
    }
  }
  return true;
}

/** Nejnižší index, od kterého jde řadu ve sloupci zvednout (-1 pro prázdný sloupec). */
export function runStart(st, col) {
  const cs = st.cols[col];
  let i = cs.length - 1;
  if (i < 0) return -1;
  while (i > 0 && isRun(st, col, i - 1)) i--;
  return i;
}

export function canDrop(st, col, idx, to) {
  if (to === col || to < 0 || to >= COLS) return false;
  if (!isRun(st, col, idx)) return false;
  const target = st.cols[to];
  if (target.length === 0) return true;
  const top = target[target.length - 1];
  return top.up && st.deck[top.id].r === st.deck[st.cols[col][idx].id].r + 1;
}

function flipTop(st, col) {
  const cs = st.cols[col];
  if (cs.length && !cs[cs.length - 1].up) cs[cs.length - 1].up = true;
}

/** Přesune řadu. Složené řady neodklízí – to dělá collect(). */
export function move(st, col, idx, to) {
  if (!canDrop(st, col, idx, to)) return false;
  st.cols[to].push(...st.cols[col].splice(idx));
  flipTop(st, col);
  st.moves++;
  st.score--;
  return true;
}

export function canDeal(st) {
  return st.stock.length > 0 && st.cols.every((c) => c.length > 0);
}

/** Rozdá po jedné kartě na každý sloupec. Vrací id rozdaných karet (nebo null). */
export function deal(st) {
  if (!canDeal(st)) return null;
  const dealt = [];
  for (let c = 0; c < COLS && st.stock.length; c++) {
    const id = st.stock.pop();
    st.cols[c].push({ id, up: true });
    dealt.push(id);
  }
  st.moves++;
  st.score--;
  return dealt;
}

function hasCompleteRun(st, col) {
  const cs = st.cols[col];
  const start = cs.length - RANKS;
  return start >= 0 && st.deck[cs[start].id].r === RANKS && isRun(st, col, start);
}

export function completeCols(st) {
  const out = [];
  for (let c = 0; c < COLS; c++) if (hasCompleteRun(st, c)) out.push(c);
  return out;
}

/** Odklidí všechny složené řady K→A. Vrací jejich počet. */
export function collect(st) {
  let n = 0;
  for (let c = 0; c < COLS; c++) {
    while (hasCompleteRun(st, c)) {
      const run = st.cols[c].splice(st.cols[c].length - RANKS);
      st.done.push(run.map((x) => x.id));
      flipTop(st, c);
      st.score += RUN_BONUS;
      n++;
    }
  }
  return n;
}

export function isWon(st) {
  return st.done.length === RUNS;
}

function runLength(st, col) {
  const start = runStart(st, col);
  return start < 0 ? 0 : st.cols[col].length - start;
}

/** Smysluplné tahy seřazené od nejlepšího – pro nápovědu a detekci „žádný tah“. */
export function listMoves(st) {
  const out = [];
  for (let c = 0; c < COLS; c++) {
    const cs = st.cols[c];
    const start = runStart(st, c);
    if (start < 0) continue;
    for (let i = start; i < cs.length; i++) {
      const card = st.deck[cs[i].id];
      const below = i > 0 ? cs[i - 1] : null;
      const belowCard = below ? st.deck[below.id] : null;
      const sitsOnParent = below && below.up && belowCard.r === card.r + 1;
      const sitsSuited = sitsOnParent && belowCard.s === card.s;
      for (let t = 0; t < COLS; t++) {
        if (!canDrop(st, c, i, t)) continue;
        const target = st.cols[t];
        let score = 0;
        if (!target.length) {
          if (i === 0) continue;
          if (sitsOnParent) continue;
          score = 5;
        } else {
          const suited = st.deck[target[target.length - 1].id].s === card.s;
          if (sitsSuited) continue; // rozbíjet hotovou řadu nemá smysl
          if (sitsOnParent && !suited) continue; // jen přehození sem a tam
          score = suited ? 40 + runLength(st, t) : 15;
        }
        if (below && !below.up) score += 30;
        if (i === 0) score += 25; // uvolní sloupec
        score += cs.length - i; // delší řada = lepší
        out.push({ from: c, idx: i, to: t, score });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

// ---- Ukládání ---------------------------------------------------------------
// Rozložení se kóduje do krátkého řetězce (1 znak na kartu), aby historie tahů
// pro „Zpět“ zabrala i po stovkách tahů jen pár desítek kB.

const enc = (n) => String.fromCharCode(48 + n);
const dec = (ch) => ch.charCodeAt(0) - 48;
const SEP = '!'; // oddělovače musí mít kód < 48, jinak by kolidovaly s kartami

export function snapshot(st) {
  const cols = st.cols.map((c) => c.map((x) => enc(x.id * 2 + (x.up ? 1 : 0))).join('')).join(',');
  const stock = st.stock.map(enc).join('');
  const done = st.done.map((r) => r.map(enc).join('')).join(',');
  return [cols, stock, done, st.moves, st.score].join(SEP);
}

export function restore(st, snap) {
  const [cols, stock, done, moves, score] = snap.split(SEP);
  st.cols = cols.split(',').map((s) =>
    [...s].map((ch) => {
      const n = dec(ch);
      return { id: n >> 1, up: (n & 1) === 1 };
    })
  );
  st.stock = [...stock].map(dec);
  st.done = done ? done.split(',').map((s) => [...s].map(dec)) : [];
  st.moves = Number(moves);
  st.score = Number(score);
  return st;
}

export function serialize(st) {
  return {
    v: 1,
    suitCount: st.suitCount,
    seed: st.seed,
    time: st.time,
    counted: st.counted,
    hints: st.hints,
    snap: snapshot(st),
  };
}

export function deserialize(data) {
  if (!data || data.v !== 1 || typeof data.snap !== 'string') return null;
  try {
    const st = newGame(data.suitCount, data.seed);
    restore(st, data.snap);
    st.time = data.time || 0;
    st.counted = !!data.counted;
    st.hints = Number.isInteger(data.hints) ? Math.min(HINTS_PER_GAME, Math.max(0, data.hints)) : HINTS_PER_GAME;
    const ids = [...st.cols.flat().map((x) => x.id), ...st.stock, ...st.done.flat()];
    if (ids.length !== RUNS * RANKS || new Set(ids).size !== ids.length) return null;
    if (st.cols.length !== COLS || ids.some((id) => !(id >= 0 && id < RUNS * RANKS))) return null;
    if (!Number.isFinite(st.moves) || !Number.isFinite(st.score)) return null;
    return st;
  } catch {
    return null; // poškozená uložená hra – začne se nová
  }
}
