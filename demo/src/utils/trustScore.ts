import type { TrustScoreBreakdown, TrustTier } from '../types'

export function getTier(score: number): TrustTier {
  if (score >= 80) return 'green'
  if (score >= 50) return 'amber'
  return 'red'
}

export function getTierLabel(tier: TrustTier): string {
  switch (tier) {
    case 'green': return 'High Trust'
    case 'amber': return 'Under Review'
    case 'red': return 'Human Review Required'
  }
}

export function getTierDescription(tier: TrustTier): string {
  switch (tier) {
    case 'green': return 'Report verified — displayed on live map'
    case 'amber': return 'Flagged for review — displayed with caution marker'
    case 'red': return 'Held for human review — not displayed on public map'
  }
}

// Simulate trust score calculation for a new submission
export function calculateDemoTrustScore(params: {
  hasPhoto: boolean
  hasGps: boolean
  gpsAccuracy: number   // metres
  channel: 'pwa' | 'browser' | 'whatsapp'
  isInArea?: boolean    // false → geospatial score forced to 0
  hasC2PA?: boolean     // C2PA content credentials present → +12 bonus
  aiAuthentic?: boolean // false → AI flagged as suspicious → -8 penalty
}): TrustScoreBreakdown {
  const {
    hasPhoto, hasGps, gpsAccuracy, channel,
    isInArea = true, hasC2PA = false, aiAuthentic = true,
  } = params

  // Image Integrity (0–40)
  let imageIntegrity = 0
  if (hasPhoto) {
    imageIntegrity = 20                                  // base: photo present
    if (hasC2PA)                  imageIntegrity += 12  // C2PA content credentials verified
    else if (channel !== 'whatsapp') imageIntegrity += 6 // no C2PA but EXIF metadata intact
    if (gpsAccuracy < 20)         imageIntegrity += 4   // high-accuracy GPS bonus
    if (!aiAuthentic)             imageIntegrity = Math.max(0, imageIntegrity - 8) // AI flagged
  }

  // Geospatial Consistency (0–30): 0 when GPS coords are outside the allowed area
  const geospatial = !isInArea ? 0 : hasGps ? 24 : 10

  // Cross-Report Validation (0–20): neutral during sparse phase
  const crossReport = 14

  // Submission Metadata (0–10)
  let metadata = 5
  if (channel === 'pwa') metadata = 9
  else if (channel === 'browser') metadata = 7

  const total = imageIntegrity + geospatial + crossReport + metadata

  return { imageIntegrity, geospatial, crossReport, metadata, total }
}
