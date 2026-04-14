import { useEffect, useRef, useState, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { mockReports } from '../data/mockReports'
import { fetchCmsReports } from '../services/cmsApi'
import { CMS } from '../config'
import type { DamageReport, TrustTier, DeploymentConfig } from '../types'
import { tierColors, damageLevelLabel, infraTypeLabel, channelLabel } from '../utils/trustColors'
import { getTierLabel } from '../utils/trustScore'

interface Props {
  config: DeploymentConfig
  submittedReports?: DamageReport[]
}

export default function DashboardView({ config, submittedReports = [] }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const markersRef   = useRef<maplibregl.Marker[]>([])

  const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null)
  const [tierFilter, setTierFilter]         = useState<TrustTier | 'all'>('all')
  const [mapReady, setMapReady]             = useState(false)
  const [mobileListOpen, setMobileListOpen] = useState(false)

  // CMS fetch state
  const [cmsReports, setCmsReports] = useState<DamageReport[] | null>(null)
  const [cmsError,   setCmsError]   = useState<string | null>(null)

  useEffect(() => {
    if (!CMS.enabled) return
    fetchCmsReports()
      .then(reports => setCmsReports(reports))
      .catch(() => { setCmsError('Could not load CMS data'); setCmsReports([]) })
  }, [])

  const prevSubmittedCount = useRef(0)
  useEffect(() => {
    if (!CMS.enabled) return
    if (submittedReports.length > prevSubmittedCount.current) {
      prevSubmittedCount.current = submittedReports.length
      fetchCmsReports().then(reports => setCmsReports(reports)).catch(() => {})
    }
  }, [submittedReports.length])

  const baseReports = useMemo((): DamageReport[] => {
    if (CMS.enabled && cmsReports !== null) return cmsReports
    return mockReports
  }, [cmsReports])

  const allReports = useMemo(() => {
    const sessionIds = new Set(submittedReports.map(r => r.id))
    return [...submittedReports, ...baseReports.filter(r => !sessionIds.has(r.id))]
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

  // ── Map ─────────────────────────────────────────────────────────────────────
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
        sources: { 'esri-satellite': { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics', maxzoom: 18 } },
        layers: [{ id: 'esri-satellite', type: 'raster', source: 'esri-satellite' }],
      },
      bounds,
      fitBoundsOptions: { padding: 40 },
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current = map
    map.on('load', () => setMapReady(true))
    return () => { markersRef.current.forEach(m => m.remove()); map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When CMS delivers a config different from defaults, re-fit the map bounds
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    map.fitBounds(
      [[config.bounds_sw_lng, config.bounds_sw_lat], [config.bounds_ne_lng, config.bounds_ne_lat]],
      { padding: 40, duration: 800 }
    )
  }, [config, mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    filteredReports.forEach(report => {
      const color = tierColors[report.tier].hex
      const isNew = submittedReports.some(r => r.id === report.id)
      const el = document.createElement('div')
      el.style.cssText = `width:${isNew?'26px':'22px'};height:${isNew?'26px':'22px'};border-radius:50%;background:${color};border:${isNew?'3px':'2.5px'} solid white;box-shadow:${isNew?`0 0 0 2px ${color},0 4px 8px rgba(0,0,0,0.4)`:'0 2px 6px rgba(0,0,0,0.35)'};cursor:pointer;`
      el.addEventListener('mouseenter', () => { el.style.boxShadow = `0 0 0 3px white,0 0 0 6px ${color}` })
      el.addEventListener('mouseleave', () => { el.style.boxShadow = isNew ? `0 0 0 2px ${color},0 4px 8px rgba(0,0,0,0.4)` : '0 2px 6px rgba(0,0,0,0.35)' })
      el.addEventListener('click', () => { setSelectedReport(report); setMobileListOpen(false) })
      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([report.lng, report.lat]).addTo(map))
    })
  }, [filteredReports, mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const isLoading = CMS.enabled && cmsReports === null

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col lg:flex-row" style={{ minHeight: 0 }}>

      {/* ════════════ DESKTOP SIDEBAR (hidden on mobile) ════════════════════ */}
      <div className="hidden lg:flex lg:w-80 bg-white border-r border-gray-200 flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">{config.title}</h2>
            <CmsBadge isLoading={isLoading} cmsError={cmsError} />
          </div>
          {submittedReports.length > 0 && (
            <div className="mb-2 text-xs bg-green-50 border border-green-200 rounded px-2 py-1 text-green-700">
              +{submittedReports.length} report{submittedReports.length > 1 ? 's' : ''} this session
            </div>
          )}
          {cmsError && <div className="mb-2 text-xs bg-red-50 border border-red-200 rounded px-2 py-1 text-red-600">{cmsError} — showing demo data</div>}
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
        <div className="p-3 border-b border-gray-100">
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
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? Array.from({length:6}).map((_,i) => (
            <div key={i} className="px-3 py-2.5 border-b border-gray-100 animate-pulse">
              <div className="flex items-start gap-2"><div className="w-3 h-3 rounded-full bg-gray-200 mt-0.5 shrink-0"/><div className="flex-1 space-y-1.5"><div className="h-3 bg-gray-200 rounded w-3/4"/><div className="h-2.5 bg-gray-100 rounded w-1/2"/></div></div>
            </div>
          )) : filteredReports.map(report => {
            const isNew = submittedReports.some(r => r.id === report.id)
            return (
              <button key={report.id} onClick={() => { setSelectedReport(report); mapRef.current?.flyTo({center:[report.lng,report.lat],zoom:14}) }}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedReport?.id===report.id?'bg-blue-50':isNew?'bg-green-50':''}`}>
                <div className="flex items-start gap-2">
                  <div className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{backgroundColor:tierColors[report.tier].hex}}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-gray-800 truncate">{report.id} {isNew&&<span className="text-green-600">★ New</span>}</span>
                      <span className="text-xs font-bold" style={{color:tierColors[report.tier].hex}}>{report.trustScore.total}</span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">{report.district} · {damageLevelLabel[report.damageLevel]}</div>
                    <div className="text-xs text-gray-400 truncate">{report.landmark}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ════════════ MAP (full screen on mobile) ═══════════════════════════ */}
      <div className="flex-1 relative" style={{ minHeight: '400px', minWidth: 0 }}>
        <div ref={mapContainer} style={{position:'absolute',top:0,left:0,right:0,bottom:0,width:'100%',height:'100%'}}/>

        {/* ── Mobile stats overlay (hidden on desktop) ── */}
        <div className="lg:hidden absolute top-2 left-2 right-14 z-10 bg-white bg-opacity-95 rounded-xl shadow-md p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">{config.title}</span>
            <CmsBadge isLoading={isLoading} cmsError={cmsError} />
          </div>
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
              <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>
            {selectedReport.imageUrl && (
              <img src={selectedReport.imageUrl} alt="damage photo" className="w-full h-36 object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
            )}
            <div className="p-3 space-y-1.5 text-xs">
              <InfoRow label="District" value={selectedReport.district}/>
              <InfoRow label="Damage"   value={damageLevelLabel[selectedReport.damageLevel]}/>
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

        {/* ── Mobile: report list bottom sheet (hidden on desktop) ── */}
        {!selectedReport && (
          <div className={`lg:hidden absolute bottom-0 left-0 right-0 z-20 transition-transform duration-300 ${
            mobileListOpen ? 'translate-y-0' : 'translate-y-[calc(100%-48px)]'
          }`}>
            {/* Handle bar */}
            <button onClick={() => setMobileListOpen(!mobileListOpen)}
              className="w-full h-12 bg-white border-t border-gray-200 rounded-t-2xl flex items-center justify-between px-4 shadow-lg">
              <span className="text-sm font-semibold text-gray-700">
                {isLoading ? 'Loading reports…' : `${filteredReports.length} report${filteredReports.length !== 1 ? 's' : ''}`}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${mobileListOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/>
              </svg>
            </button>
            {/* Scrollable list */}
            <div className="bg-white max-h-60 overflow-y-auto">
              {filteredReports.map(report => {
                const isNew = submittedReports.some(r => r.id === report.id)
                return (
                  <button key={report.id}
                    onClick={() => { setSelectedReport(report); setMobileListOpen(false); mapRef.current?.flyTo({center:[report.lng,report.lat],zoom:14}) }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 active:bg-gray-50 ${isNew?'bg-green-50':''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor:tierColors[report.tier].hex}}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-800">{report.id} {isNew&&<span className="text-green-600 text-xs">★ New</span>}</span>
                          <span className="text-sm font-bold ml-2 shrink-0" style={{color:tierColors[report.tier].hex}}>{report.trustScore.total}</span>
                        </div>
                        <div className="text-xs text-gray-500 truncate">{report.district} · {damageLevelLabel[report.damageLevel]}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Mobile: selected report bottom sheet (hidden on desktop) ── */}
        {selectedReport && (
          <div className="lg:hidden absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-2xl shadow-2xl overflow-hidden" style={{maxHeight:'72%'}}>
            {/* Handle + header */}
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
              <button onClick={() => setSelectedReport(null)}
                className="w-8 h-8 rounded-full bg-white bg-opacity-40 flex items-center justify-center text-gray-600 text-sm">✕</button>
            </div>
            {/* Scrollable content */}
            <div className="overflow-y-auto" style={{maxHeight:'calc(72vh - 60px)'}}>
              {selectedReport.imageUrl && (
                <img src={selectedReport.imageUrl} alt="damage photo" className="w-full h-48 object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
              )}
              <div className="p-4 space-y-2 text-sm">
                <InfoRowLg label="District" value={selectedReport.district}/>
                <InfoRowLg label="Damage"   value={damageLevelLabel[selectedReport.damageLevel]}/>
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

// ── Shared helpers ───────────────────────────────────────────────────────────

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
