# Terky Spider – co kam vyplnit v obchodech

Všechny podklady jsou v této složce `store/`:

| Co | Soubor |
| --- | --- |
| Texty (název, popis, klíčová slova…) v 10 jazycích | `texty-do-obchodu.md` |
| Zásady ochrany soukromí (webová stránka) | `privacy/index.html` |
| Snímky iPhone 6,9" (1320×2868) | `screenshots/iphone-6.9/cs` a `/en` |
| Snímky iPad 13" (2064×2752) | `screenshots/ipad-13/cs` a `/en` |
| Snímky Android (1080×2160) | `screenshots/android/cs` a `/en` |
| Google Play ikona 512×512 | `graphics/google-play-ikona-512.png` |
| Google Play banner 1024×500 | `graphics/google-play-banner-cs.png` / `-en.png` |

Snímky nahrávej v pořadí podle čísla v názvu (01 → 05). Pro ostatní jazyky
obchody použijí snímky hlavního jazyka. Další jazyky: `LANGS=de,fr npm run store:shots`
(potřebuje běžící `npm run dev`; adresu dej do `SPIDER_URL`).

## Než začneš

1. **Zásady ochrany soukromí musí být na veřejné adrese.** V `privacy/index.html`
   doplň `[JMÉNO VÝVOJÁŘE]` a `[KONTAKTNÍ E-MAIL]` (česky i anglicky) a stránku
   zveřejni – např. zdarma přes GitHub Pages, Google Sites nebo na vlastním webu.
   Adresu pak vložíš do obou obchodů.
2. **Podpůrná adresa (Support URL)** – Apple ji vyžaduje. Stačí stejná stránka
   nebo jakákoli stránka s kontaktem.

## App Store Connect

**App Information**
- Name: `Terky Spider`, Subtitle: z `texty-do-obchodu.md`
- Category: **Games**, podkategorie **Card**; druhá: **Puzzle** (nepovinné)
- Content Rights: „Does not contain third-party content“
- Age Rating – dotazník: na všechno **None / No** (žádné hazardní hry o peníze
  ani simulované sázení – pasiáns se nesází) → vyjde **4+**

**Pricing and Availability**: aplikace **Free** (platí se až nákup v aplikaci).

**App Privacy** → Data Collection: **„No, we do not collect data from this app“**.
Privacy Policy URL: adresa zveřejněné stránky.

**In-App Purchases** (až bude aktivní smlouva Paid Apps)
- Type: **Non-Consumable**
- Reference Name: `Plná verze`
- Product ID: `cz.terkyspider.app.full`
- Price: nejbližší hladina k 250 Kč
- Localization (cs): Display Name `Plná verze`, Description `Neomezené hraní navždy`
  (en: `Full version`, `Unlimited play forever`)
- Review screenshot: `screenshots/iphone-6.9/cs/05-nastaveni.png` nebo snímek obrazovky s nabídkou
- Při odeslání první verze ke schválení nákup u verze zaškrtni.

**Verze 1.0**: snímky, Promotional Text, Description, Keywords, Support URL
z `texty-do-obchodu.md`. Build nahraješ z Xcode (Product → Archive → Distribute App).

**App Review Information → Notes** (pro kontrolora, anglicky):

```
The first 3 games are free (a game counts after its first move). On the first
move of the 4th game the app offers a one-time unlock (non-consumable
cz.terkyspider.app.full) with Restore Purchase. No account, no ads, no data
collection. Optional features: own photo on cards (photo picker), sharing a
.spidercards file that opens in the app and sets the same cards.
```

## Google Play Console

**Vytvořit aplikaci**: název `Terky Spider`, výchozí jazyk čeština, **Hra**, **Zdarma**.

**Hlavní záznam v obchodě**: název, krátký a úplný popis z `texty-do-obchodu.md`,
ikona 512, banner (Feature graphic), snímky telefonu. Snímky tabletu nejsou povinné
(můžeš použít ty z iPadu). Překlady: Spravovat překlady → přidat jazyk.

**Obsah aplikace** (povinné dotazníky):
- Zásady ochrany soukromí: adresa stránky
- Reklamy: **Ne, aplikace neobsahuje reklamy**
- Přístup k aplikaci: **Všechny funkce jsou dostupné bez omezení** (bez přihlášení)
- Hodnocení obsahu: kategorie **Hra** → na všechno **Ne** (žádné násilí, hazard o
  peníze ani simulovaný hazard; „Lze nakupovat digitální zboží“ = **Ano**)
- Cílové publikum: **13+** (s dětmi pod 13 by platila přísnější pravidla programu
  pro rodiny; hra je vhodná pro všechny, ale cílí na dospělé)
- Bezpečnost dat: **Aplikace neshromažďuje ani nesdílí žádná uživatelská data**
- Vládní aplikace / finanční funkce / zdraví / zpravodajství: **Ne**

**Kategorie**: Hry → **Karetní**.

**Produkt v aplikaci** (až po nahrání prvního buildu): Monetizace → Produkty →
Produkty v aplikaci → ID `cz.terkyspider.app.full`, název `Plná verze`, cena 250 Kč.

**Testování**: nový osobní účet musí mít **uzavřený test s alespoň 12 testery po 14 dní**,
teprve pak jde požádat o vydání do produkce.
