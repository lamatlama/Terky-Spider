// 3 hry zdarma, pak jednorázový nákup plné verze (App Store / Google Play).
//
// Produkt je potřeba založit v App Store Connect i v Google Play Console:
//   typ: iOS „Non-Consumable“, Android „jednorázový produkt“ (in-app product)
//   ID:  PRODUCT_ID níže (na obou platformách stejné)
//   cena: 249 Kč (Apple má pevné cenové hladiny), na Google Play 250 Kč
// Hra se počítá ve chvíli prvního tahu, takže rozdání bez tahu nic nestojí.
import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { load, save } from './storage.js';

export const PRODUCT_ID = 'cz.terkyspider.app.full';
export const FREE_GAMES = 3;
const FALLBACK_PRICE = '250 Kč';

const native = Capacitor.isNativePlatform();
let license = { games: 0, unlocked: false };
let product = null;

export const isUnlocked = () => license.unlocked;
export const freeGamesLeft = () => Math.max(0, FREE_GAMES - license.games);
export const price = () => product?.priceString || FALLBACK_PRICE;

/** Smí se začít další hra? */
export const canStartGame = () => license.unlocked || license.games < FREE_GAMES;

/** Započítá novou hru (volá se při prvním tahu). */
export function countGame() {
  if (license.unlocked) return;
  license.games++;
  save('license', license);
}

function unlock() {
  license.unlocked = true;
  save('license', license);
}

const owns = (purchases) =>
  purchases.some((p) => p.productIdentifier === PRODUCT_ID && !p.revocationDate && p.purchaseState !== 'PENDING');

export async function initPurchases() {
  const saved = await load('license');
  if (saved) license = { games: Number(saved.games) || 0, unlocked: !!saved.unlocked };
  if (native) syncStore(); // obchod může odpovídat pomalu – start hry na něj nečeká
}

async function syncStore() {
  try {
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: [PRODUCT_ID],
      productType: PURCHASE_TYPE.INAPP,
    });
    product = products[0] || null;
  } catch {
    // obchod nedostupný (offline) – zobrazí se záložní cena
  }
  // nákup z jiného zařízení / po přeinstalaci
  if (!license.unlocked) await refresh().catch(() => {});
}

async function refresh() {
  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.INAPP,
    onlyCurrentEntitlements: true,
  });
  if (owns(purchases)) unlock();
  return license.unlocked;
}

/** Koupit plnou verzi. Vrací true po úspěchu, false když hráč nákup zrušil, jinak vyhodí chybu. */
export async function buy() {
  if (!native) {
    // v prohlížeči není obchod – při vývoji se nákup jen nasimuluje
    if (import.meta.env.DEV) {
      unlock();
      return true;
    }
    throw new Error('Store not available');
  }
  try {
    const tx = await NativePurchases.purchaseProduct({
      productIdentifier: PRODUCT_ID,
      productType: PURCHASE_TYPE.INAPP,
      quantity: 1,
    });
    if (tx?.productIdentifier === PRODUCT_ID || owns([tx])) {
      unlock();
      return true;
    }
    return refresh();
  } catch (e) {
    if (/cancel/i.test(String(e?.message || e?.code || ''))) return false;
    throw e;
  }
}

/** Obnovit nákup (nový telefon, přeinstalace). Vrací true, když se našel. */
export async function restore() {
  if (!native) return license.unlocked;
  await NativePurchases.restorePurchases();
  return refresh();
}
