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
import type { DamageReport, DamageLevel, InfraType, SubmissionChannel, TrustTier } from '../types'
import { getTier } from '../utils/trustScore'

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
  const url = `${CMS.baseUrl}/api/p/${CMS.project}/${CMS.model}`

  try {
    const headers: HeadersInit = {}
    if (CMS.token) headers['Authorization'] = `Bearer ${CMS.token}`

    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

    const data: CmsListResponse = await res.json()
    return data.results.map(cmsItemToReport)
  } catch (err) {
    console.warn('[CMS] fetchReports failed — using mock data', err)
    return []
  }
}

// ─── Authenticated API: write ────────────────────────────────────────────────

/**
 * Upload a photo file as a CMS asset.
 * Returns the asset object (including .url) on success, null on failure.
 */
export async function uploadAsset(file: File): Promise<CmsAsset | null> {
  if (!CMS.writable) return null

  // Assets endpoint: /api/p/{project}/assets
  const url = `${CMS.baseUrl}/api/p/${CMS.project}/assets`
  const body = new FormData()
  body.append('file', file)
  body.append('name', file.name || 'damage-photo.jpg')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CMS.token}` },
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

  // Item create endpoint: POST /api/p/{project}/{model}
  const url = `${CMS.baseUrl}/api/p/${CMS.project}/${CMS.model}`

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
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${CMS.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const data = await res.json() as { id: string }
    return data.id
  } catch (err) {
    console.warn('[CMS] createReportItem failed', err)
    return null
  }
}
