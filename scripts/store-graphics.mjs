// Grafika pro Google Play: ikona 512×512 a banner (Feature graphic) 1024×500 v češtině a angličtině.
// Výstup: store/graphics/. Až bude vlastní grafika, nahraď tyto soubory.
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const OUT = 'store/graphics';
await mkdir(OUT, { recursive: true });

await sharp('assets/icon-only.png').resize(512, 512).png().toFile(`${OUT}/google-play-ikona-512.png`);

const photo = await sharp('fotky-vyhra/01-terka.jpg')
  .rotate()
  .resize(300, 420, { fit: 'cover', position: 'attention' })
  .jpeg({ quality: 85 })
  .toBuffer();
const photoUri = `data:image/jpeg;base64,${photo.toString('base64')}`;

const SPADE =
  'M50 5C50 5 10 40 10 62c0 16 12 26 24 26 7 0 12-3 14-8-1 10-6 16-12 18h28c-6-2-11-8-12-18 2 5 7 8 14 8 12 0 24-10 24-26C90 40 50 5 50 5z';

const TEXT = {
  cs: { line1: 'Pavoukový pasiáns', line2: 's tvou fotkou na kartách' },
  en: { line1: 'Spider Solitaire', line2: 'with your own photo on the cards' },
};

const card = (x, y, rot, inner) => `
  <g transform="translate(${x} ${y}) rotate(${rot})">
    <rect x="-75" y="-105" width="150" height="210" rx="14" fill="#000" opacity=".25" transform="translate(4 6)"/>
    ${inner}
  </g>`;

const back = `<rect x="-75" y="-105" width="150" height="210" rx="14" fill="#2c64c4" stroke="#fff" stroke-width="9"/>`;
const king = `<rect x="-75" y="-105" width="150" height="210" rx="14" fill="#fdfdf8"/>
  <text x="-60" y="-70" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="36" fill="#1b1b1b">K</text>
  <g transform="translate(-40 -35) scale(.8)"><path d="${SPADE}" fill="#1b1b1b"/></g>`;
const photoCard = `<clipPath id="c"><rect x="-75" y="-105" width="150" height="210" rx="14"/></clipPath>
  <rect x="-75" y="-105" width="150" height="210" rx="14" fill="#fdfdf8"/>
  <image href="${photoUri}" x="-75" y="-50" width="150" height="155" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/>
  <text x="-60" y="-70" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="36" fill="#c62828">A</text>
  <path transform="translate(34 -95)" d="M0 9C0-1 14-3 16 7 18-3 32-1 32 9 32 19 18 25 16 31 14 25 0 19 0 9Z" fill="#c62828"/>`;

for (const [lang, t] of Object.entries(TEXT)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
    <defs><radialGradient id="g" cx="65%" cy="45%" r="80%">
      <stop offset="0" stop-color="#1c9254"/><stop offset="1" stop-color="#0b552e"/></radialGradient></defs>
    <rect width="1024" height="500" fill="url(#g)"/>
    <text x="64" y="215" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="76" fill="#fff">Terky Spider</text>
    <text x="66" y="285" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#fff" opacity=".92">${t.line1}</text>
    <text x="66" y="330" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#ffd54f">${t.line2}</text>
    ${card(690, 265, -16, back)}
    ${card(790, 245, -2, king)}
    ${card(890, 262, 13, photoCard)}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/google-play-banner-${lang}.png`);
}
console.log(`grafika hotová → ${OUT}/ (${(await readFile(`${OUT}/google-play-banner-cs.png`)).length >> 10} kB banner)`);
