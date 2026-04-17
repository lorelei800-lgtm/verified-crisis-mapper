import { useEffect, useRef, useState, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { mockReports } from '../data/mockReports'
import { CMS } from '../config'
import type { DamageReport, TrustTier, DeploymentConfig, ReviewMap, InfraType } from '../types'
import { tierColors, damageLevelLabel, infraTypeLabel, channelLabel } from '../utils/trustColors'
import { getTierLabel } from '../utils/trustScore'
import { isWithinArea } from '../utils/geo'

interface Props {
  config: DeploymentConfig
  submittedReports?: DamageReport[]
  newReportIds?: Set<string>
  reviewMap?: ReviewMap
  // CMS data owned by App.tsx — single polling source to prevent double-refresh white screen
  cmsReports?: DamageReport[] | null
  isCmsLoading?: boolean
  cmsFetchError?: string | null
  onRefresh?: () => void
  /** Called when user taps "Open Form" on a map-placed pin — navigates to ReporterView with coords */
  onMapReport?: (lat: number, lng: number) => void
  /** All available scenarios — if >1, a switcher appears inside the dashboard */
  scenarios?: DeploymentConfig[]
  activeScenarioIdx?: number
  onScenarioChange?: (idx: number) => void
}

export default function DashboardView({
  config,
  submittedReports = [],
  newReportIds = new Set(),
  reviewMap = {},
  cmsReports = null,
  isCmsLoading = false,
  cmsFetchError = null,
  onRefresh,
  onMapReport,
  scenarios,
  activeScenarioIdx = 0,
  onScenarioChange,
}: Props) {
  const mapContainer       = useRef<HTMLDivElement>(null)
  const mapRef             = useRef<maplibregl.Map | null>(null)
  const filteredReportsRef = useRef<DamageReport[]>([])
  const hasAutoFocusedRef  = useRef(false)
  const touchStartY    = useRef(0)
  const mobileListRef  = useRef<HTMLDivElement>(null)

  const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null)
  const [tierFilter,     setTierFilter]     = useState<TrustTier | 'all'>('all')
  const [sortBy,         setSortBy]         = useState<'time' | 'score'>('time')
  const [infraFilter,    setInfraFilter]    = useState<InfraType | 'all'>('all')
  const [mapReady,       setMapReady]       = useState(false)
  const [mobileListOpen, setMobileListOpen] = useState(true)
  const [statsOpen,      setStatsOpen]      = useState(true)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  /** Coordinates of a map-click pin — shown as "Report here?" strip until dismissed */
  const [mapReportPin, setMapReportPin] = useState<{ lat: number; lng: number } | null>(null)
  /** True when a layer-specific click (cluster/point) consumed the current click — prevents empty-area handler from also firing */
  const mapTapConsumedRef = useRef(false)

  // ── Data ──────────────────────────────────────────────────────────────────
  const baseReports = useMemo((): DamageReport[] => {
    if (CMS.enabled && cmsReports !== null) return cmsReports
    return mockReports
  }, [cmsReports])

  const allReports = useMemo(() => {
    const sessionIds = new Set(submittedReports.map(r => r.id))
    return [...submittedReports, ...baseReports.filter(r => !sessionIds.has(r.id))]
  }, [submittedReports, baseReports])

  const visibleReports = useMemo(
    () => allReports.filter(r => reviewMap[r.id] !== 'rejected'),
    [allReports, reviewMap]
  )

  const stats = useMemo(() => ({
    green: visibleReports.filter(r => r.tier === 'green').length,
    amber: visibleReports.filter(r => r.tier === 'amber').length,
    red:   visibleReports.filter(r => r.tier === 'red').length,
  }), [visibleReports])

  const tierFilters = useMemo(() => [
    { label: `All (${visibleReports.length})`, tier: 'all' as const },
    { label: `Green (${stats.green})`,         tier: 'green' as const },
    { label: `Amber (${stats.amber})`,         tier: 'amber' as const },
    { label: `Red (${stats.red})`,             tier: 'red' as const },
  ], [visibleReports.length, stats])

  const filteredReports = useMemo(() => {
    let base = tierFilter === 'all' ? visibleReports : visibleReports.filter(r => r.tier === tierFilter)
    if (infraFilter !== 'all') base = base.filter(r => r.infraType === infraFilter)
    return [...base].sort((a, b) =>
      sortBy === 'score'
        ? b.trustScore.total - a.trustScore.total
        : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }, [visibleReports, tierFilter, sortBy, infraFilter])

  // Keep ref in sync so map click handlers always see the current list
  filteredReportsRef.current = filteredReports

  const isLoading = CMS.enabled && isCmsLoading && cmsReports === null

  const dmgLabel = useMemo(() => ({
    minimal:   config.label_damage_minimal   ?? damageLevelLabel.minimal,
    partial:   config.label_damage_partial   ?? damageLevelLabel.partial,
    destroyed: config.label_damage_destroyed ?? damageLevelLabel.destroyed,
  }), [config])

  // Pull-to-refresh for mobile list
  useEffect(() => {
    const el = mobileListRef.current
    if (!el || !onRefresh) return
    const onStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY }
    const onEnd   = (e: TouchEvent) => {
      const dy = e.changedTouches[0].clientY - touchStartY.current
      if (dy > 64 && el.scrollTop <= 0) {
        setIsPullRefreshing(true)
        onRefresh()
        setTimeout(() => setIsPullRefreshing(false), 1500)
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend',   onEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend',   onEnd)
    }
  }, [onRefresh]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Map init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    const bounds: maplibregl.LngLatBoundsLike = [
      [config.bounds_sw_lng, config.bounds_sw_lat],
      [config.bounds_ne_lng, config.bounds_ne_lat],
    ]
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'esri-satellite': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
            maxzoom: 18,
          },
        },
        layers: [{ id: 'esri-satellite', type: 'raster', source: 'esri-satellite' }],
      },
      bounds,
      fitBoundsOptions: { padding: 40 },
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current = map
    map.on('load', () => {
      setMapReady(true)
      // Crosshair hints to the user that clicking an empty area places a report pin
      map.getCanvas().style.cursor = 'crosshair'
    })
    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fit bounds when config changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    map.fitBounds(
      [[config.bounds_sw_lng, config.bounds_sw_lat], [config.bounds_ne_lng, config.bounds_ne_lat]],
      { padding: 40, duration: 800 }
    )
  }, [config, mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus newest submitted report once when map first becomes ready
  useEffect(() => {
    if (!mapReady || !mapRef.current || hasAutoFocusedRef.current) return
    if (newReportIds.size === 0) return
    const report = allReports.find(r => newReportIds.has(r.id))
    if (!report) return
    hasAutoFocusedRef.current = true
    setTimeout(() => {
      mapRef.current?.flyTo({ center: [report.lng, report.lat], zoom: 15 })
      setSelectedReport(report)
    }, 400)
  }, [mapReady, allReports]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── GeoJSON source + cluster layers ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return

    const features = filteredReports.map(report => ({
      type: 'Feature' as const,
      properties: {
        id:     report.id,
        color:  tierColors[report.tier].hex,
        status: reviewMap[report.id] === 'approved' ? 'approved' : 'pending',
      },
      geometry: { type: 'Point' as const, coordinates: [report.lng, report.lat] },
    }))
    const geojson = { type: 'FeatureCollection' as const, features }

    // Update-only path — source already exists
    const src = map.getSource('reports') as maplibregl.GeoJSONSource | undefined
    if (src) { src.setData(geojson); return }

    // First-time setup: source + layers + event handlers
    map.addSource('reports', {
      type: 'geojson', data: geojson,
      cluster: true, clusterMaxZoom: 12, clusterRadius: 45,
    })

    map.addLayer({
      id: 'clusters', type: 'circle', source: 'reports',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['step', ['get', 'point_count'], '#60a5fa', 5, '#3b82f6', 15, '#1d4ed8'],
        'circle-radius': ['step', ['get', 'point_count'], 16, 5, 22, 15, 28],
        'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff',
      },
    })

    map.addLayer({
      id: 'cluster-count', type: 'symbol', source: 'reports',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}', 'text-size': 11,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: { 'text-color': '#ffffff' },
    })

    map.addLayer({
      id: 'points', type: 'circle', source: 'reports',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['case', ['==', ['get', 'status'], 'approved'], ['get', 'color'], 'rgba(255,255,255,0.08)'],
        'circle-radius': 10,
        'circle-stroke-width': ['case', ['==', ['get', 'status'], 'approved'], 2.5, 2],
        'circle-stroke-color': ['get', 'color'],
        'circle-opacity': ['case', ['==', ['get', 'status'], 'pending'], 0.6, 1.0],
        'circle-stroke-opacity': ['case', ['==', ['get', 'status'], 'pending'], 0.75, 1.0],
      },
    })

    // ── Touch tap detection (Android Chrome fix) ─────────────────────────
    // MapLibre's synthetic 'click' from touch is unreliable on Android.
    // We listen to MapLibre's own touchstart/touchend, wait 80ms for any
    // layer-specific click events to fire, then place the pin only if none did.
    let touchStartX = 0, touchStartY = 0
    let layerConsumed = false  // set by layer click handlers; read by touchend timeout

    map.on('touchstart', (e) => {
      if (e.originalEvent.touches.length === 1) {
        touchStartX = e.originalEvent.touches[0].clientX
        touchStartY = e.originalEvent.touches[0].clientY
      } else {
        touchStartX = -9999  // multi-touch (pinch zoom) — disqualify
      }
    })

    map.on('touchend', (e) => {
      if (e.originalEvent.changedTouches.length !== 1) return
      const t = e.originalEvent.changedTouches[0]
      const dx = t.clientX - touchStartX
      const dy = t.clientY - touchStartY
      if (dx * dx + dy * dy > 144) return  // moved >12px — was a pan gesture
      layerConsumed = false                // reset; layer click may set it before timeout fires
      const pos = e.lngLat                 // capture now; e is recycled by the time timeout runs
      setTimeout(() => {
        // layerConsumed: a MapLibre layer-click fired after this touchend
        // mapTapConsumedRef: the general click handler already consumed a layer hit
        if (layerConsumed || mapTapConsumedRef.current) {
          mapTapConsumedRef.current = false
          layerConsumed = false
          return
        }
        setMapReportPin({ lat: pos.lat, lng: pos.lng })
        setSelectedReport(null)
        setMobileListOpen(false)
      }, 80)
    })

    map.on('click', 'clusters', async (e) => {
      mapTapConsumedRef.current = true   // mark consumed so general handler skips
      layerConsumed = true               // mark for touchend timeout
      const feats = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
      if (!feats.length) return
      const clusterId = feats[0].properties!.cluster_id as number
      const coords = (feats[0].geometry as unknown as { coordinates: [number, number] }).coordinates
      try {
        const zoom = await (map.getSource('reports') as maplibregl.GeoJSONSource).getClusterExpansionZoom(clusterId)
        map.easeTo({ center: coords, zoom })
      } catch { /* ignore */ }
    })

    map.on('click', 'points', (e) => {
      mapTapConsumedRef.current = true   // mark consumed so general handler skips
      layerConsumed = true               // mark for touchend timeout
      const feats = map.queryRenderedFeatures(e.point, { layers: ['points'] })
      if (!feats.length) return
      const id = feats[0].properties!.id as string
      const report = filteredReportsRef.current.find(r => r.id === id)
      if (report) {
        setSelectedReport(report)
        setMobileListOpen(false)
        setMapReportPin(null)
      }
    })

    // Empty-area click — offer to file a new report at this location.
    // Uses a consumed-flag instead of queryRenderedFeatures to work reliably on Android
    // (queryRenderedFeatures uses a wider hit radius on touch which can mask empty taps).
    map.on('click', (e) => {
      if (mapTapConsumedRef.current) { mapTapConsumedRef.current = false; return }
      setMapReportPin({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      setSelectedReport(null)
      setMobileListOpen(false)
    })

    map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = 'crosshair' })
    map.on('mouseenter', 'points',   () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'points',   () => { map.getCanvas().style.cursor = 'crosshair' })
  }, [filteredReports, mapReady, reviewMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col lg:flex-row" style={{ minHeight: 0 }}>

      {/* ════════════ DESKTOP SIDEBAR ════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-80 bg-white border-r border-gray-200 flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-100">
          {/* Scenario switcher — only when multiple scenarios exist */}
          {scenarios && scenarios.length > 1 && onScenarioChange && (
            <div className="mb-2">
              <label className="text-[10px] text-gray-400 font-medium block mb-0.5">Scenario</label>
              <select
                value={activeScenarioIdx}
                onChange={e => onScenarioChange(+e.target.value)}
                className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {scenarios.map((s, i) => (
                  <option key={i} value={i}>{s.title}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">{config.title}</h2>
            <div className="flex items-center gap-1.5">
              <CmsBadge isLoading={isLoading} cmsError={cmsFetchError} />
              {CMS.enabled && (
                <button onClick={onRefresh} title="Refresh" disabled={isCmsLoading}
                  className="text-gray-400 hover:text-blue-600 transition-colors p-0.5 disabled:opacity-50">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${isCmsLoading ? 'animate-spin text-blue-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          {!CMS.enabled && (
            <div className="mb-2 text-[10px] bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-700">⚠ Demo mode — not connected to Re:Earth CMS</div>
          )}
          {submittedReports.length > 0 && (
            <div className="mb-2 text-xs bg-green-50 border border-green-200 rounded px-2 py-1 text-green-700">
              +{submittedReports.length} report{submittedReports.length > 1 ? 's' : ''} this session
            </div>
          )}
          {cmsFetchError && <div className="mb-2 text-xs bg-red-50 border border-red-200 rounded px-2 py-1 text-red-600">{cmsFetchError} — showing demo data</div>}
          {isLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {(['green','amber','red'] as TrustTier[]).map(t => (
                <div key={t} className="rounded-lg p-2 text-center bg-gray-50 animate-pulse">
                  <div className="text-lg font-bold text-gray-300">—</div>
                  <div className="text-xs text-gray-300">{getTierLabel(t)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {(['green','amber','red'] as TrustTier[]).map(t => (
                <div key={t} className={`rounded-lg p-2 text-center ${tierColors[t].bg}`}>
                  <div className={`text-lg font-bold ${tierColors[t].text}`}>{stats[t]}</div>
                  <div className={`text-xs ${tierColors[t].text} opacity-80`}>{getTierLabel(t)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tier filter + sort */}
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="flex gap-1 flex-wrap">
            {tierFilters.map(f => (
              <button key={f.tier} onClick={() => setTierFilter(f.tier)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  tierFilter === f.tier
                    ? f.tier==='all' ? 'bg-gray-700 text-white' : f.tier==='green' ? 'bg-green-600 text-white' : f.tier==='amber' ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>{f.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 shrink-0">Sort:</span>
            {([['time', 'Newest'], ['score', 'Score ↓']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setSortBy(key)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  sortBy === key ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>{label}</button>
            ))}
          </div>
        </div>

        {/* Infra type filter */}
        <div className="px-3 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[10px] text-gray-400">Type:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setInfraFilter('all')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${infraFilter === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              All
            </button>
            {(Object.entries(infraTypeLabel) as [InfraType, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setInfraFilter(key)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${infraFilter === key ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? Array.from({length:6}).map((_,i) => (
            <div key={i} className="px-3 py-2.5 border-b border-gray-100 animate-pulse">
              <div className="flex items-start gap-2"><div className="w-3 h-3 rounded-full bg-gray-200 mt-0.5 shrink-0"/><div className="flex-1 space-y-1.5"><div className="h-3 bg-gray-200 rounded w-3/4"/><div className="h-2.5 bg-gray-100 rounded w-1/2"/></div></div>
            </div>
          )) : !isLoading && filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
              <div className="text-4xl">📭</div>
              <p className="text-sm font-semibold text-gray-600">
                {CMS.enabled ? 'No reports yet' : 'Demo data hidden by filters'}
              </p>
              <p className="text-xs text-gray-400">
                {CMS.enabled
                  ? 'Be the first to submit a damage report'
                  : 'Clear filters to see all demo reports'}
              </p>
            </div>
          ) : filteredReports.map(report => {
            const isNew     = newReportIds.has(report.id)
            const inArea    = isWithinArea(report.lat, report.lng, config.area_center_lat, config.area_center_lng, config.area_radius_km)
            const reviewed  = reviewMap[report.id]
            const isPending = !reviewed
            return (
              <button key={report.id} onClick={() => { setSelectedReport(report); mapRef.current?.flyTo({center:[report.lng,report.lat],zoom:14}) }}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedReport?.id===report.id?'bg-blue-50':isNew?'bg-green-50':reviewed==='approved'?'bg-green-50/40':''}`}>
                <div className="flex items-start gap-2">
                  <div className={`w-3 h-3 rounded-full mt-0.5 shrink-0 ${isPending ? 'border-2 border-dashed bg-transparent' : ''}`}
                    style={isPending ? {borderColor:tierColors[report.tier].hex} : {backgroundColor:tierColors[report.tier].hex}}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-gray-800 truncate">{report.id} {isNew&&<span className="text-green-600">★ New</span>}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {reviewed === 'approved' && <span className="text-[9px] font-bold text-green-600 bg-green-100 px-1 rounded">✓</span>}
                        {isPending && <span className="text-[9px] font-medium text-gray-400 bg-gray-100 px-1 rounded">Unverified</span>}
                        <span className="text-xs font-bold" style={{color:tierColors[report.tier].hex}}>{report.trustScore.total}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 truncate">{report.district} · {dmgLabel[report.damageLevel]}</div>
                    <div className="text-xs text-gray-400 truncate">{report.landmark}</div>
                    <div className="text-[10px] text-gray-300 flex items-center gap-1.5">
                      <span>{formatDate(report.timestamp)}</span>
                      {!inArea && <span className="text-orange-400 font-medium">· ⚠ Outside area</span>}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ════════════ MAP ═════════════════════════════════════════════════════ */}
      <div className="flex-1 relative" style={{ minHeight: '400px', minWidth: 0 }}>
        <div ref={mapContainer} style={{position:'absolute',top:0,left:0,right:0,bottom:0,width:'100%',height:'100%'}}/>

        {/* ── Mobile stats overlay ── */}
        <div className="lg:hidden absolute top-2 left-2 right-14 z-10 bg-white bg-opacity-95 rounded-xl shadow-md overflow-hidden">
          <button onClick={() => setStatsOpen(v => !v)}
            className="w-full flex items-center justify-between px-2.5 py-2 gap-1">
            <span className="text-xs font-semibold text-gray-700">{config.title}</span>
            <div className="flex items-center gap-1.5">
              <CmsBadge isLoading={isLoading} cmsError={cmsFetchError} />
              {CMS.enabled && (
                <button onClick={e => { e.stopPropagation(); onRefresh?.() }} title="Refresh" disabled={isCmsLoading}
                  className="text-gray-400 hover:text-blue-600 transition-colors p-0.5 disabled:opacity-50">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 ${isCmsLoading ? 'animate-spin text-blue-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${statsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </div>
          </button>
          {statsOpen && (
            <div className="px-2.5 pb-2.5">
              {/* Scenario switcher (mobile) */}
              {scenarios && scenarios.length > 1 && onScenarioChange && (
                <div className="mb-2">
                  <select
                    value={activeScenarioIdx}
                    onChange={e => onScenarioChange(+e.target.value)}
                    className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 font-medium focus:outline-none"
                  >
                    {scenarios.map((s, i) => (
                      <option key={i} value={i}>{s.title}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {(['green','amber','red'] as TrustTier[]).map(t => (
                  <div key={t} className={`rounded-lg p-1.5 text-center ${tierColors[t].bg}`}>
                    <div className={`text-base font-bold ${tierColors[t].text}`}>{isLoading ? '—' : stats[t]}</div>
                    <div className={`text-[10px] ${tierColors[t].text} opacity-80`}>{getTierLabel(t)}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-1 flex-wrap">
                {tierFilters.map(f => (
                  <button key={f.tier} onClick={() => setTierFilter(f.tier)}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      tierFilter === f.tier
                        ? f.tier==='all' ? 'bg-gray-700 text-white' : f.tier==='green' ? 'bg-green-600 text-white' : f.tier==='amber' ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>{f.label}</button>
                ))}
              </div>
              {/* Mobile infra filter */}
              <div className="flex gap-1 overflow-x-auto mt-1.5 pb-0.5" style={{scrollbarWidth:'none'}}>
                <button onClick={() => setInfraFilter('all')}
                  className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 transition-colors ${infraFilter === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  All Types
                </button>
                {(Object.entries(infraTypeLabel) as [InfraType, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setInfraFilter(key)}
                    className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 transition-colors ${infraFilter === key ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Desktop legend ── */}
        <div className="hidden lg:block absolute bottom-6 left-3 bg-white bg-opacity-95 rounded-lg shadow-md p-2 text-xs">
          <div className="font-semibold text-gray-700 mb-1">Trust Score</div>
          {(['green','amber','red'] as TrustTier[]).map(t => (
            <div key={t} className="flex items-center gap-1.5 py-0.5">
              <div className="w-3 h-3 rounded-full" style={{backgroundColor:tierColors[t].hex}}/>
              <span className="text-gray-600">{t==='green'?'≥80 High Trust':t==='amber'?'50–79 Review':'<50 Human Review'}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 mt-1.5 pt-1.5 space-y-0.5">
            <div className="flex items-center gap-1.5 py-0.5">
              <div className="w-3 h-3 rounded-full bg-white border-2 border-dashed border-gray-400"/>
              <span className="text-gray-400">Unverified</span>
            </div>
            <div className="flex items-center gap-1.5 py-0.5">
              <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"/>
              <span className="text-gray-600">Admin Verified</span>
            </div>
          </div>
        </div>

        {/* ── Desktop selected report popup ── */}
        {selectedReport && (
          <div className="hidden lg:block absolute top-3 right-3 bg-white rounded-xl shadow-lg w-64 overflow-hidden border border-gray-200 z-10">
            <div className={`px-3 py-2 flex items-center justify-between ${tierColors[selectedReport.tier].bg}`}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{backgroundColor:tierColors[selectedReport.tier].hex}}>
                  {selectedReport.trustScore.total}
                </div>
                <span className={`text-xs font-semibold ${tierColors[selectedReport.tier].text}`}>{selectedReport.id} · {getTierLabel(selectedReport.tier)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {reviewMap[selectedReport.id] === 'approved'
                  ? <span className="text-[10px] font-bold text-green-700 bg-green-200 px-1.5 py-0.5 rounded-full">✓ Verified</span>
                  : <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Unverified</span>
                }
                <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
              </div>
            </div>
            {selectedReport.imageUrl && (
              <img src={selectedReport.imageUrl} alt="damage photo" className="w-full h-36 object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
            )}
            <div className="p-3 space-y-1.5 text-xs">
              <InfoRow label="District" value={selectedReport.district}/>
              <InfoRow label="Time"     value={formatDate(selectedReport.timestamp)}/>
              <InfoRow label="Damage"   value={dmgLabel[selectedReport.damageLevel]}/>
              <InfoRow label="Type"     value={infraTypeLabel[selectedReport.infraType]}/>
              <InfoRow label="Channel"  value={channelLabel[selectedReport.channel]}/>
              <InfoRow label="C2PA"     value={selectedReport.hasC2PA?'Verified ✓':'Not available'}/>
              <div className="pt-1 border-t border-gray-100"><p className="text-gray-500 italic truncate">{selectedReport.landmark}</p></div>
              <div className="pt-1 space-y-1">
                <MiniBar label="Image" value={selectedReport.trustScore.imageIntegrity} max={40} color={tierColors[selectedReport.tier].hex}/>
                <MiniBar label="Geo"   value={selectedReport.trustScore.geospatial}     max={30} color={tierColors[selectedReport.tier].hex}/>
                <MiniBar label="Cross" value={selectedReport.trustScore.crossReport}    max={20} color={tierColors[selectedReport.tier].hex}/>
                <MiniBar label="Meta"  value={selectedReport.trustScore.metadata}       max={10} color={tierColors[selectedReport.tier].hex}/>
              </div>
            </div>
          </div>
        )}

        {/* ── Map report pin strip — desktop card + mobile full-width ── */}
        {mapReportPin && !selectedReport && (
          <>
            {/* Desktop: floating card at bottom-left (replaces legend while active) */}
            <div className="hidden lg:flex absolute bottom-4 left-3 z-10 w-72 bg-white rounded-xl shadow-lg border border-blue-200 p-3 items-center gap-3">
              <div className="w-8 h-8 shrink-0 rounded-full bg-blue-50 border-2 border-blue-300 flex items-center justify-center text-sm select-none">📍</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-800">Report damage here?</div>
                <div className="text-[10px] text-gray-400 font-mono">
                  {mapReportPin.lat.toFixed(5)}, {mapReportPin.lng.toFixed(5)}
                </div>
              </div>
              {onMapReport && (
                <button
                  onClick={() => { onMapReport(mapReportPin.lat, mapReportPin.lng); setMapReportPin(null) }}
                  className="shrink-0 px-3 py-1.5 bg-blue-700 text-white text-xs font-bold rounded-lg hover:bg-blue-800 active:bg-blue-900 transition-colors">
                  Open Form
                </button>
              )}
              <button onClick={() => setMapReportPin(null)}
                className="shrink-0 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-600 text-sm">✕</button>
            </div>
            {/* Mobile: full-width strip at bottom */}
            <div className="lg:hidden absolute bottom-0 left-0 right-0 z-30 bg-white border-t-2 border-blue-300 shadow-2xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-full bg-blue-50 border-2 border-blue-300 flex items-center justify-center text-lg select-none">📍</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-800">Report damage here?</div>
                <div className="text-xs text-gray-400 font-mono">
                  {mapReportPin.lat.toFixed(5)}, {mapReportPin.lng.toFixed(5)}
                </div>
              </div>
              {onMapReport && (
                <button
                  onClick={() => { onMapReport(mapReportPin.lat, mapReportPin.lng); setMapReportPin(null) }}
                  className="shrink-0 px-4 py-2.5 bg-blue-700 text-white text-sm font-bold rounded-xl active:bg-blue-900 transition-colors">
                  Open Form
                </button>
              )}
              <button onClick={() => setMapReportPin(null)}
                className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-300 text-xl">✕</button>
            </div>
          </>
        )}

        {/* ── Mobile: report list bottom sheet ── */}
        {!selectedReport && !mapReportPin && (
          <div className="lg:hidden absolute bottom-0 left-0 right-0 z-20">
            <button onClick={() => setMobileListOpen(!mobileListOpen)}
              className="w-full h-12 bg-white border-t border-gray-200 rounded-t-2xl flex items-center justify-between px-4 shadow-lg">
              <span className="text-sm font-semibold text-gray-700">
                {isLoading ? 'Loading reports…' : `${filteredReports.length} report${filteredReports.length !== 1 ? 's' : ''}`}
              </span>
              {/* Mobile sort toggle inside handle */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {([['time', '🕐'], ['score', '↓']] as const).map(([key, icon]) => (
                    <button key={key} onClick={e => { e.stopPropagation(); setSortBy(key) }}
                      className={`w-6 h-6 rounded text-[10px] font-bold transition-colors ${sortBy === key ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {icon}
                    </button>
                  ))}
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${mobileListOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/>
                </svg>
              </div>
            </button>
            <div ref={mobileListRef} className={`bg-white overflow-y-auto transition-all duration-300 ${mobileListOpen ? 'max-h-60' : 'max-h-0 overflow-hidden'}`}>
              {isPullRefreshing && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-blue-600">
                  <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
                  Refreshing…
                </div>
              )}
              {filteredReports.map(report => {
                const isNew    = newReportIds.has(report.id)
                const reviewed = reviewMap[report.id]
                return (
                  <button key={report.id}
                    onClick={() => { setSelectedReport(report); setMobileListOpen(false); mapRef.current?.flyTo({center:[report.lng,report.lat],zoom:14}) }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 active:bg-gray-50 ${isNew?'bg-green-50':''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full shrink-0 ${!reviewed ? 'border-2 border-dashed bg-transparent' : ''}`}
                        style={!reviewed ? {borderColor:tierColors[report.tier].hex} : {backgroundColor:tierColors[report.tier].hex}}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-800">{report.id} {isNew&&<span className="text-green-600 text-xs">★ New</span>}</span>
                          <div className="flex items-center gap-1 ml-2 shrink-0">
                            {reviewed === 'approved' && <span className="text-[9px] font-bold text-green-600 bg-green-100 px-1 rounded">✓</span>}
                            {!reviewed && <span className="text-[9px] text-gray-400 bg-gray-100 px-1 rounded">Unverified</span>}
                            <span className="text-sm font-bold" style={{color:tierColors[report.tier].hex}}>{report.trustScore.total}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 truncate">{report.district} · {dmgLabel[report.damageLevel]}</div>
                        <div className="text-[10px] text-gray-400">{formatDate(report.timestamp)}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Mobile: selected report bottom sheet ── */}
        {selectedReport && (
          <div className="lg:hidden absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-2xl shadow-2xl overflow-hidden" style={{maxHeight:'72%'}}>
            <div className={`px-4 py-3 flex items-center justify-between ${tierColors[selectedReport.tier].bg}`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center shrink-0"
                  style={{backgroundColor:tierColors[selectedReport.tier].hex}}>
                  {selectedReport.trustScore.total}
                </div>
                <div>
                  <div className={`text-sm font-bold ${tierColors[selectedReport.tier].text}`}>{getTierLabel(selectedReport.tier)}</div>
                  <div className={`text-xs ${tierColors[selectedReport.tier].text} opacity-70`}>{selectedReport.id}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {reviewMap[selectedReport.id] === 'approved'
                  ? <span className="text-[10px] font-bold text-green-700 bg-green-200 px-1.5 py-0.5 rounded-full">✓ Verified</span>
                  : <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Unverified</span>
                }
                {/* Close: re-opens the list so user can switch reports without extra taps */}
                <button onClick={() => { setSelectedReport(null); setMobileListOpen(true) }}
                  className="w-8 h-8 rounded-full bg-white bg-opacity-40 flex items-center justify-center text-gray-600 text-sm">✕</button>
              </div>
            </div>
            <div className="overflow-y-auto" style={{maxHeight:'calc(72vh - 60px)'}}>
              {selectedReport.imageUrl && (
                <img src={selectedReport.imageUrl} alt="damage photo" className="w-full h-48 object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
              )}
              <div className="p-4 space-y-2 text-sm">
                <InfoRowLg label="District" value={selectedReport.district}/>
                <InfoRowLg label="Time"     value={formatDate(selectedReport.timestamp)}/>
                <InfoRowLg label="Damage"   value={dmgLabel[selectedReport.damageLevel]}/>
                <InfoRowLg label="Type"     value={infraTypeLabel[selectedReport.infraType]}/>
                <InfoRowLg label="Channel"  value={channelLabel[selectedReport.channel]}/>
                <InfoRowLg label="C2PA"     value={selectedReport.hasC2PA?'Verified ✓':'Not available'}/>
                <p className="text-gray-400 text-xs italic pt-1">{selectedReport.landmark}</p>
                <div className="pt-2 space-y-2 border-t border-gray-100">
                  <MiniBar label="Image" value={selectedReport.trustScore.imageIntegrity} max={40} color={tierColors[selectedReport.tier].hex}/>
                  <MiniBar label="Geo"   value={selectedReport.trustScore.geospatial}     max={30} color={tierColors[selectedReport.tier].hex}/>
                  <MiniBar label="Cross" value={selectedReport.trustScore.crossReport}    max={20} color={tierColors[selectedReport.tier].hex}/>
                  <MiniBar label="Meta"  value={selectedReport.trustScore.metadata}       max={10} color={tierColors[selectedReport.tier].hex}/>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function CmsBadge({ isLoading, cmsError }: { isLoading: boolean; cmsError: string | null }) {
  if (!CMS.enabled) return <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">Demo data</span>
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
      isLoading ? 'bg-gray-100 text-gray-400' : cmsError ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'
    }`}>
      {isLoading ? '⟳ CMS' : cmsError ? '⚠ CMS' : '● CMS'}
    </span>
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

function InfoRowLg({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 w-16 shrink-0 text-sm">{label}</span>
      <span className="text-gray-800 font-semibold text-sm">{value}</span>
    </div>
  )
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-400 w-10 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className="h-2 rounded-full" style={{width:`${(value/max)*100}%`,backgroundColor:color}}/>
      </div>
      <span className="text-gray-500 w-10 text-right">{value}/{max}</span>
    </div>
  )
}

/** Locale-independent date formatter — avoids "Invalid Date" on mobile browsers */
function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    // Normalise common non-ISO formats returned by some CMS backends
    const normalized = iso
      .replace(' ', 'T')           // "2026-04-16 12:34" → "2026-04-16T12:34"
      .replace(' +0000 UTC', 'Z')  // Go time.RFC3339 suffix
      .replace(' UTC', 'Z')
    const d = new Date(normalized)
    if (isNaN(d.getTime())) return '—'
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${hh}:${mm}`
  } catch {
    return '—'
  }
}
