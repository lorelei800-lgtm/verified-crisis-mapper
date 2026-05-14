/**
 * H3 + temporal deduplication.
 *
 * Two crisis events are considered "the same event" when:
 *   1. their H3 res 8 cells are equal (≈ 0.74 km² hexagons), AND
 *   2. their occurredAt timestamps differ by ≤ 30 minutes, AND
 *   3. they share the same hazardType (or one of them is 'other').
 *
 * When multiple source records cluster together they are merged into a single
 * `FusedEvent` whose lineage records every contributor. The "representative"
 * fields (title, description, coords, severity, occurredAt) come from the
 * record with the highest sourceIntegrity score so the dashboard shows the
 * most authoritative summary.
 *
 * Single-source events still pass through this function — they become
 * FusedEvents with `isFused=false, sourceCount=1`.
 */
import { latLngToCell } from 'h3-js'

const H3_RES = 8                          // ≈ 0.74 km² hexagons
const WINDOW_MS = 30 * 60 * 1000         // ±30 minutes

/**
 * @param {import('../../src/types/fusion').CrisisEvent[]} events
 * @returns {import('../../src/types/fusion').FusedEvent[]}
 */
export function dedupe (events) {
  // Make sure every event has an h3Cell.
  const annotated = events.map(e => ({
    ...e,
    h3Cell: e.h3Cell ?? latLngToCell(e.lat, e.lng, H3_RES),
  }))

  // Bucket by H3 cell first — cheap pre-filter before the temporal check.
  /** @type {Map<string, typeof annotated>} */
  const byCell = new Map()
  for (const e of annotated) {
    const list = byCell.get(e.h3Cell) ?? []
    list.push(e)
    byCell.set(e.h3Cell, list)
  }

  /** @type {import('../../src/types/fusion').FusedEvent[]} */
  const fused = []

  for (const cellEvents of byCell.values()) {
    // Sort by occurredAt so the temporal window check is monotonic.
    cellEvents.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))

    /** @type {typeof annotated} */
    let cluster = []
    /** @type {number | null} */
    let clusterStart = null

    const flush = () => {
      if (cluster.length === 0) return
      fused.push(mergeCluster(cluster))
      cluster = []
      clusterStart = null
    }

    for (const e of cellEvents) {
      const ts = Date.parse(e.occurredAt)
      if (clusterStart === null) {
        cluster = [e]
        clusterStart = ts
        continue
      }
      // Same cell + within ±30min + compatible hazard → merge.
      if (ts - clusterStart <= WINDOW_MS && hazardsCompatible(cluster, e)) {
        cluster.push(e)
      } else {
        flush()
        cluster = [e]
        clusterStart = ts
      }
    }
    flush()
  }

  return fused
}

function hazardsCompatible (cluster, candidate) {
  for (const c of cluster) {
    if (c.hazardType === candidate.hazardType) return true
    if (c.hazardType === 'other' || candidate.hazardType === 'other') return true
  }
  return false
}

/**
 * @param {import('../../src/types/fusion').CrisisEvent[]} cluster
 * @returns {import('../../src/types/fusion').FusedEvent}
 */
function mergeCluster (cluster) {
  // Choose the "most authoritative" record as the representative.
  const sorted = [...cluster].sort(
    (a, b) => b.trustScore.sourceIntegrity - a.trustScore.sourceIntegrity,
  )
  const rep = sorted[0]

  // Distinct sources contributing to this fused event.
  const distinctSources = new Set(cluster.map(c => c.sourceType))

  return {
    ...rep,
    isFused: distinctSources.size > 1,
    sourceCount: distinctSources.size,
    lineage: {
      fusedFrom: cluster.map(c => ({
        sourceType: c.sourceType,
        eventId:    c.eventId,
        url:        c.url,
        detectedAt: c.detectedAt,
      })),
    },
  }
}
