// Věci, které fungují jen v nativní aplikaci (vibrace, stavový řádek). V prohlížeči nedělají nic.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

const native = Capacitor.isNativePlatform();
const quiet = (p) => p.catch(() => {});

export function initNative() {
  if (!native) return;
  quiet(StatusBar.setStyle({ style: Style.Dark })); // světlé ikony na tmavém pozadí
}

export const tick = () => native && quiet(Haptics.impact({ style: ImpactStyle.Light }));
export const thud = () => native && quiet(Haptics.notification({ type: NotificationType.Warning }));
export const success = () => native && quiet(Haptics.notification({ type: NotificationType.Success }));
