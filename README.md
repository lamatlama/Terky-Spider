# Terky Spider

Mobilní hra Spider Solitaire pro iOS a Android, v obchodech pod názvem **Terky Spider**. Hra je napsaná jako webová
aplikace (HTML/CSS/JavaScript) a do nativní aplikace ji balí
[Capacitor](https://capacitorjs.com) – jeden kód pro oba obchody.

## Co hra umí

- 1, 2 nebo 4 barvy (lehká / střední / těžká obtížnost)
- přesun karet tažením prstem (ťuknutí nic nepřesouvá, cíl hledá hráč sám)
- rozdání z talonu, neomezené Zpět, nápověda (max. 3 za hru)
- skóre (500 − tahy + 100 za složenou řadu), počet tahů, čas
- rozehraná hra se ukládá a po spuštění pokračuje
- statistiky podle obtížnosti, „znovu stejné rozdání“
- na výšku i na šířku, telefon i tablet
- po výhře fotka s textem „Jsi borec! Terka je na tebe hrdá!“ (v ostatních
  jazycích přeloženo); fotky se střídají – stačí je přidat do složky
  `fotky-vyhra/`, víc v `fotky-vyhra/JAK-NA-TO.txt`
- tlačítko „Už stačilo“ na konci aplikaci zavře (Android ji ukončí, iPhone
  ji pošle na plochu jako gesto domů – viz upozornění u App Store níže)
- 3 hry zdarma, pak jednorázový nákup plné verze za 250 Kč (viz níže)
- 10 jazyků (čeština, angličtina, slovenština, němčina, francouzština,
  španělština, italština, portugalština, polština, ukrajinština) – výchozí
  podle jazyka telefonu, výběr v Nastavení → Jazyk
- vlastní fotka na kartách (Nastavení → Vzhled karet): výřez ve formátu karty
  jde ručně posunout prstem a přiblížit dvěma prsty nebo posuvníkem; fotka se
  zobrazí na líci, rubu nebo obojím a zůstává jen v telefonu
- „Poslat kamarádovi“: přes systémové sdílení (Zprávy, WhatsApp, e-mail…)
  odejde soubor `moje-karty.spidercards` a obrázek jako náhled. Kamarád, který
  má hru nainstalovanou, na soubor klepne → telefon nabídne Terky Spider →
  karty se nastaví samy. Soubor jde načíst i ručně přes Vybrat fotku.

## Struktura

| Soubor | Co v něm je |
| --- | --- |
| `src/engine.js` | pravidla hry, bez grafiky (pokryto testy v `test/`) |
| `src/main.js` | vykreslování, dotykové ovládání, dialogy |
| `src/style.css` | **veškerý vzhled** – barvy stolu, líc a rub karet |
| `src/i18n.js` | texty ve všech jazycích |
| `src/theme.js` | vlastní fotka na kartách, posílání a příjem souboru karet |
| `fotky-vyhra/` | fotky po výhře (zmenší se samy při sestavení) |
| `src/purchase.js` | 3 hry zdarma a nákup plné verze |
| `store/` | podklady pro obchody: texty, snímky, grafika, zásady soukromí, návod `store/JAK-NAHRAT.md` |
| `src/crop.js` | výpočty výřezu fotky (pokryto testy) |
| `assets/` | ikona a úvodní obrazovka (zdroj pro obě platformy) |
| `ios/`, `android/` | nativní projekty (Xcode, Android Studio) |

## Vývoj

```bash
npm install
npm run dev      # hra v prohlížeči na http://localhost:5173
npm test         # testy pravidel
```

Po každé změně kódu před spuštěním v telefonu:

```bash
npm run sync     # sestaví web a zkopíruje ho do ios/ a android/
```

## Vlastní grafika (až na ni dojde)

- **Karty a stůl:** `src/style.css`. Barvy jsou nahoře v `:root`, líc karty je
  `.face`, rub `.back`. Místo CSS kreseb lze dát obrázky
  (`background-image`), soubory patří do `public/`.
- **Ikona a úvodní obrazovka:** nahraď PNG v `assets/` (stejné názvy,
  ikona 1024×1024, splash 2732×2732) a spusť `npm run assets:generate`.
  (`npm run assets` by je přepsal zpět dočasnou grafikou.)

## Před publikací – co je potřeba doplnit

1. **Identifikátor aplikace** je `cz.terkyspider.app` (iOS Bundle ID i Android
   applicationId). Po prvním nahrání do obchodu už nejde změnit. Kdyby přece
   jen bylo potřeba ho změnit ještě před tím: `capacitor.config.json`,
   `android/app/build.gradle`, složka s `MainActivity.java`,
   `android/app/src/main/res/values/strings.xml`, Bundle Identifier v Xcode,
   typ souboru karet v `ios/App/App/Info.plist` a `PRODUCT_ID` v `src/purchase.js`.
2. **Název** je „Terky Spider“: `capacitor.config.json` (`appName`),
   `android/app/src/main/res/values/strings.xml` a Display Name v Xcode.
3. **Zásady ochrany soukromí, texty, snímky a grafika** jsou připravené ve
   složce `store/` – co kam vyplnit je v `store/JAK-NAHRAT.md`.

## Nákup plné verze (3 hry zdarma, pak 250 Kč)

Hra se započítá prvním tahem. Po třech hrách se při prvním tahu další hry
ukáže nabídka „Odemknout za …“ (cena se načte z obchodu v měně hráče),
„Obnovit nákup“ a „Teď ne“. Rozehraná hra se dohrát dá vždy.

Nákup je vázaný na Apple ID / účet Google, ne na telefon: po přeinstalaci
nebo na novém telefonu se při spuštění hra sama odemkne (a je tu i tlačítko
„Obnovit nákup“, které Apple vyžaduje). Počítadlo her zdarma je ale uložené
jen v telefonu – po přeinstalaci by neplatící hráč dostal další 3 hry.

V obou obchodech je potřeba založit produkt s ID
**`cz.terkyspider.app.full`** (po změně identifikátoru aplikace
změň i `PRODUCT_ID` v `src/purchase.js`):

- **App Store Connect:** nejdřív podepsat smlouvu „Paid Apps“ a vyplnit
  bankovní a daňové údaje (Business). Pak aplikace → In-App Purchases →
  „Non-Consumable“, ID výše, cena = nejbližší cenová hladina k 250 Kč.
  Při prvním odeslání ke schválení přidat nákup k verzi aplikace.
  V Xcode zapnout App → Signing & Capabilities → + In-App Purchase.
- **Google Play Console:** nastavit platební profil (merchant). Nejdřív
  nahrát build aplikace (stačí do interního testu), teprve pak jde založit
  Monetizace → Produkty v aplikaci → jednorázový produkt, ID výše, 250 Kč.
- **Testování bez placení:** iOS přes TestFlight (sandbox účet), Android
  přes „licenční testery“ v Play Console.

## Aktualizace

Každá nová verze = nový build nahraný do obchodu se zvýšeným číslem verze
(iOS: Build v Xcode, Android: `versionCode`). Projde znovu schválením
(obvykle hodiny až 2 dny) a hráčům se nainstaluje sama nebo přes obchod.
Rozehraná hra, statistiky, fotka na kartách i nákup zůstávají – pokud se
nezmění identifikátor aplikace a na Androidu podpisový klíč. Změna fotek
po výhře, textů, ceny nebo počtu her zdarma = nová verze.

## App Store (iOS)

Potřebuješ: Mac s Xcode (je), členství v
[Apple Developer Program](https://developer.apple.com/programs/) (99 USD/rok).

1. `npm run ios` – otevře projekt v Xcode.
2. App → Signing & Capabilities: vyber svůj tým, nastav Bundle Identifier.
3. V [App Store Connect](https://appstoreconnect.apple.com) založ novou
   aplikaci se stejným Bundle ID.
4. V Xcode zvol cíl „Any iOS Device“, pak Product → Archive → Distribute App
   → App Store Connect.
5. V App Store Connect doplň popis, snímky, věkové hodnocení, soukromí
   („Data Not Collected“) a odešli ke schválení. Před tím lze hru vyzkoušet
   přes TestFlight.

Verze se mění v Xcode (Version = `1.0`, Build = `1`); build musí být při
každém nahrání vyšší.

**Upozornění k „Už stačilo“:** Apple v pravidlech pro vzhled aplikací
(Human Interface Guidelines) říká, že se aplikace nemá zavírat sama. Při
schvalování to může vrátit. Pak stačí v `src/main.js` ve funkci `quit()`
pro iOS nevolat `AppExit.exit()` – zůstane jen rozloučení.

## Google Play (Android)

Na tomto Macu je nainstalovaná Java 21 a Android SDK (bez Android Studia),
takže se aplikace dá sestavit z příkazové řádky:

```bash
export JAVA_HOME=$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home
npm run sync && cd android && ./gradlew assembleDebug
```

Hotový soubor je `android/app/build/outputs/apk/debug/app-debug.apk` a jde
nahrát přímo do telefonu s Androidem. Pro emulátor a podepsání pro obchod
je pohodlnější [Android Studio](https://developer.android.com/studio)
(zabere 8–10 GB). Dál potřebuješ účet
[Google Play Console](https://play.google.com/console) (jednorázově 25 USD).

1. Nainstaluj Android Studio, pak `npm run android` – otevře projekt.
2. Vyzkoušej v emulátoru nebo na telefonu.
3. Build → Generate Signed App Bundle → vytvoř podpisový klíč (keystore).
   **Keystore a heslo si bezpečně zálohuj**, bez nich nejde vydat aktualizaci.
4. V Play Console založ aplikaci, nahraj `.aab`, vyplň popis, snímky,
   dotazník k obsahu a bezpečnost dat (žádná data se nesbírají).
5. Nový osobní vývojářský účet musí před vydáním do produkce projít
   uzavřeným testem (aktuálně 12 testerů po 14 dní) – počítej s tím v čase.

Verze: `versionCode` (celé číslo, při každém nahrání +1) a `versionName`
v `android/app/build.gradle`.
