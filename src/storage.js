// Trvalé úložiště: v aplikaci nativní (UserDefaults / SharedPreferences), v prohlížeči localStorage.
import { Preferences } from '@capacitor/preferences';

export async function load(key) {
  try {
    const { value } = await Preferences.get({ key });
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function save(key, value) {
  Preferences.set({ key, value: JSON.stringify(value) }).catch(() => {});
}
