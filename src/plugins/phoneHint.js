/**
 * phoneHint.js — "Continue with 01742-898206".
 * ──────────────────────────────────────────────────────────────────────────
 * The JS side of android/app/src/main/java/com/toletpro/app/PhoneHintPlugin.kt:
 * Android's Phone Number Hint API, which shows the numbers on the phone's own
 * SIMs in a system bottom sheet. No permission, no autofill, and nothing
 * reaches us unless the user taps one of them.
 *
 * EVERYTHING HERE IS A NO-OP UNLESS ALL THREE ARE TRUE:
 *   · we are inside the native app (isNativeApp — the website is untouched),
 *   · the platform is Android (iOS has no such API),
 *   · the running APK actually contains the plugin.
 *
 * That last one is not paranoia. @capgo/capacitor-updater ships new JS to
 * phones whose native shell is whatever they last installed from Play, so this
 * file WILL run inside an older APK that has never heard of PhoneHint.
 * Capacitor.isPluginAvailable is what stops that from being a crash on the
 * first screen of the app.
 *
 * NOTHING HERE THROWS. A dismissed sheet, a phone with no SIM, an emulator
 * without Play Services and a number from a country we don't serve all come
 * back as null, because the only correct response to any of them is to leave
 * the field exactly as the user left it and let them type.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNativeApp } from '../utils/nativeExperience.js';
import { countryFromInternational, toNationalNumber } from '../constants/phoneCountries.js';

const PhoneHint = registerPlugin('PhoneHint');

/** Cheap and synchronous, so a render can ask it. Says nothing about SIMs. */
export function isPhoneHintSupported() {
  try {
    return isNativeApp()
      && Capacitor.getPlatform() === 'android'
      && Capacitor.isPluginAvailable('PhoneHint');
  } catch {
    return false;
  }
}

/**
 * Is there any point drawing a "use my number" button? Play Services' own
 * answer — it is the thing that shows the sheet, and on an emulator or a
 * de-Googled ROM it isn't there at all.
 *
 * It does NOT promise a number exists: Android offers no way to ask that
 * without showing the dialog, so a `true` here on a SIM-less phone still ends
 * in a sheet the user can only dismiss.
 */
export async function phoneHintAvailable() {
  if (!isPhoneHintSupported()) return false;
  try {
    const { available } = await PhoneHint.isAvailable();
    return !!available;
  } catch {
    return false;
  }
}

/**
 * Show the sheet and wait for a tap.
 *
 * The plugin hands back full E.164 (`+8801742898206`) — the only shape this
 * app's identity is ever written in — and it is split here rather than typed
 * into the field raw, so the country picker moves with it and the field holds
 * the national number the rest of the form already reasons about.
 *
 * @returns {Promise<{country: object, national: string, phoneNumber: string}|null>}
 *   null when the user dismissed it, when there was nothing to offer, or when
 *   the SIM is from a country we don't serve — an unsupported number written
 *   into the field would only be rejected at "send code", so it is better that
 *   nothing happens at all.
 */
export async function requestPhoneHint() {
  if (!isPhoneHintSupported()) return null;
  let phoneNumber;
  try {
    ({ phoneNumber } = await PhoneHint.request());
  } catch {
    // 'cancelled' and 'unavailable' are both ordinary here, and the caller
    // does the same thing either way.
    return null;
  }
  if (!phoneNumber) return null;
  const country = countryFromInternational(phoneNumber);
  if (!country) return null;
  return { country, national: toNationalNumber(phoneNumber, country), phoneNumber };
}
