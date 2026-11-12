// Připraví fotky z fotky-vyhra/ pro hru: ořízne na čtverec, zmenší, uloží do
// src/assets/vyhra/ (generovaná složka, needitovat). Spouští se samo před
// `npm run dev` a `npm run build`.
//
// Výřez jde u každé fotky doladit ve fotky-vyhra/vyrez.json:
//   "nazev.jpg": { "x": 50, "y": 30, "zoom": 1.2 }
//   x, y – kde je čtverec (0 = vlevo/nahoře, 50 = uprostřed, 100 = vpravo/dole)
//   zoom – 1 = co největší čtverec, víc = přiblížení
// Fotka, která v souboru není, se ořízne automaticky (podle obličeje).
import { readdir, rm, mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const SRC = 'fotky-vyhra';
const OUT = 'src/assets/vyhra';
const SIZE = 600;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const files = (await readdir(SRC).catch(() => []))
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith('.'))
  .sort((a, b) => a.localeCompare(b, 'cs', { numeric: true }));

let crops = {};
try {
  crops = JSON.parse(await readFile(`${SRC}/vyrez.json`, 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') console.warn(`fotky-vyhra: vyrez.json nejde přečíst (${e.message}) – ignoruji`);
}

const pct = (v, def = 50) => Math.min(100, Math.max(0, Number.isFinite(v) ? v : def)) / 100;

let n = 0;
for (const f of files) {
  try {
    // otočit podle EXIF, aby fotka z telefonu nebyla bokem
    const { data, info } = await sharp(`${SRC}/${f}`).rotate().toBuffer({ resolveWithObject: true });
    let img = sharp(data);
    const c = crops[f];
    if (c) {
      const side = Math.round(Math.min(info.width, info.height) / Math.max(1, Number(c.zoom) || 1));
      img = img.extract({
        left: Math.round((info.width - side) * pct(c.x)),
        top: Math.round((info.height - side) * pct(c.y)),
        width: side,
        height: side,
      }).resize(SIZE, SIZE);
    } else {
      img = img.resize({ width: SIZE, height: SIZE, fit: 'cover', position: 'attention' });
    }
    await img.jpeg({ quality: 82, mozjpeg: true }).toFile(`${OUT}/${String(++n).padStart(3, '0')}.jpg`);
  } catch (e) {
    n--;
    console.warn(`fotky-vyhra: ${f} se nepodařilo načíst (${e.message}) – přeskočeno`);
  }
}
console.log(`fotky-vyhra: připraveno ${n} ${n === 1 ? 'fotka' : n >= 2 && n <= 4 ? 'fotky' : 'fotek'}`);
