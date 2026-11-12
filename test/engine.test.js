import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';

const allIds = (st) => [...st.cols.flat().map((x) => x.id), ...st.stock, ...st.done.flat()];

test('rozdání: 54 karet na stole, 50 v talonu, vrchní lícem nahoru', () => {
  for (const suits of [1, 2, 4]) {
    const st = E.newGame(suits, 42);
    assert.deepEqual(st.cols.map((c) => c.length), [6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    assert.equal(st.stock.length, 50);
    assert.equal(new Set(allIds(st)).size, 104);
    for (const c of st.cols) c.forEach((x, i) => assert.equal(x.up, i === c.length - 1));
    const perSuit = [0, 0, 0, 0];
    st.deck.forEach((d) => perSuit[d.s]++);
    assert.deepEqual(perSuit.filter(Boolean), Array(suits).fill(104 / suits));
  }
});

test('stejný seed dá stejné rozdání', () => {
  assert.equal(E.snapshot(E.newGame(2, 7)), E.snapshot(E.newGame(2, 7)));
  assert.notEqual(E.snapshot(E.newGame(2, 7)), E.snapshot(E.newGame(2, 8)));
});

// Postaví stav ručně: sloupce jako pole [barva, hodnota, lícem nahoru?]
function build(cols, suitCount = 4) {
  const st = E.newGame(suitCount, 1);
  const free = st.deck.map((_, i) => i);
  const take = (s, r) => {
    const k = free.findIndex((id) => st.deck[id].s === s && st.deck[id].r === r);
    assert.ok(k >= 0, `karta ${s}/${r} došla`);
    return free.splice(k, 1)[0];
  };
  st.cols = Array.from({ length: 10 }, (_, c) => (cols[c] || []).map(([s, r, up = true]) => ({ id: take(s, r), up })));
  st.stock = free;
  st.done = [];
  return st;
}

test('pokládat lze na kartu o 1 vyšší bez ohledu na barvu, zvednout jen řadu jedné barvy', () => {
  const st = build([[[0, 9], [0, 8], [1, 7]], [[2, 8]], [[3, 10]], []]);
  assert.equal(E.isRun(st, 0, 2), true);
  assert.equal(E.isRun(st, 0, 1), false); // 8♠ + 7♥ není řada jedné barvy
  assert.equal(E.runStart(st, 0), 2);
  assert.equal(E.canDrop(st, 0, 2, 1), true); // 7 na 8
  assert.equal(E.canDrop(st, 0, 2, 2), false); // 7 na 10
  assert.equal(E.canDrop(st, 0, 2, 3), true); // prázdný sloupec
  assert.equal(E.canDrop(st, 0, 2, 0), false);
  assert.equal(E.move(st, 0, 1, 2), false);
  assert.equal(E.move(st, 0, 2, 1), true);
  assert.equal(st.cols[1].length, 2);
  assert.equal(E.isRun(st, 0, 0), true); // 9♠ 8♠ teď jde zvednout celé
  assert.equal(E.move(st, 0, 0, 2), true);
  assert.equal(st.moves, 2);
  assert.equal(st.score, 498);
});

test('po odebrání se otočí karta pod tím', () => {
  const st = build([[[0, 5, false], [0, 3]], [[1, 4]]]);
  E.move(st, 0, 1, 1);
  assert.equal(st.cols[0][0].up, true);
});

test('rozdat nejde s prázdným sloupcem', () => {
  const st = E.newGame(1, 3);
  assert.equal(E.canDeal(st), true);
  const dealt = E.deal(st);
  assert.equal(dealt.length, 10);
  assert.equal(st.stock.length, 40);
  assert.ok(st.cols.every((c) => c[c.length - 1].up));
  st.stock.push(...st.cols[0].splice(0).map((x) => x.id));
  assert.equal(E.canDeal(st), false);
  assert.equal(E.deal(st), null);
});

test('složená řada K→A se odklidí a přičte 100', () => {
  const run = [];
  for (let r = 13; r >= 2; r--) run.push([0, r]);
  const st = build([[[1, 9, false], ...run], [[0, 1]]]);
  assert.deepEqual(E.completeCols(st), []);
  E.move(st, 1, 0, 0);
  assert.deepEqual(E.completeCols(st), [0]);
  assert.equal(E.collect(st), 1);
  assert.equal(st.done.length, 1);
  assert.equal(st.deck[st.done[0][0]].r, 13);
  assert.equal(st.cols[0].length, 1);
  assert.equal(st.cols[0][0].up, true);
  assert.equal(st.score, 500 - 1 + 100);
  assert.equal(new Set(allIds(st)).size, 104);
});

test('řada smíšených barev se neodklidí', () => {
  const run = [];
  for (let r = 13; r >= 1; r--) run.push([r === 6 ? 1 : 0, r]);
  const st = build([run]);
  assert.equal(E.collect(st), 0);
});

test('výhra po 8 řadách', () => {
  const cols = [];
  for (let k = 0; k < 8; k++) {
    const run = [];
    for (let r = 13; r >= 1; r--) run.push([0, r]);
    cols.push(run);
  }
  const st = build(cols, 1);
  assert.equal(E.isWon(st), false);
  assert.equal(E.collect(st), 8);
  assert.equal(E.isWon(st), true);
});

test('nápovědy: 3 na hru, uloží se, Zpět je nevrací', () => {
  const st = E.newGame(1, 4);
  assert.equal(st.hints, 3);
  const snap = E.snapshot(st);
  st.hints = 1;
  E.restore(st, snap);
  assert.equal(st.hints, 1);
  assert.equal(E.deserialize(JSON.parse(JSON.stringify(E.serialize(st)))).hints, 1);
  const old = E.serialize(st);
  delete old.hints;
  assert.equal(E.deserialize(old).hints, 3);
});

test('snapshot/restore a serialize/deserialize jsou bezeztrátové', () => {
  const st = E.newGame(4, 99);
  const before = E.snapshot(st);
  E.deal(st);
  const m = E.listMoves(st)[0];
  if (m) E.move(st, m.from, m.idx, m.to);
  const mid = E.snapshot(st);
  const copy = E.deserialize(JSON.parse(JSON.stringify(E.serialize(st))));
  assert.equal(E.snapshot(copy), mid);
  assert.deepEqual(copy.deck, st.deck);
  E.restore(st, before);
  assert.equal(E.snapshot(st), before);
  assert.equal(st.stock.length, 50);
  assert.equal(E.deserialize({ v: 1, suitCount: 1, seed: 1, snap: 'nesmysl' }), null);
});

test('náhodné hraní: nápověda dává jen platné tahy a karty se neztrácí', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const st = E.newGame([1, 2, 4][seed % 3], seed);
    const rng = E.mulberry32(seed);
    for (let step = 0; step < 400 && !E.isWon(st); step++) {
      const moves = E.listMoves(st);
      if (moves.length) {
        const m = moves[Math.floor(rng() * Math.min(3, moves.length))];
        const snap = E.snapshot(st);
        assert.equal(E.canDrop(st, m.from, m.idx, m.to), true);
        assert.equal(E.move(st, m.from, m.idx, m.to), true);
        const after = E.snapshot(st);
        assert.equal(E.snapshot(E.restore(E.newGame(st.suitCount, seed), after)), after);
        assert.notEqual(snap, after);
      } else if (E.canDeal(st)) {
        E.deal(st);
      } else break;
      E.collect(st);
      const ids = allIds(st);
      assert.equal(ids.length, 104);
      assert.equal(new Set(ids).size, 104);
      for (const c of st.cols) if (c.length) assert.equal(c[c.length - 1].up, true);
    }
  }
});
