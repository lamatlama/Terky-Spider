// Snímky obrazovky do obchodů. Potřebuje běžící `npm run dev` (port v SPIDER_URL)
// a nainstalovaný Google Chrome. Výsledek: store/screenshots/<zařízení>/<jazyk>/NN-scena.png
//
//   SPIDER_URL=http://localhost:5173 npm run store:shots
//   LANGS=cs,en,de npm run store:shots        (výchozí: cs,en)
import { mkdir, rm } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const URL = process.env.SPIDER_URL || 'http://localhost:5173';
const LANGS = (process.env.LANGS || 'cs,en').split(',');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PHOTO = 'fotky-vyhra/01-terka.jpg'; // fotka pro ukázku „vlastní fotka na kartách“

// rozměry, které obchody vyžadují
const DEVICES = {
  'iphone-6.9': { viewport: { width: 440, height: 956 }, scale: 3, mobile: true }, // 1320×2868 – App Store, povinné
  'ipad-13': { viewport: { width: 1032, height: 1376 }, scale: 2, mobile: true }, // 2064×2752 – App Store, povinné (hra běží i na iPadu)
  android: { viewport: { width: 360, height: 720 }, scale: 3, mobile: true }, // 1080×2160 – Google Play
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, device, lang, extraStorage = {}) {
  const d = DEVICES[device];
  const ctx = await browser.newContext({
    viewport: d.viewport,
    deviceScaleFactor: d.scale,
    isMobile: d.mobile,
    hasTouch: true,
    locale: lang,
  });
  const storage = {
    'CapacitorStorage.settings': JSON.stringify({ suits: 2, lang }),
    'CapacitorStorage.license': JSON.stringify({ games: 0, unlocked: true }),
    ...extraStorage,
  };
  await ctx.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, storage);
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForFunction(() => window.__spider?.st);
  await wait(400);
  return { page, ctx };
}

/** Rozehraná hra, která vypadá živě: pár desítek tahů z nápovědy a jedno rozdání. */
async function midGame(page, suits, seed) {
  await page.evaluate(
    ([suits, seed]) => {
      const { E } = window.__spider;
      const st = E.newGame(suits, seed);
      let dealt = 0;
      for (let i = 0; i < 60; i++) {
        const m = E.listMoves(st)[0];
        if (m && i % 12 !== 11) E.move(st, m.from, m.idx, m.to);
        else if (dealt < 2 && E.canDeal(st)) {
          E.deal(st);
          dealt++;
        } else if (!m) break;
        E.collect(st);
      }
      st.time = 263;
      st.counted = true;
      st.hints = 2;
      window.__spider.set(st);
    },
    [suits, seed]
  );
  await wait(500);
}

async function setCardPhoto(page) {
  await page.click('#btn-new');
  await wait(300);
  // menu končí tlačítky … „Vzhled karet“, „Jazyk · …“, „Zavřít“ (texty se liší podle jazyka)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#modal-body > button')];
    btns[btns.length - 3].click();
  });
  await page.setInputFiles('input[type=file]', PHOTO);
  await page.waitForSelector('.crop-frame img');
  await wait(600);
}

async function shot(page, device, lang, name) {
  const dir = `store/screenshots/${device}/${lang}`;
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
  console.log(`${dir}/${name}.png`);
}

const browser = await chromium.launch({ executablePath: CHROME });
await rm('store/screenshots', { recursive: true, force: true });
try {
  for (const device of Object.keys(DEVICES)) {
    for (const lang of LANGS) {
      // 1) rozehraná hra
      let { page, ctx } = await newPage(browser, device, lang);
      await midGame(page, 2, 20261112);
      await shot(page, device, lang, '01-hra');

      // 2) výřez vlastní fotky, 3) hra s fotkou na kartách
      await setCardPhoto(page);
      await shot(page, device, lang, '03-vyrez-fotky');
      await page.evaluate(() => [...document.querySelectorAll('#modal-body > button')][0].click()); // Hotovo
      await wait(500);
      await page.evaluate(() => document.getElementById('modal').classList.add('hidden'));
      await midGame(page, 4, 777);
      await shot(page, device, lang, '02-vlastni-fotka');

      // 4) nastavení
      await page.click('#btn-new');
      await wait(300);
      await shot(page, device, lang, '05-nastaveni');
      await ctx.close();

      // 5) výhra
      ({ page, ctx } = await newPage(browser, device, lang));
      await page.evaluate(() => {
        const { E } = window.__spider;
        const st = E.newGame(1, 5);
        const run = (k) => Array.from({ length: 13 }, (_, j) => k * 13 + (12 - j));
        st.done = [0, 1, 2, 3, 4, 5, 6].map(run);
        st.stock = [];
        st.cols = Array.from({ length: 10 }, () => []);
        st.cols[0] = run(7).map((id) => ({ id, up: true }));
        st.moves = 131;
        st.score = 1169;
        st.time = 734;
        st.counted = true;
        window.__spider.set(st);
        // odklidit poslední řadu stejně jako po skutečném tahu
        window.__spider.E.collect(st);
      });
      // vyvolat výhru přes běžný tah: vrátíme eso a položíme ho zpět
      await page.evaluate(() => {
        const S = window.__spider;
        const st = S.st;
        const last = st.done.pop();
        st.score -= 100;
        st.cols[0] = last.slice(0, 12).map((id) => ({ id, up: true }));
        st.cols[1] = [{ id: last[12], up: true }];
        S.set(st);
      });
      await wait(300);
      const ace = page.locator(`.card[data-id="${7 * 13}"]`);
      const target = await page.evaluate(() => {
        const S = window.__spider;
        const el = document.querySelector(`.card[data-id="${S.st.cols[0].at(-1).id}"]`).getBoundingClientRect();
        return { x: el.left + el.width / 2, y: el.top + el.height * 0.6 };
      });
      const box = await ace.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + 8);
      await page.mouse.down();
      await page.mouse.move(target.x, target.y, { steps: 8 });
      await page.mouse.up();
      await wait(3200);
      await shot(page, device, lang, '04-vyhra');
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
