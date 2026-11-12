import test from 'node:test';
import assert from 'node:assert/strict';
import { clampCrop, placement, panCrop, MAX_ZOOM, CARD_W, CARD_H } from '../src/crop.js';

const covers = (p, fw, fh) => p.x <= 1e-9 && p.y <= 1e-9 && p.x + p.w >= fw - 1e-9 && p.y + p.h >= fh - 1e-9;

test('výřez vždy pokryje celou kartu – široká i vysoká fotka, libovolný posun', () => {
  for (const [nw, nh] of [[1600, 900], [900, 1600], [500, 700], [3000, 200]]) {
    for (const z of [0.2, 1, 2.7, MAX_ZOOM, 99]) {
      for (const [cx, cy] of [[0, 0], [1, 1], [0.5, 0.5], [-3, 7], [NaN, undefined]]) {
        const c = clampCrop({ z, cx, cy }, nw, nh);
        assert.ok(c.z >= 1 && c.z <= MAX_ZOOM);
        assert.ok(covers(placement(c, nw, nh, CARD_W, CARD_H), CARD_W, CARD_H), JSON.stringify({ nw, nh, z, cx, cy, c }));
      }
    }
  }
});

test('posun prstem posune fotku stejným směrem, za okraj nepustí', () => {
  const nw = 1600;
  const nh = 900; // široká fotka: na šířku je kam posouvat
  const start = clampCrop({ z: 1, cx: 0.5, cy: 0.5 }, nw, nh);
  const p0 = placement(start, nw, nh, 200, 280);
  const moved = panCrop(start, 30, 0, nw, nh, 200, 280);
  assert.ok(Math.abs(placement(moved, nw, nh, 200, 280).x - (p0.x + 30)) < 1e-6);
  const far = panCrop(start, 10000, 10000, nw, nh, 200, 280);
  assert.ok(covers(placement(far, nw, nh, 200, 280), 200, 280));
  assert.equal(placement(far, nw, nh, 200, 280).x, 0);
});
