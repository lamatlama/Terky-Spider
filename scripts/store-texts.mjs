// Zkontroluje délky textů ze store/listing.mjs a vyrobí store/texty-do-obchodu.md
import { writeFile } from 'node:fs/promises';
import { LISTING, LIMITS, STORE_LOCALES } from '../store/listing.mjs';

const LABELS = {
  name: 'Název (oba obchody)',
  subtitle: 'Podtitul – jen App Store (Subtitle)',
  promo: 'Propagační text – jen App Store (Promotional Text)',
  keywords: 'Klíčová slova – jen App Store (Keywords)',
  short: 'Krátký popis – jen Google Play (Short description)',
  description: 'Popis (oba obchody)',
};
const NAMES = { cs: 'Čeština', en: 'Angličtina', sk: 'Slovenština', de: 'Němčina', fr: 'Francouzština', es: 'Španělština', it: 'Italština', pt: 'Portugalština (Brazílie)', pl: 'Polština', uk: 'Ukrajinština' };

const len = (s) => [...s].length;
let errors = 0;
let md = `# Texty do obchodů – Terky Spider

Vygenerováno ze \`store/listing.mjs\` (\`npm run store:texts\`). Tady jen kopíruj, měň v listing.mjs.

Pořadí pro App Store Connect: vyber jazyk vpravo nahoře (Localizable Information) a vlož texty.
V Google Play Console: Hlavní záznam v obchodě → Spravovat překlady → přidat jazyk.

`;
for (const [lang, t] of Object.entries(LISTING)) {
  const [apple, google] = STORE_LOCALES[lang];
  md += `\n## ${NAMES[lang]} — App Store: \`${apple}\`, Google Play: \`${google}\`\n`;
  for (const key of Object.keys(LIMITS)) {
    const n = len(t[key]);
    const over = n > LIMITS[key];
    if (over) {
      errors++;
      console.error(`✖ ${lang}.${key}: ${n} > ${LIMITS[key]}`);
    }
    md += `\n**${LABELS[key]}** — ${n}/${LIMITS[key]} znaků${over ? ' ⚠️ PŘES LIMIT' : ''}\n\n\`\`\`\n${t[key]}\n\`\`\`\n`;
  }
}
await writeFile('store/texty-do-obchodu.md', md);
console.log(errors ? `${errors} textů je přes limit` : `texty ok: ${Object.keys(LISTING).length} jazyků, vše v limitech → store/texty-do-obchodu.md`);
process.exit(errors ? 1 : 0);
