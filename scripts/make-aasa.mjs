#!/usr/bin/env node
/*
 * make-aasa.mjs — generate the Apple App Site Association file.
 * ──────────────────────────────────────────────────────────────────────────
 * Usage:
 *   node scripts/make-aasa.mjs <TEAM_ID> [BUNDLE_ID] [--paths /join/*,/property/*]
 *
 * Example:
 *   node scripts/make-aasa.mjs A1B2C3D4E5 com.toletpro.ios
 *
 * WHY A SCRIPT INSTEAD OF A CHECKED-IN FILE WITH A PLACEHOLDER
 * Apple's CDN fetches this file and caches it. A committed file with
 * <TEAMID> in it is not "a to-do" — it is a live, invalid association that
 * keeps failing for hours after the real value lands, and the failure is
 * silent (links quietly open Safari). So the file does not exist in the repo
 * at all until someone runs this with a real Team ID, and this script refuses
 * to write anything it can see is wrong.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * It does not sign the file. Signed AASA files are a pre-iOS-9 mechanism;
 * over https Apple wants plain JSON with content-type application/json, which
 * vercel.json already sets for this path.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT  = resolve(HERE, '../public/.well-known/apple-app-site-association');

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith('--')) { flags[argv[i].slice(2)] = argv[i + 1]; i += 1; } else positional.push(argv[i]);
}

const [teamId, bundleId = 'com.toletpro.app'] = positional;

const die = (msg) => { console.error(`\n  ✗ ${msg}\n`); process.exit(1); };

if (!teamId) {
  die('Team ID required.\n'
    + '    node scripts/make-aasa.mjs <TEAM_ID> [BUNDLE_ID]\n\n'
    + '    Find it at developer.apple.com → Membership → Team ID.');
}

// A Team ID is exactly 10 alphanumeric characters. Checking it here is the
// difference between "links don't work and nobody knows why" and an error
// message, because nothing downstream validates this — iOS just silently
// declines to associate.
if (!/^[A-Z0-9]{10}$/i.test(teamId)) {
  die(`"${teamId}" is not a Team ID. Expected 10 alphanumeric characters, e.g. A1B2C3D4E5.`);
}
if (!/^[A-Za-z0-9.-]+$/.test(bundleId) || !bundleId.includes('.')) {
  die(`"${bundleId}" is not a bundle identifier, e.g. com.toletpro.app.`);
}

// Which URL paths the app claims. Defaults to the invite flow only — the same
// scope the Android intent filter uses.
//
// ONLY CLAIM WHAT THE APP CAN ACTUALLY HANDLE. A path listed here opens the
// app INSTEAD of Safari, so claiming /join/* in an app with no join screen
// strands the tenant on whatever it does show — strictly worse than the
// website, which handles the flow fine.
const paths = (flags.paths || '/join/*').split(',').map((p) => p.trim()).filter(Boolean);

const aasa = {
  applinks: {
    // Empty since iOS 13; `details` carries everything.
    apps: [],
    details: [
      {
        appID: `${teamId.toUpperCase()}.${bundleId}`,
        paths,
      },
    ],
  },
};

await mkdir(dirname(OUT), { recursive: true });
// No trailing newline debate: Apple parses JSON, and a newline is harmless.
await writeFile(OUT, `${JSON.stringify(aasa, null, 2)}\n`, 'utf8');

console.log(`
  ✓ Wrote ${OUT}

    appID : ${aasa.applinks.details[0].appID}
    paths : ${paths.join(', ')}

  Next:
    1. Xcode → target → Signing & Capabilities → Associated Domains
       add:  applinks:www.toletpro.rent
    2. Deploy the web app, then confirm it is served as JSON:
       curl -sI https://www.toletpro.rent/.well-known/apple-app-site-association
       (expect 200 + content-type: application/json)
    3. Delete and reinstall the app — iOS only fetches this at install time.
`);
