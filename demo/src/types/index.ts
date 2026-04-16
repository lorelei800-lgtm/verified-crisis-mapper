export type DamageLevel = 'minimal' | 'partial' | 'destroyed'
export type InfraType =
  | 'residential'
  | 'commercial'
  | 'government'
  | 'utility'
  | 'transport'
  | 'community'
  | 'public_space'
  | 'other'
export type TrustTier = 'green' | 'amber' | 'red'
export type SubmissionChannel = 'pwa' | 'browser' | 'whatsapp'

export interface TrustScoreBreakdown {
  imageIntegrity: number   // 0–40
  geospatial: number       // 0–30
  crossReport: number      // 0–20
  metadata: number         // 0–10
  total: number            // 0–100
}

export interface DamageReport {
  id: string
  cmsId?: string      // original CMS UUID — used for write-back operations
  lat: number
  lng: number
  damageLevel: DamageLevel
  infraType: InfraType
  landmark: string
  district: string
  timestamp: string        // ISO 8601
  channel: SubmissionChannel
  trustScore: TrustScoreBreakdown
  tier: TrustTier
  imageUrl?: string        // placeholder thumbnail
  h3Cell: string           // H3 resolution 9 cell index
  hasC2PA: boolean
}

/**
 * Deployment configuration fetched from Re:Earth CMS `deployment-config` model.
 * Controls the app title, map bounds, and allowed reporting area.
 * Falls back to hardcoded defaults when CMS is not configured.
 */
export interface DeploymentConfig {
  // Display strings
  title:          string   // e.g. "Bangkok Flood Response"
  scenario_label: string   // e.g. "Bangkok Flood, October 2026"
  subtitle:       string   // e.g. "Don Mueang / Pathum Thani"
  // Map initial view bounds
  bounds_sw_lat:  number
  bounds_sw_lng:  number
  bounds_ne_lat:  number
  bounds_ne_lng:  number
  // Allowed reporting area (centre + radius)
  area_center_lat: number
  area_center_lng: number
  area_radius_km:  number  // reports outside this radius get geo score = 0
}

export type ReviewStatus = 'approved' | 'rejected'
export type ReviewMap = Record<string, ReviewStatus>

export interface H3CellSummary {
  h3Index: string
  reports: DamageReport[]
  avgTrust: number
  dominantDamage: DamageLevel
}
