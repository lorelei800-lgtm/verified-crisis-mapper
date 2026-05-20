#!/usr/bin/env node
/**
 * bootstrap-bangkok.mjs — One-shot CMS reset for the Bangkok demo.
 *
 * Idempotent end-to-end fix for "the live demo still shows Tokyo":
 *
 *   1. PATCH the existing `deployment-config` row(s) so the dashboard
 *      reads Bangkok bounds, centre, and title strings.
 *   2. DELETE every existing `damage-report` item (legacy Tokyo test rows
 *      from earlier development), then POST the 28 Bangkok mockReports
 *      shipped in src/data/mockReports.ts.
 *   3. (Optional) Skip the wipe with --keep-existing if the user wants to
 *      append rather than replace.
 *
 * Trigger paths:
 *
 *   GitHub UI (no local token needed):
 *     Actions → "Bootstrap CMS to Bangkok" → Run workflow
 *
 *   Locally (requires demo/.env with VITE_CMS_TOKEN):
 *     cd demo && node scripts/bootstrap-bangkok.mjs
 *     cd demo && node scripts/bootstrap-bangkok.mjs --keep-existing
 *     cd demo && node scripts/bootstrap-bangkok.mjs --dry-run
 *
 * Exit codes:
 *   0  success
 *   1  any step failed
 *   2  missing required env vars
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BANGKOK_CONFIG, BANGKOK_REPORTS } from './lib/bangkok-data.mjs'

// ── env loading ──────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath   = path.resolve(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
  }
}

const BASE_URL = process.env.VITE_CMS_BASE_URL ?? 'https://api.cms.reearth.io'
const PROJECT  = process.env.VITE_CMS_PROJECT         // "workspace/project-alias"
const MODEL    = process.env.VITE_CMS_MODEL ?? 'damage-report'
const CONFIG_MODEL = process.env.VITE_CMS_CONFIG_MODEL ?? 'deployment-config'
const TOKEN    = process.env.VITE_CMS_TOKEN

if (!PROJECT || !TOKEN) {
  console.error('❌ VITE_CMS_PROJECT and VITE_CMS_TOKEN must be set.')
  console.error('   For GitHub Actions: add as repo secrets (already done).')
  console.error('   For local runs:     copy them into demo/.env.')
  process.exit(2)
}

const args = process.argv.slice(2)
const flags = {
  dryRun:        args.includes('--dry-run'),
  keepExisting:  args.includes('--keep-existing'),
  help:          args.includes('--help') || args.includes('-h'),
}

if (flags.help) {
  console.log(`Usage: node scripts/bootstrap-bangkok.mjs [--dry-run] [--keep-existing]`)
  process.exit(0)
}

const [WS, PROJ] = PROJECT.split('/')
const writeBase  = `${BASE_URL}/api/${WS}/projects/${PROJ}`
const readBase   = `${BASE_URL}/api/p/${PROJECT}`              // public read uses workspace/project as-is

const authHeaders = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

console.log(`📡 CMS:      ${BASE_URL}`)
console.log(`📦 Project:  ${PROJECT}`)
console.log(`🔑 Token:    ${TOKEN.slice(0, 8)}…`)
console.log(`⚙️  Mode:     ${flags.dryRun ? 'dry-run' : flags.keepExisting ? 'append' : 'replace'}\n`)

// ── helpers ──────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms))
const toFields = obj => Object.entries(obj).map(([key, value]) => ({ key, value }))

async function fetchJson (url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

/**
 * List all items in a model via the Integration API (includes drafts).
 * Re:Earth CMS sometimes returns `results`, sometimes `items` — accept both.
 */
async function listAllItems (model) {
  const url = `${writeBase}/models/${model}/items?perPage=200`
  const data = await fetchJson(url, { headers: authHeaders })
  return [...(data.results ?? []), ...(data.items ?? [])]
}

async function patchItem (model, itemId, fields) {
  if (flags.dryRun) { console.log(`   [dry-run] PATCH ${model}/${itemId}`); return true }
  const url = `${writeBase}/models/${model}/items/${itemId}`
  const res = await fetch(url, {
    method: 'PATCH', headers: authHeaders,
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    console.warn(`   ⚠ PATCH ${model}/${itemId} → ${res.status}`)
    return false
  }
  // Re-publish so the public read API picks up the change.
  const pubUrl = `${writeBase}/models/${model}/items/${itemId}/publish`
  const pubRes = await fetch(pubUrl, {
    method: 'POST', headers: authHeaders,
    signal: AbortSignal.timeout(10000),
    body: '{}',
  })
  if (!pubRes.ok) console.warn(`   ⚠ publish ${model}/${itemId} → ${pubRes.status}`)
  return res.ok
}

async function deleteItem (model, itemId) {
  if (flags.dryRun) { console.log(`   [dry-run] DELETE ${model}/${itemId}`); return true }
  const url = `${writeBase}/models/${model}/items/${itemId}`
  const res = await fetch(url, {
    method: 'DELETE', headers: authHeaders,
    signal: AbortSignal.timeout(15000),
  })
  return res.ok
}

async function createItem (model, fields, asPublic = true) {
  if (flags.dryRun) { console.log(`   [dry-run] POST ${model}`); return true }
  const url = `${writeBase}/models/${model}/items`
  const res = await fetch(url, {
    method: 'POST', headers: authHeaders,
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ fields, status: asPublic ? 'public' : 'draft' }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.warn(`   ⚠ POST ${model} → ${res.status}: ${body.slice(0, 120)}`)
    return false
  }
  // POST sometimes leaves the item as draft — explicitly publish.
  const json = await res.json().catch(() => ({}))
  const newId = json.id
  if (newId) {
    const pubUrl = `${writeBase}/models/${model}/items/${newId}/publish`
    await fetch(pubUrl, {
      method: 'POST', headers: authHeaders,
      signal: AbortSignal.timeout(10000),
      body: '{}',
    }).catch(() => {})
  }
  return true
}

// ── step 1: deployment-config → Bangkok ──────────────────────────────────────

async function fixDeploymentConfig () {
  console.log('🛠️  Step 1: deployment-config → Bangkok')
  let configs
  try {
    configs = await listAllItems(CONFIG_MODEL)
  } catch (err) {
    console.warn(`   ⚠ Could not list ${CONFIG_MODEL}: ${err.message}`)
    return false
  }
  console.log(`   Found ${configs.length} existing deployment-config row(s)`)

  const fields = toFields(BANGKOK_CONFIG)

  if (configs.length === 0) {
    console.log('   No row found — creating a fresh Bangkok deployment-config')
    return createItem(CONFIG_MODEL, fields)
  }

  let ok = true
  for (const c of configs) {
    const id = c.id
    const before = c.scenario_label ?? c.title ?? '(unknown)'
    const success = await patchItem(CONFIG_MODEL, id, fields)
    console.log(`   ${success ? '✅' : '❌'} ${id}  "${before}" → "${BANGKOK_CONFIG.scenario_label}"`)
    if (!success) ok = false
  }
  return ok
}

// ── step 2: damage-report wipe + seed ────────────────────────────────────────

async function resetDamageReports () {
  console.log('\n🛠️  Step 2: damage-report → 28 Bangkok rows')

  let existing
  try {
    existing = await listAllItems(MODEL)
  } catch (err) {
    console.warn(`   ⚠ Could not list ${MODEL}: ${err.message}`)
    return false
  }
  console.log(`   Found ${existing.length} existing damage-report row(s)`)

  if (!flags.keepExisting) {
    console.log(`   Wiping legacy rows…`)
    let deleted = 0
    for (const item of existing) {
      const ok = await deleteItem(MODEL, item.id)
      if (ok) deleted += 1
      await sleep(150)
    }
    console.log(`   ✅ Deleted ${deleted}/${existing.length}`)
  } else {
    console.log(`   --keep-existing → leaving legacy rows in place`)
  }

  console.log(`   Seeding ${BANGKOK_REPORTS.length} Bangkok rows…`)
  let created = 0
  for (let i = 0; i < BANGKOK_REPORTS.length; i++) {
    const report = BANGKOK_REPORTS[i]
    const ok = await createItem(MODEL, toFields(report))
    if (ok) created += 1
    const tag = `[${String(i + 1).padStart(2, '0')}/${BANGKOK_REPORTS.length}]`
    console.log(`   ${ok ? '✅' : '❌'} ${tag} ${report.district} · ${report.tier}`)
    await sleep(200)
  }
  console.log(`   ✅ Created ${created}/${BANGKOK_REPORTS.length}`)
  return created === BANGKOK_REPORTS.length
}

// ── main ─────────────────────────────────────────────────────────────────────

const t0 = Date.now()
const r1 = await fixDeploymentConfig()
const r2 = await resetDamageReports()
const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`\n🏁 Done in ${elapsed}s.  config=${r1 ? 'ok' : 'FAIL'}  reports=${r2 ? 'ok' : 'FAIL'}`)
process.exit(r1 && r2 ? 0 : 1)
