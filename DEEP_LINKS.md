# Deep links — making invite links open the app

A landlord shares `https://www.toletpro.rent/join/<token>`. On a phone with
TO-LET PRO installed that must open **the app**, not a mobile browser.

It matters most for invites specifically: a tenant who lands in Chrome is
logged out, has to sign in again, and uploads their NID through a browser that
doesn't have the camera permission the app already holds.

The same URL still opens the website when the app isn't installed. That is the
whole point of App Links / Universal Links, and it's why there is no
`toletpro://` scheme — a landlord shares one link and never has to ask which
kind of phone the tenant has.

---

## What's already wired up

| Piece | Where |
|---|---|
| JS listener (`appUrlOpen` + cold-start `getLaunchUrl`) | [`src/components/DeepLinkHandler.jsx`](src/components/DeepLinkHandler.jsx), mounted in `App.jsx` |
| Android intent filter (`autoVerify`, scoped to `/join`) | `android/app/src/main/AndroidManifest.xml` |
| Android verification file | `public/.well-known/assetlinks.json` |
| Hosting: `.well-known` excluded from the SPA rewrite | `vercel.json` |
| `@capacitor/app` registered natively | via `npx cap sync android` |
| AASA generator (iOS, run when ready) | `scripts/make-aasa.mjs` |

**Android is live. iOS is not** — the iOS app is a separate native Swift
project, not this Capacitor build, so it needs its own wiring. See the iOS
section below.

Only `/join/<token>` is claimed. Claiming the whole host would pull every
property page and marketing link into the app too — a much bigger behavioural
change. To widen it, add another `<data android:pathPrefix="…">` to the same
intent filter; the host stays verified either way.

---

## The host is `www.toletpro.rent`, not the apex

Measured, not assumed:

| URL | Result |
|---|---|
| `https://toletpro.rent/` | **308** → `https://www.toletpro.rent/` |
| `https://www.toletpro.rent/` | **200** |
| `https://tolet-pro.vercel.app/` | **404 — dead** |

Two consequences, both of which have bitten this project already:

**1. The apex cannot be claimed.** App Links verification does *not* follow
redirects when fetching `assetlinks.json`, and neither does Apple's AASA fetch.
A `308` on the apex means verification fails there, and a host that fails can
drag the whole intent filter down with it. So the manifest lists **only**
`www.toletpro.rent`, and the backend mints links on www to match. Apex links
still work — they redirect to the website — they just won't open the app.

To claim the apex too, it must first serve `/.well-known/assetlinks.json`
directly with a `200` and no redirect.

**2. `tolet-pro.vercel.app` is gone.** It was the hardcoded fallback in both
`utils/inviteToken.js` (invite links) and `services/fcm.service.js` (push
notification links). Any deploy without `PUBLIC_APP_URL` set was generating
invite QR codes pointing at a 404. Both fallbacks are now `https://www.toletpro.rent`.

**Set `PUBLIC_APP_URL=https://www.toletpro.rent` on the backend anyway.** The
fallback is a safety net, not configuration — a QR code is printed once and
lives on a wall, so the URL inside it should never depend on a default.

---

## ⚠️ Android: the one thing that will silently break this

`assetlinks.json` currently lists the fingerprint of the **local release
keystore** (`android/app/release.keystore`):

```
7E:14:DC:B8:82:59:F5:E7:DD:1B:B8:49:09:83:D6:39:F8:07:30:A3:97:A7:DB:7A:8B:E9:7C:CE:1B:70:D1:7F
```

That is correct for a directly-installed APK. **It is the wrong fingerprint for
anything installed from the Play Store.**

Google Play re-signs every upload with its own key (Play App Signing, mandatory
for new apps). Installed builds therefore carry a *different* certificate than
the one above, verification fails, and — on Android 12 and up — a failed
verification does **not** fall back to an "open with" chooser. The link just
opens the browser and the app is never offered. It looks exactly like the
feature was never built.

### Fix before the first Play release

1. Play Console → **Test and release → App integrity → App signing key certificate**
2. Copy the **SHA-256 certificate fingerprint**
3. Add it to the array in `public/.well-known/assetlinks.json` — **keep both**,
   so direct APK installs and Play installs both verify:

```json
"sha256_cert_fingerprints": [
  "7E:14:DC:B8:82:59:F5:E7:DD:1B:B8:49:09:83:D6:39:F8:07:30:A3:97:A7:DB:7A:8B:E9:7C:CE:1B:70:D1:7F",
  "<PLAY APP SIGNING SHA-256 GOES HERE>"
]
```

4. Redeploy the web app **before** the release rolls out — Android fetches this
   file at install time.

To read the local fingerprint again:

```bash
keytool -list -v -keystore android/app/release.keystore -alias tolet | grep SHA256
```

### Verifying it works

Check Google's verifier sees the file:

```bash
curl -sI https://www.toletpro.rent/.well-known/assetlinks.json
```

Must be `200` with `content-type: application/json`. Then, on a connected device:

```bash
adb shell pm get-app-links com.toletpro.app
```

Look for `verified` next to the domain. If it says `1024` / `legacy_failure`,
the fingerprint doesn't match — it's almost always the Play signing key issue
above. Force a re-check with:

```bash
adb shell pm verify-app-links --re-verify com.toletpro.app
```

Test an actual link:

```bash
adb shell am start -a android.intent.action.VIEW -d "https://www.toletpro.rent/join/TESTTOKEN123456"
```

---

## iOS — a separate native app

The iOS app is **hand-written Swift, not Capacitor**. It is not in this repo, so
none of the Capacitor tooling above applies to it: do **not** run
`npx cap add ios`. That would scaffold a second, unrelated Capacitor app and
`DeepLinkHandler.jsx` would never run on the real one.

What this repo owns is the web half — and it is ready. `vercel.json` serves
`/.well-known/apple-app-site-association` with `content-type: application/json`
and keeps it out of the SPA rewrite. That exclusion matters more than it looks:
the file has **no extension**, so without it Vercel returned `index.html` and
Universal Links failed with a parse error that names nothing useful.

### ⚠️ Decide this before claiming any path

A path listed in the AASA opens the app **instead of** Safari. So claiming
`/join/*` in an app with no join screen strands the tenant on whatever the app
shows instead — strictly worse than the website, where the flow works end to end
today.

**Only claim `/join/*` once the Swift app actually implements tenant
onboarding.** Until then, leaving iOS unclaimed is the correct behaviour, not a
gap. Everything below is ready for the moment that changes.

### 1. Generate the AASA file

```bash
node scripts/make-aasa.mjs <TEAM_ID> <BUNDLE_ID>
```

Team ID: developer.apple.com → Membership → Team ID (10 characters).
Bundle ID: the native app's own identifier — it is **not** necessarily
`com.toletpro.app`, which is the Android/Capacitor one.

The file is generated rather than committed with a placeholder on purpose:
Apple's CDN caches it, so a placeholder is a live invalid association that keeps
failing for hours after the real value lands, and it fails silently.

To claim more than the invite flow later:

```bash
node scripts/make-aasa.mjs <TEAM_ID> <BUNDLE_ID> --paths "/join/*,/property/*"
```

Multiple apps can share one file — add another entry to `details` if the
Capacitor build ever ships on iOS alongside the native one.

### 2. Xcode

Target → **Signing & Capabilities** → **+ Capability** → **Associated Domains**,
then add:

```
applinks:www.toletpro.rent
```

### 3. Handle the incoming URL in Swift

Universal Links arrive as an `NSUserActivity`, not as a custom-scheme URL.

SwiftUI:

```swift
.onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
    guard let url = activity.webpageURL else { return }
    // Expect https://www.toletpro.rent/join/<token>
    let parts = url.pathComponents   // ["/", "join", "<token>"]
    guard parts.count >= 3, parts[1] == "join" else { return }
    router.openInvite(token: parts[2])
}
```

UIKit (`AppDelegate`):

```swift
func application(_ application: UIApplication,
                 continue userActivity: NSUserActivity,
                 restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
          let url = userActivity.webpageURL else { return false }
    return Router.shared.handle(url)
}
```

Validate the host and path on the Swift side too, the same way
`pathFromDeepLink()` does in `DeepLinkHandler.jsx` — the URL comes from outside
the app.

The token then goes to `GET /api/invite/resolve/:token` (public) and
`POST /api/invite/:token/submit` (requires auth). See
`tolet-pro-backend/routes/invite.routes.js`.

### 4. Verify

```bash
curl -sI https://www.toletpro.rent/.well-known/apple-app-site-association
```

Expect `200` and `content-type: application/json`. Then **delete and reinstall**
the app — iOS only fetches this at install time, so an update will not pick up a
newly published file.

---

## If the domain changes again

Five places must agree, or links stop routing. The failure is always silent —
the link opens a browser and nothing logs an error:

1. `PUBLIC_APP_URL` on the backend — builds the link
   (`tolet-pro-backend/utils/inviteToken.js`, and `services/fcm.service.js`
   reads the same variable)
2. `android:host` in `AndroidManifest.xml`
3. `assetlinks.json` served from **that exact host**, `200`, no redirect
4. `allowedHosts()` in `src/components/DeepLinkHandler.jsx`
5. `applinks:` entry in the iOS Associated Domains capability, plus a
   regenerated AASA file

`DeepLinkHandler.jsx` also reads `VITE_PUBLIC_APP_URL` when set, so a custom
domain is accepted there without a code change.

**Re-issued tokens do not fix old QR codes.** A printed QR encodes an absolute
URL. If the domain moves, every QR already taped to a wall points at the old
host — so keep the old domain redirecting, or reprint. This is the main reason
the fallback host is now a real, working domain rather than a placeholder.
