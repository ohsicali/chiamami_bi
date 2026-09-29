/**
 * Mappe del codice per l'Error tracking di PostHog — gira dopo `vite build`.
 *
 * Il JavaScript che va online è compresso: senza le mappe PostHog mostra
 * l'errore su `index-a1b2c3.js:1:48213` invece che sul file e la riga veri.
 * Qui le mappe si caricano su PostHog e poi si cancellano da `dist`, così il
 * codice sorgente leggibile non finisce sul sito.
 *
 * Tre regole:
 * - **Senza chiavi non fa niente.** Le chiavi stanno solo su Vercel
 *   (`POSTHOG_CLI_API_KEY`, chiave personale `phx_…` con scrittura su Error
 *   tracking, e `POSTHOG_CLI_PROJECT_ID`); in locale e dove mancano
 *   `vite.config.js` non genera nemmeno le mappe.
 * - **Non blocca mai il deploy.** Se PostHog non risponde o la chiave è
 *   sbagliata si scrive un avviso e il sito va online lo stesso, con gli
 *   errori sul codice compresso come prima.
 * - **Nessuna `.map` resta in `dist`**, qualunque cosa succeda sopra.
 *
 * La CLI si scarica solo qui (versione fissa) e non sta nelle dipendenze:
 * il suo `postinstall` scarica un binario da GitHub e, se GitHub non
 * risponde, farebbe fallire `npm install` e quindi ogni deploy.
 */

import { spawnSync } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
const CLI = '@posthog/cli@0.18.9'

export function hasPostHogKeys(env = process.env) {
  return Boolean(env.POSTHOG_CLI_API_KEY && env.POSTHOG_CLI_PROJECT_ID)
}

function mapFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.map'))
    .map((f) => join(dir, f))
}

function upload() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA
  const args = [
    '-y', CLI, 'sourcemap', 'process',
    '--directory', DIST,
    '--release-name', 'chiamamibi',
    ...(version ? ['--release-version', version] : []),
    '--delete-after',
  ]
  const run = spawnSync('npx', args, { stdio: 'inherit', timeout: 180_000 })
  return run.status === 0
}

function main() {
  if (!hasPostHogKeys()) {
    console.log('[posthog] Chiavi assenti: mappe del codice non caricate.')
  } else if (upload()) {
    console.log('[posthog] Mappe del codice caricate su PostHog.')
  } else {
    console.warn('[posthog] ⚠️ Caricamento delle mappe non riuscito: il deploy continua, gli errori restano sul codice compresso.')
  }

  const left = mapFiles(DIST)
  for (const file of left) rmSync(file)
  if (left.length) console.log(`[posthog] Tolte ${left.length} mappe da ${DIST}.`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
