/**
 * Re:Earth CMS REST API client
 *
 * Re:Earth CMS public API reference:
 *   GET  /api/projects/{project}/models/{model}/items   → list items
 *   POST /api/projects/{project}/models/{model}/items   → create item  (auth required)
 *   POST /api/projects/{project}/assets                 → upload asset (auth required)
 *
 * The public read API returns items with every field exposed as a top-level key.
 * Asset fields return the full asset object { id, url, name, contentType }.
 * Write operations expect:  { "fields": [{ "key": "...", "value": ... }] }
 */

import { CMS } from '../config'
import type { DamageReport, DamageLevel, InfraType, SubmissionChannel, TrustTier, DeploymentConfig } from '../types'
import { getTier } from '../utils/trustScore'

// ─── Deployment defaults ─────────────────────────────────────────────────────

export const DEFAULT_CONFIG: DeploymentConfig = {
  title:           'Bangkok Flood Response',
  scenario_label:  'Bangkok Flood, October 2026',
  subtitle:        'Don Mueang / Pathum Thani',
  bounds_sw_lat:   13.76,
  bounds_sw_lng:   100.49,
  bounds_ne_lat:   14.07,
  bounds_ne_lng:   100.65,
  area_center_lat: 13.9051,
  area_center_lng: 100.5988,
  area_radius_km:  25,
}

// ─── CMS response shapes ────────────────────────────────────────────────────

interface CmsAsset {
  id: string
  url: string
  name?: string
  contentType?: string
}

/**
 * Shape of one item returned by the Re:Earth CMS public API.
 * Fields are exposed as top-level keys; asset fields include the full asset object.
 */
interface CmsItem {
  id: string
  createdAt: string
  updatedAt: string
  // damage report fields ↓
  damage_level?: string
  infra_type?: string
  landmark?: string
  district?: string
  lat?: number
  lng?: number
  channel?: string
  has_c2pa?: boolean
  h3_cell?: string
  image?: CmsAsset | null
  trust_score_total?: number
  trust_score_image?: number
  trust_score_geo?: number
  trust_score_cross?: number
  trust_score_meta?: number
  tier?: string
}

interface CmsListResponse {
  results: CmsItem[]   // Re:Earth CMS public API uses "results", not "items"
  totalCount: number
}

// ─── Mapping ────────────────────────────────────────────────────────────────

function cmsItemToReport(item: CmsItem): DamageReport {
  const total          = item.trust_score_total ?? 0
  const imageIntegrity = item.trust_score_image ?? 0
  const geospatial     = item.trust_score_geo   ?? 0
  const crossReport    = item.trust_score_cross  ?? 0
  const metadata       = item.trust_score_meta   ?? 0

  return {
    // Use the last 8 hex chars of the CMS UUID as a short display ID
    id:         `CMS-${item.id.replace(/-/g, '').slice(-6).toUpperCase()}`,
    lat:        item.lat ?? 0,
    lng:        item.lng ?? 0,
    damageLevel:(item.damage_level as DamageLevel)     ?? 'minimal',
    infraType:  (item.infra_type   as InfraType)       ?? 'other',
    landmark:   item.landmark  ?? '',
    district:   item.district  ?? '',
    timestamp:  item.createdAt,
    channel:    (item.channel  as SubmissionChannel)   ?? 'browser',
    hasC2PA:    item.has_c2pa  ?? false,
    h3Cell:     item.h3_cell   ?? '',
    imageUrl:   item.image?.url ?? undefined,
    trustScore: { total, imageIntegrity, geospatial, crossReport, metadata },
    tier:       (item.tier as TrustTier) ?? getTier(total),
  }
}

// ─── Public API: read ────────────────────────────────────────────────────────

/**
 * Fetch all damage reports from Re:Earth CMS.
 * Returns [] if CMS is not configured or the request fails.
 */
export async function fetchCmsReports(): Promise<DamageReport[]> {
  if (!CMS.enabled) return []

  // Re:Earth CMS public API: /api/p/{project}/{model}
  // e.g. https://api.cms.reearth.io/api/p/verified-crisis-mapper/Demo-v1/damage-report
  // perPage=100 avoids the default 20-item page limit (seeded data alone is 28 items)
  const url = `${CMS.baseUrl}/api/p/${CMS.project}/${CMS.model}?perPage=100`

  try {
    // Public read API — no Authorization header needed (and rejected if sent)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

    const data: CmsListResponse = await res.json()
    console.info(`[CMS] fetchReports: totalCount=${data.totalCount}, returned=${data.results.length}`)
    return data.results.map(cmsItemToReport)
  } catch (err) {
    console.warn('[CMS] fetchReports failed — using mock data', err)
    return []
  }
}

// ─── Public API: deployment config ──────────────────────────────────────────

/**
 * Fetch the deployment configuration from Re:Earth CMS `deployment-config` model.
 * Returns DEFAULT_CONFIG when CMS is not configured or the fetch fails.
 */
export async function fetchDeploymentConfig(): Promise<DeploymentConfig> {
  if (!CMS.enabled) return DEFAULT_CONFIG

  // Re:Earth CMS public model alias is `deployment-config` by convention
  const url = `${CMS.baseUrl}/api/p/${CMS.project}/deployment-config`

  try {
    // Public read API — no Authorization header needed (and rejected if sent)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

    const data: { results: Array<Record<string, unknown>> } = await res.json()
    const item = data.results?.[0]
    if (!item) return DEFAULT_CONFIG

    const n = (key: string, fallback: number): number =>
      typeof item[key] === 'number' ? (item[key] as number) : fallback
    const s = (key: string, fallback: string): string =>
      typeof item[key] === 'string' ? (item[key] as string) : fallback

    return {
      title:           s('title',           DEFAULT_CONFIG.title),
      scenario_label:  s('scenario_label',  DEFAULT_CONFIG.scenario_label),
      subtitle:        s('subtitle',        DEFAULT_CONFIG.subtitle),
      bounds_sw_lat:   n('bounds_sw_lat',   DEFAULT_CONFIG.bounds_sw_lat),
      bounds_sw_lng:   n('bounds_sw_lng',   DEFAULT_CONFIG.bounds_sw_lng),
      bounds_ne_lat:   n('bounds_ne_lat',   DEFAULT_CONFIG.bounds_ne_lat),
      bounds_ne_lng:   n('bounds_ne_lng',   DEFAULT_CONFIG.bounds_ne_lng),
      area_center_lat: n('area_center_lat', DEFAULT_CONFIG.area_center_lat),
      area_center_lng: n('area_center_lng', DEFAULT_CONFIG.area_center_lng),
      area_radius_km:  n('area_radius_km',  DEFAULT_CONFIG.area_radius_km),
    }
  } catch (err) {
    console.warn('[CMS] fetchDeploymentConfig failed — using defaults', err)
    return DEFAULT_CONFIG
  }
}

// ─── Authenticated API: write ────────────────────────────────────────────────

/**
 * Upload a photo file as a CMS asset.
 * Returns the asset object (including .url) on success, null on failure.
 */
/** Split "workspace/project" alias stored in VITE_CMS_PROJECT */
function splitProject(): [string, string] {
  const parts = (CMS.project ?? '').split('/')
  return [parts[0] ?? '', parts[1] ?? '']
}

export async function uploadAsset(file: File): Promise<CmsAsset | null> {
  if (!CMS.writable) return null

  // Integration API: /api/{workspace}/projects/{project}/assets
  const [ws, proj] = splitProject()
  const url = `${CMS.baseUrl}/api/${ws}/projects/${proj}/assets`
  const body = new FormData()
  body.append('file', file)
  body.append('name', file.name || 'damage-photo.jpg')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CMS.token}` },
      signal: AbortSignal.timeout(15000),   // 15 秒でタイムアウト
      body,
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return await res.json() as CmsAsset
  } catch (err) {
    console.warn('[CMS] uploadAsset failed', err)
    return null
  }
}

/**
 * Create a damage report item in Re:Earth CMS.
 * Returns the CMS item ID on success, null on failure.
 *
 * @param report  The DamageReport to persist
 * @param assetId The CMS asset ID for the photo (from uploadAsset), if available
 */
export async function createReportItem(
  report: DamageReport,
  assetId?: string,
): Promise<string | null> {
  if (!CMS.writable) return null

  // Integration API: /api/{workspace}/projects/{project}/models/{model}/items
  const [ws, proj] = splitProject()
  const url = `${CMS.baseUrl}/api/${ws}/projects/${proj}/models/${CMS.model}/items`

  // Re:Earth CMS write API expects an array of { key, value } field objects
  const fields: Array<{ key: string; value: unknown }> = [
    { key: 'damage_level',       value: report.damageLevel },
    { key: 'infra_type',         value: report.infraType },
    { key: 'landmark',           value: report.landmark },
    { key: 'district',           value: report.district },
    { key: 'lat',                value: report.lat },
    { key: 'lng',                value: report.lng },
    { key: 'channel',            value: report.channel },
    { key: 'has_c2pa',           value: report.hasC2PA },
    { key: 'h3_cell',            value: report.h3Cell },
    { key: 'tier',               value: report.tier },
    { key: 'trust_score_total',  value: report.trustScore.total },
    { key: 'trust_score_image',  value: report.trustScore.imageIntegrity },
    { key: 'trust_score_geo',    value: report.trustScore.geospatial },
    { key: 'trust_score_cross',  value: report.trustScore.crossReport },
    { key: 'trust_score_meta',   value: report.trustScore.metadata },
  ]

  if (assetId) {
    fields.push({ key: 'image', value: assetId })
  }

  try {
    // Step 1: Create the item
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${CMS.token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ fields }),
    })
    console.info(`[CMS] create → ${res.status}, content-length: ${res.headers.get('content-length')}, location: ${res.headers.get('location')}`)

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.warn(`[CMS] createReportItem ${res.status}:`, errBody)
      throw new Error(`${res.status} ${res.statusText}`)
    }

    // Try to extract item ID from response body or Location header
    let itemId: string | null = null

    // Try Location header first (e.g. "Location: /api/.../items/xxxx")
    const location = res.headers.get('location')
    if (location) {
      const m = location.match(/items\/([^/?]+)/)
      if (m) itemId = m[1]
    }

    // Try response body
    if (!itemId && res.status !== 204) {
      const text = await res.text().catch(() => '')
      console.info('[CMS] create body:', text.slice(0, 200))
      if (text) {
        try {
          const data = JSON.parse(text) as { id?: string }
          itemId = data.id ?? null
        } catch { /* ignore parse errors */ }
      }
    }

    // Fallback: fetch the newest item from Integration API to get its ID
    if (!itemId) {
      console.info('[CMS] no ID in response — fetching newest item to publish')
      await new Promise(r => setTimeout(r, 800))
      const listRes = await fetch(`${url}?perPage=1`, {
        headers: { Authorization: `Bearer ${CMS.token}` },
        signal: AbortSignal.timeout(10000),
      })
      if (listRes.ok) {
        const listData = await listRes.json() as { items?: {id:string}[], results?: {id:string}[], totalCount?: number }
        console.info('[CMS] list response keys:', Object.keys(listData), 'totalCount:', listData.totalCount)
        itemId = listData.items?.[0]?.id ?? listData.results?.[0]?.id ?? null
      }
    }

    console.info('[CMS] itemId to publish:', itemId)

    // Step 2: Publish via PATCH — try both URL patterns
    if (itemId) {
      // Pattern A: .../models/{model}/items/{id}
      const publishUrlA = `${CMS.baseUrl}/api/${ws}/projects/${proj}/models/${CMS.model}/items/${itemId}`
      // Pattern B: .../items/{id}  (no model segment)
      const publishUrlB = `${CMS.baseUrl}/api/${ws}/projects/${proj}/items/${itemId}`

      for (const pUrl of [publishUrlA, publishUrlB]) {
        const pubRes = await fetch(pUrl, {
          method: 'PATCH',
          headers: {
            Authorization:  `Bearer ${CMS.token}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({ status: 'public' }),
        })
        console.info(`[CMS] PATCH ${pUrl.split('/api/')[1]} → ${pubRes.status}`)
        if (pubRes.ok) {
          console.info('[CMS] item published ✓', itemId)
          break
        }
        const errBody = await pubRes.text().catch(() => '')
        console.warn(`[CMS] publish attempt failed ${pubRes.status}:`, errBody.slice(0, 100))
      }
    }

    return itemId ?? 'created'
  } catch (err) {
    console.warn('[CMS] createReportItem failed', err)
    return null
  }
}
