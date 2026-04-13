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

export interface H3CellSummary {
  h3Index: string
  reports: DamageReport[]
  avgTrust: number
  dominantDamage: DamageLevel
}
