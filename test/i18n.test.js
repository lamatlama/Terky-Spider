import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = { documentElement: {}, querySelectorAll: () => [] };
const { STRINGS, LANGS, setLang, getLang, t } = await import('../src/i18n.js');

test('každý jazyk z nabídky má všechny texty', () => {
  const keys = Object.keys(STRINGS.en).sort();
  assert.deepEqual(LANGS.map(([code]) => code).sort(), Object.keys(STRINGS).sort());
  for (const [code, name] of LANGS) {
    assert.deepEqual(Object.keys(STRINGS[code]).sort(), keys, `chybí/přebývá text v ${code}`);
    for (const k of keys) assert.ok(STRINGS[code][k].trim(), `${code}.${k} je prázdné`);
    assert.ok(name);
  }
});

test('přepnutí jazyka a neznámý kód', () => {
  setLang('pl');
  assert.equal(getLang(), 'pl');
  assert.equal(t('newGame'), 'Nowa gra');
  setLang('xx');
  assert.ok(STRINGS[getLang()]);
});
