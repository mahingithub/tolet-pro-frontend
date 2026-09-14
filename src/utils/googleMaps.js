import { useEffect, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

/**
 * ONE place that knows how to load the Google Maps JS SDK.
 *
 * WHY THIS MODULE EXISTS — TWO REASONS.
 *
 * 1. THE LOADER IS A SINGLETON AND ITS OPTIONS MUST MATCH EVERYWHERE.
 *    @react-google-maps/api keeps ONE Loader per `id` and throws "Loader must
 *    not be called again with different options" if a later call passes a
 *    different `libraries`. Omitting the prop defaults it to ['maps'], which
 *    does not equal []. PropertyListing, PropertyDetails and AddProperty each
 *    used to declare the id, the key and the libraries themselves, with
 *    comments in all three begging the next editor to keep them identical.
 *    Now there is nothing to keep in sync.
 *
 * 2. loadError DOES NOT CATCH AN AUTH FAILURE, WHICH IS THE FAILURE WE GET.
 *    When the key is rejected — RefererNotAllowedMapError, InvalidKeyMapError,
 *    ApiNotActivatedMapError, a lapsed billing account — the SCRIPT ITSELF
 *    still downloads with a 200. So `loadError` stays null, `isLoaded` flips
 *    true, <GoogleMap> mounts, and Google paints its own grey "Oops! Something
 *    went wrong" panel INSIDE our container. Every `if (loadError)` fallback in
 *    this app was therefore unreachable for the one failure mode that actually
 *    happens in production.
 *
 *    The only signal Google gives is a call to `window.gm_authFailure`. It is a
 *    global, it fires once per page, and it can fire before or after any given
 *    map mounts — so it is captured at module load into a module-level flag and
 *    replayed to components through useGoogleMapsAuthFailure().
 *
 * IF THE MAP IS BLANK ON A REAL DEVICE, CHECK THE REFERRER LIST FIRST.
 * The key is HTTP-referrer restricted, and an installed Capacitor build is NOT
 * served from the website's origin — Android loads the app from
 * `https://localhost`, so `https://www.toletpro.rent/*` alone does not cover
 * it. Google Cloud Console → Credentials → the Maps key → Website restrictions
 * needs every origin the app runs on, the app's own included.
 */

// Vite in this project; the CRA branch is kept for the shared component code
// that also ships to the admin build.
//
// The literal is the LAST resort and is deliberate: .env / .env.production are
// gitignored, so a clean clone or a CI runner without them would otherwise
// build a keyless bundle. A Maps JS key is public in the browser bundle no
// matter where it comes from — the restriction list in Cloud Console is what
// protects it, not secrecy — so this costs nothing and keeps the map alive.
// THERE ARE TWO MAPS KEYS IN THIS PROJECT AND THEY LOOK ALIKE — both start
// "AIzaSyC". Use the one ending -Wrq8S-I. Its Website restrictions list
// https://localhost/* and capacitor://localhost/*, which is what the INSTALLED
// app reports as its origin (Capacitor 8 defaults androidScheme to https and
// the host to localhost), and it has the Geocoding API enabled, which the Add
// Property wizard calls for reverse-geocoding.
//
// The old key ending -KZWmKlg allows only the toletpro.rent hosts, so the
// website worked while the app showed Google's grey "Oops! Something went
// wrong" panel, and reverse-geocoding returned "This API is not activated".
export const GOOGLE_MAPS_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_GOOGLE_MAPS_API_KEY) ||
  (typeof process !== 'undefined' && process?.env?.REACT_APP_GOOGLE_MAPS_API_KEY) ||
  'AIzaSyCJxYKtSBxh-BokQG79qN5r6DxGWrq8S-I';

// Stable reference, shared by every loader call. See reason 1 above.
export const GOOGLE_MAPS_LIBRARIES = [];

export const GOOGLE_MAPS_LOADER_ID = 'tlp-google-map-script';

let authFailed = false;
const authListeners = new Set();

if (typeof window !== 'undefined') {
  // Installed at module load, not on mount: the SDK can fail auth before the
  // first <GoogleMap> has finished mounting, and the callback has to already
  // be on `window` when it does. Any previously-registered handler is chained
  // rather than clobbered.
  const previous = window.gm_authFailure;
  window.gm_authFailure = function toletProGmAuthFailure() {
    if (!authFailed) {
      authFailed = true;
      // The console line Google prints names the exact error and the origin it
      // saw; this one says what to do about it, once.
      console.error(
        '[maps] Google Maps rejected this key for origin ' +
          window.location.origin +
          '. Add that origin to the key\'s HTTP-referrer allowlist in Google ' +
          'Cloud Console (an installed Android build reports https://localhost).',
      );
      authListeners.forEach((fn) => {
        try {
          fn();
        } catch {
          /* a bad subscriber must not stop the others */
        }
      });
    }
    if (typeof previous === 'function') previous();
  };
}

/** True once Google has rejected our key on this page. Never goes back false. */
export function useGoogleMapsAuthFailure() {
  const [failed, setFailed] = useState(authFailed);

  useEffect(() => {
    if (authFailed) {
      setFailed(true);
      return undefined;
    }
    const onFail = () => setFailed(true);
    authListeners.add(onFail);
    return () => authListeners.delete(onFail);
  }, []);

  return failed;
}

/**
 * Load the SDK and report whether a map can actually be drawn.
 *
 * @returns {{isLoaded: boolean, loadError: Error|undefined, authFailed: boolean,
 *            unavailable: boolean}}
 *   `unavailable` is the one a caller normally wants: true when there is no key,
 *   when the script failed to download, or when Google rejected the key. Render
 *   the fallback on it, and only mount <GoogleMap> once `isLoaded` is true and
 *   `unavailable` is false.
 */
export function useGoogleMaps() {
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const failed = useGoogleMapsAuthFailure();

  return {
    isLoaded,
    loadError,
    authFailed: failed,
    unavailable: !GOOGLE_MAPS_API_KEY || !!loadError || failed,
  };
}
