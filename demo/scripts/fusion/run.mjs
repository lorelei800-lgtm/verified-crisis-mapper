#!/usr/bin/env node
/**
 * Fusion pipeline entry point.
 *
 *   node scripts/fusion/run.mjs              # fetch all sources, post to CMS
 *   node scripts/fusion/run.mjs --dry-run    # fetch + dedupe + score, skip POST
 *   node scripts/fusion/run.mjs --source=gdacs  # single source only (debugging)
 *
 * Designed to run from `cd demo`. Reads CMS credentials from .env via dotenv
 * when present, otherwise from the process environment (the GitHub Actions
 * cron sets them as repo secrets).
 *
 * Exit codes:
 *   0  success — at least one source returned data (POST succeeded or skipped)
 *   1  hard failure — no source returned data or POST failed for all events
 *   2  bad CLI args
 *
 * See ./README.md for the architecture overview.
 */
import { fetchGdacs } from './sources/gdacs.mjs'
import { fetchCopernicus } from './sources/copernicus.mjs'
import { fetchReliefWeb } from './sources/reliefweb.mjs'
import { dedupe } from './deduper.mjs'
import { scoreAll } from './trustScoreV2.mjs'
import { postEvents } from './post-to-cms.mjs'

const argv = process.argv.slice(2)
const flags = {
  dryRun:    argv.includes('--dry-run'),
  source:    argv.find(a => a.startsWith('--source='))?.split('=')[1] ?? null,
  help:      argv.includes('--help') || argv.includes('-h'),
}

if (flags.help) {
  console.log(`Usage: node scripts/fusion/run.mjs [--dry-run] [--source=gdacs|copernicus|reliefweb]`)
  process.exit(0)
}

const VALID_SOURCES = ['gdacs', 'copernicus', 'reliefweb']
if (flags.source && !VALID_SOURCES.includes(flags.source)) {
  console.error(`[fusion] unknown source: ${flags.source}. Valid: ${VALID_SOURCES.join(', ')}`)
  process.exit(2)
}

/** Run a fetcher and gracefully fall back to [] on hard failure. */
async function safe (label, fn) {
  try {
    const start = Date.now()
    const events = await fn()
    console.log(`[fusion] ${label}: ${events.length} event(s) in ${Date.now() - start}ms`)
    return events
  } catch (err) {
    console.warn(`[fusion] ${label} failed:`, err?.message ?? err)
    return []
  }
}

async function main () {
  console.log(`[fusion] start ${new Date().toISOString()} (dryRun=${flags.dryRun}, source=${flags.source ?? 'all'})`)

  // Fetch in parallel (each is rate-friendly and independent).
  const tasks = []
  if (!flags.source || flags.source === 'gdacs')      tasks.push(safe('gdacs',       fetchGdacs))
  if (!flags.source || flags.source === 'copernicus') tasks.push(safe('copernicus', fetchCopernicus))
  if (!flags.source || flags.source === 'reliefweb')  tasks.push(safe('reliefweb',  fetchReliefWeb))

  const lists = await Promise.all(tasks)
  const allEvents = lists.flat()
  console.log(`[fusion] total raw events: ${allEvents.length}`)

  if (allEvents.length === 0) {
    console.warn('[fusion] no source returned any events — nothing to do')
    process.exit(1)
  }

  // Dedupe by H3 res 8 + temporal window, then score each resulting cluster.
  const fused = dedupe(allEvents)
  console.log(`[fusion] after dedupe: ${fused.length} fused event(s) (${allEvents.length - fused.length} merged away)`)

  const scored = scoreAll(fused)

  // Always log a summary regardless of dry-run.
  const byTier = scored.reduce((acc, e) => {
    const tier = e.trustScore.total >= 80 ? 'green' : e.trustScore.total >= 50 ? 'amber' : 'red'
    acc[tier] = (acc[tier] ?? 0) + 1
    return acc
  }, {})
  console.log(`[fusion] tiers: green=${byTier.green ?? 0} amber=${byTier.amber ?? 0} red=${byTier.red ?? 0}`)

  if (flags.dryRun) {
    console.log(`[fusion] dry-run — not posting to CMS. Sample event:\n`, JSON.stringify(scored[0], null, 2))
    process.exit(0)
  }

  const result = await postEvents(scored)
  console.log(`[fusion] post-to-cms: ${result.posted} posted, ${result.skipped} skipped, ${result.failed} failed`)
  process.exit(result.posted > 0 || result.skipped > 0 ? 0 : 1)
}

main().catch(err => {
  console.error('[fusion] fatal:', err)
  process.exit(1)
})
