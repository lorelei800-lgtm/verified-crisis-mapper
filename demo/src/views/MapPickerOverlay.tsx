import { useState, useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'

/**
 * Full-screen map location picker.
 *
 * The map pans/zooms under a fixed centre pin (Uber / Google Maps style).
 * Tapping "Use this location" calls onConfirm with map.getCenter() — no
 * pointer/tap-event detection needed, which is why this approach was chosen
 * over trying to detect taps on the dashboard map.
 */
export default function MapPickerOverlay({
  initialCenter,
  onConfirm,
  onCancel,
}: {
  initialCenter: { lat: number; lng: number }
  onConfirm: (lat: number, lng: number) => void
  onCancel: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const [center, setCenter] = useState(initialCenter)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Tiles © Esri — Maxar, Earthstar Geographics',
            maxzoom: 18,
          },
        },
        layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
      },
      center: [initialCenter.lng, initialCenter.lat],
      zoom: 15,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current = map

    // Update coordinate display live as the user pans
    map.on('move', () => {
      const c = map.getCenter()
      setCenter({ lat: c.lat, lng: c.lng })
    })

    return () => { map.remove(); mapRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConfirm = () => {
    const c = mapRef.current?.getCenter()
    if (c) onConfirm(c.lat, c.lng)
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">

      {/* ── Header ── */}
      <div className="bg-blue-800 text-white px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 text-blue-300 hover:text-white active:opacity-70 transition-opacity py-1 pr-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Pick Location</div>
          <div className="text-[11px] text-blue-300">Pan &amp; zoom to the damage site, then confirm</div>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <div ref={containerRef} className="absolute inset-0" />

        {/* Fixed centre pin — CSS only, no tap/click detection needed */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          {/* Crosshair guides */}
          <div className="absolute w-10 h-px bg-white opacity-25" />
          <div className="absolute h-10 w-px bg-white opacity-25" />
          {/* Pin */}
          <div className="flex flex-col items-center" style={{ transform: 'translateY(-22px)' }}>
            <div className="w-9 h-9 rounded-full bg-blue-600 border-4 border-white shadow-xl flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-white" />
            </div>
            <div className="w-0.5 h-5 bg-blue-600" />
            <div className="w-2 h-1 bg-black opacity-20 rounded-full blur-sm mt-0.5" />
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="bg-white px-4 pt-3 pb-6 shadow-2xl shrink-0">
        {/* Live coordinate readout */}
        <div className="text-center mb-3">
          <span className="text-xs font-mono text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full inline-block">
            {center.lat.toFixed(6)},&nbsp;{center.lng.toFixed(6)}
          </span>
        </div>
        <button
          onClick={handleConfirm}
          className="w-full py-4 rounded-2xl bg-blue-700 text-white font-bold text-base active:bg-blue-900 transition-colors shadow-md">
          ✓ Use this location
        </button>
      </div>

    </div>
  )
}
