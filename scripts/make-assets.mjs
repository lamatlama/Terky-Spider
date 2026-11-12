// Vyrobí dočasnou ikonu a úvodní obrazovku do složky assets/.
// Až bude vlastní grafika: nahraď PNG v assets/ (stejné názvy a rozměry)
// a spusť `npm run assets` – do iOS i Android projektu se vygenerují všechny velikosti.
import sharp from 'sharp';

const SPADE =
  'M50 5C50 5 10 40 10 62c0 16 12 26 24 26 7 0 12-3 14-8-1 10-6 16-12 18h28c-6-2-11-8-12-18 2 5 7 8 14 8 12 0 24-10 24-26C90 40 50 5 50 5z';

const cards = `
  <g transform="rotate(-12 512 560)">
    <rect x="300" y="250" width="400" height="560" rx="44" fill="#2c64c4" stroke="#fff" stroke-width="22"/>
  </g>
  <g transform="rotate(8 512 560)">
    <rect x="330" y="240" width="400" height="560" rx="44" fill="#fdfdf8"/>
    <g transform="translate(390 370) scale(2.8)"><path d="${SPADE}" fill="#1b1b1b"/></g>
  </g>`;

const bg = `<defs><radialGradient id="g" cx="50%" cy="40%" r="75%">
  <stop offset="0" stop-color="#17834a"/><stop offset="1" stop-color="#0b552e"/></radialGradient></defs>`;

const svg = (size, body, viewBox = '0 0 1024 1024') =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">${body}</svg>`);

const full = `${bg}<rect width="1024" height="1024" fill="url(#g)"/>`;

await sharp(svg(1024, full + cards)).png().toFile('assets/icon-only.png');
await sharp(svg(1024, full)).png().toFile('assets/icon-background.png');
// Android adaptivní ikona: motiv musí být ve středních ~66 %
await sharp(svg(1024, `<g transform="translate(512 512) scale(0.62) translate(-512 -530)">${cards}</g>`))
  .png()
  .toFile('assets/icon-foreground.png');
// úvodní obrazovka: motiv uprostřed, zbytek se na různých displejích ořízne
const splash = svg(2732, `${full}<g transform="translate(512 512) scale(0.4) translate(-512 -530)">${cards}</g>`);
await sharp(splash).png().toFile('assets/splash.png');
await sharp(splash).png().toFile('assets/splash-dark.png');
console.log('assets/ hotovo');
