import { useEffect, useRef, useState, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { mockReports } from '../data/mockReports'
import { fetchCmsReports } from '../services/cmsApi'
import { CMS } from '../config'
import type { DamageReport, TrustTier } from '../types'
import { tierColors, damageLevelLabel, infraTypeLabel, channelLabel } from '../utils/trustColors'
import { getTierLabel } from '../utils/trustScore'

interface Props {
  submittedReports?: DamageReport[]
}

// Bangkok flood area bounds
const BOUNDS: maplibregl.LngLatBoundsLike = [
  [100.49, 13.76],  // SW
  [100.65, 14.07],  // NE
]

export default function DashboardView({ submittedReports = [] }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const markersRef   = useRef<maplibregl.Marker[]>([])

  const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null)
  const [tierFilter, setTierFilter]         = useState<TrustTier | 'all'>('all')

  // CMS fetch state
  const [cmsReports, setCmsReports] = useState<DamageReport[] | null>(null)  // null = loading
  const [cmsError,   setCmsError]   = useState<string | null>(null)

  // On mount: fetch from CMS. Fall back to mock data when CMS is not configured or fails.
  useEffect(() => {
    if (!CMS.enabled) {
      setCmsReports(null)   // skip loading state — just use mock immediately
      return
    }
    fetchCmsReports()
      .then(reports => setCmsReports(reports))
      .catch(err => {
        console.error('[Dashboard] CMS fetch error', err)
        setCmsError('Could not load CMS data')
        setCmsReports([])
      })
  }, [])

  // Re-fetch CMS reports when a new session submission arrives (so CMS view stays current)
  const prevSubmittedCount = useRef(0)
  useEffect(() => {
    if (!CMS.enabled) return
    if (submittedReports.length > prevSubmittedCount.current) {
      prevSubmittedCount.current = submittedReports.length
      fetchCmsReports()
        .then(reports => setCmsReports(reports))
        .catch(() => {/* keep existing data */})
    }
  }, [submittedReports.length])

  /**
   * Base reports:
   *   - CMS configured + loaded → use CMS data (real persistent records)
   *   - CMS not configured OR loading → use mock data (demo baseline)
   */
  const baseReports = useMemo((): DamageReport[] => {
    if (CMS.enabled && cmsReports !== null) return cmsReports
    return mockReports
  }, [cmsReports])

  /**
   * Merge: session submissions first (shown with ★ badge),
   * then deduplicate against base so a CMS-echoed record doesn't appear twice.
   */
  const allReports = useMemo(() => {
    const sessionIds = new Set(submittedReports.map(r => r.id))
    const dedupedBase = baseReports.filter(r => !sessionIds.has(r.id))
    return [...submittedReports, ...dedupedBase]
  }, [submittedReports, baseReports])

  const stats = useMemo(() => ({
    green: allReports.filter(r => r.tier === 'green').length,
    amber: allReports.filter(r => r.tier === 'amber').length,
    red:   allReports.filter(r => r.tier === 'red').length,
  }), [allReports])

  const tierFilters = useMemo(() => [
    { label: `All (${allReports.length})`, tier: 'all' as const },
    { label: `Green (${stats.green})`,     tier: 'green' as const },
    { label: `Amber (${stats.amber})`,     tier: 'amber' as const },
    { label: `Red (${stats.red})`,         tier: 'red' as const },
  ], [allReports.length, stats])

  const filteredReports = useMemo(
    () => tierFilter === 'all' ? allReports : allReports.filter(r => r.tier === tierFilter),
    [allReports, tierFilter]
  )

  // ── Map initialisation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'esri-satellite': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
            maxzoom: 18,
          },
        },
        layers: [{ id: 'esri-satellite', type: 'raster', source: 'esri-satellite' }],
      },
      bounds: BOUNDS,
      fitBoundsOptions: { padding: 40 },
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current = map

    map.on('load', () => addMarkers(map, allReports))

    return () => {
      markersRef.current.forEach(m => m.remove())
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render markers when filter or report list changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.loaded()) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    addMarkers(map, filteredReports)
  }, [filteredReports])

  function addMarkers(map: maplibregl.Map, reports: DamageReport[]) {
    reports.forEach(report => {
      const color = tierColors[report.tier].hex
      const isNew = submittedReports.some(r => r.id === report.id)

      const el = document.createElement('div')
      el.style.cssText = `
        width: ${isNew ? '26px' : '22px'}; height: ${isNew ? '26px' : '22px'};
        border-radius: 50%;
        background: ${color};
        border: ${isNew ? '3px solid white' : '2.5px solid white'};
        box-shadow: ${isNew ? `0 0 0 2px ${color}, 0 4px 8px rgba(0,0,0,0.4)` : '0 2px 6px rgba(0,0,0,0.35)'};
        cursor: pointer;
      `
      el.addEventListener('mouseenter', () => {
        el.style.boxShadow = `0 0 0 3px white, 0 0 0 6px ${color}`
      })
      el.addEventListener('mouseleave', () => {
        el.style.boxShadow = isNew
          ? `0 0 0 2px ${color}, 0 4px 8px rgba(0,0,0,0.4)`
          : '0 2px 6px rgba(0,0,0,0.35)'
      })
      el.addEventListener('click', () => setSelectedReport(report))

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([report.lng, report.lat])
        .addTo(map)

      markersRef.current.push(marker)
    })
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  const isLoading = CMS.enabled && cmsReports === null

  return (
    <div className="flex-1 flex flex-col lg:flex-row" style={{ minHeight: 0 }}>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <div className="lg:w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">

        {/* Stats header */}
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">Bangkok Flood Response</h2>
            {/* CMS status badge */}
            {CMS.enabled ? (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                isLoading             ? 'bg-gray-100 text-gray-400'
                : cmsError            ? 'bg-red-50 text-red-500'
                : 'bg-blue-50 text-blue-600'
              }`}>
                {isLoading ? '⟳ CMS' : cmsError ? '⚠ CMS' : '● CMS'}
              </span>
            ) : (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
                Demo data
              </span>
            )}
          </div>

          {submittedReports.length > 0 && (
            <div className="mb-2 text-xs bg-green-50 border border-green-200 rounded px-2 py-1 text-green-700">
              +{submittedReports.length} report{submittedReports.length > 1 ? 's' : ''} submitted this session
            </div>
          )}

          {cmsError && (
            <div className="mb-2 text-xs bg-red-50 border border-red-200 rounded px-2 py-1 text-red-600">
              {cmsError} — showing demo data
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {(['green', 'amber', 'red'] as TrustTier[]).map(tier => (
                <div key={tier} className="rounded-lg p-2 text-center bg-gray-50 animate-pulse">
                  <div className="text-lg font-bold text-gray-300">—</div>
                  <div className="text-xs text-gray-300">{getTierLabel(tier)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {(['green', 'amber', 'red'] as TrustTier[]).map(tier => (
                <div key={tier} className={`rounded-lg p-2 text-center ${tierColors[tier].bg}`}>
                  <div className={`text-lg font-bold ${tierColors[tier].text}`}>{stats[tier]}</div>
                  <div className={`text-xs ${tierColors[tier].text} opacity-80`}>{getTierLabel(tier)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filter */}
        <div className="p-3 border-b border-gray-100">
          <div className="flex gap-1 flex-wrap">
            {tierFilters.map(f => (
              <button key={f.tier} onClick={() => setTierFilter(f.tier)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  tierFilter === f.tier
                    ? f.tier === 'all'   ? 'bg-gray-700 text-white'
                      : f.tier === 'green' ? 'bg-green-600 text-white'
                      : f.tier === 'amber' ? 'bg-amber-500 text-white'
                      : 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Report list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            // Skeleton rows while CMS is loading
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-3 py-2.5 border-b border-gray-100 animate-pulse">
                <div className="flex items-start gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-200 mt-0.5 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))
          ) : (
            filteredReports.map(report => {
              const isNew = submittedReports.some(r => r.id === report.id)
              return (
                <button key={report.id}
                  onClick={() => {
                    setSelectedReport(report)
                    mapRef.current?.flyTo({ center: [report.lng, report.lat], zoom: 14 })
                  }}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedReport?.id === report.id ? 'bg-blue-50' : isNew ? 'bg-green-50' : ''
                  }`}>
                  <div className="flex items-start gap-2">
                    <div className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                      style={{ backgroundColor: tierColors[report.tier].hex }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-gray-800 truncate">
                          {report.id} {isNew && <span className="text-green-600">★ New</span>}
                        </span>
                        <span className="text-xs font-bold" style={{ color: tierColors[report.tier].hex }}>
                          {report.trustScore.total}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {report.district} · {damageLevelLabel[report.damageLevel]}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{report.landmark}</div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Map ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative" style={{ minHeight: '400px', minWidth: 0 }}>
        <div ref={mapContainer}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} />

        {/* Legend */}
        <div className="absolute bottom-6 left-3 bg-white bg-opacity-95 rounded-lg shadow-md p-2 text-xs">
          <div className="font-semibold text-gray-700 mb-1">Trust Score</div>
          {(['green', 'amber', 'red'] as TrustTier[]).map(tier => (
            <div key={tier} className="flex items-center gap-1.5 py-0.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tierColors[tier].hex }} />
              <span className="text-gray-600">
                {tier === 'green' ? '≥80 High Trust' : tier === 'amber' ? '50–79 Review' : '<50 Human Review'}
              </span>
            </div>
          ))}
        </div>

        {/* Selected report popup */}
        {selectedReport && (
          <div className="absolute top-3 right-3 bg-white rounded-xl shadow-lg w-64 overflow-hidden border border-gray-200">
            {/* Header */}
            <div className={`px-3 py-2 flex items-center justify-between ${tierColors[selectedReport.tier].bg}`}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center"
                  style={{ backgroundColor: tierColors[selectedReport.tier].hex }}>
                  {selectedReport.trustScore.total}
                </div>
                <span className={`text-xs font-semibold ${tierColors[selectedReport.tier].text}`}>
                  {selectedReport.id} · {getTierLabel(selectedReport.tier)}
                </span>
              </div>
              <button onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>

            {/* Photo — stable CMS asset URL or local blob URL from form submission */}
            {selectedReport.imageUrl && (
              <img
                src={selectedReport.imageUrl}
                alt="damage photo"
                className="w-full h-36 object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}

            {/* Body */}
            <div className="p-3 space-y-1.5 text-xs">
              <InfoRow label="District" value={selectedReport.district} />
              <InfoRow label="Damage"   value={damageLevelLabel[selectedReport.damageLevel]} />
              <InfoRow label="Type"     value={infraTypeLabel[selectedReport.infraType]} />
              <InfoRow label="Channel"  value={channelLabel[selectedReport.channel]} />
              <InfoRow label="C2PA"     value={selectedReport.hasC2PA ? 'Verified ✓' : 'Not available'} />
              <div className="pt-1 border-t border-gray-100">
                <p className="text-gray-500 italic truncate">{selectedReport.landmark}</p>
              </div>
              <div className="pt-1 space-y-1">
                <MiniBar label="Image" value={selectedReport.trustScore.imageIntegrity} max={40} color={tierColors[selectedReport.tier].hex} />
                <MiniBar label="Geo"   value={selectedReport.trustScore.geospatial}     max={30} color={tierColors[selectedReport.tier].hex} />
                <MiniBar label="Cross" value={selectedReport.trustScore.crossReport}    max={20} color={tierColors[selectedReport.tier].hex} />
                <MiniBar label="Meta"  value={selectedReport.trustScore.metadata}       max={10} color={tierColors[selectedReport.tier].hex} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <span className="text-gray-400 w-14 shrink-0">{label}</span>
      <span className="text-gray-700 font-medium">{value}</span>
    </div>
  )
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-400 w-8 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div className="h-1.5 rounded-full" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-gray-500 w-8 text-right">{value}/{max}</span>
    </div>
  )
}
