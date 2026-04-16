import { useState, useRef } from 'react'
import type { DamageLevel, InfraType, SubmissionChannel, DamageReport, DeploymentConfig } from '../types'
import { calculateDemoTrustScore, getTier, getTierLabel, getTierDescription } from '../utils/trustScore'
import { tierColors, damageLevelLabel, infraTypeLabel } from '../utils/trustColors'
import { uploadAsset, createReportItem } from '../services/cmsApi'
import { isWithinArea } from '../utils/geo'
import { CMS } from '../config'

interface Props {
  config: DeploymentConfig
  onViewDashboard: () => void
  onNewReport: (report: DamageReport) => void
}

type FormStep = 'form' | 'submitting' | 'result'
type SubmitPhase = 'scoring' | 'analyzing' | 'uploading' | 'saving' | 'done'

export default function ReporterView({ config, onViewDashboard, onNewReport }: Props) {
  const [step, setStep]               = useState<FormStep>('form')
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('scoring')

  // Form state
  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoSource, setPhotoSource]   = useState<'camera' | 'library' | null>(null)
  const [damageLevel, setDamageLevel]   = useState<DamageLevel | ''>('')
  const [infraType, setInfraType]       = useState<InfraType | ''>('')
  const [landmark, setLandmark]         = useState('')
  const [district, setDistrict]         = useState('')
  const [channel]                       = useState<SubmissionChannel>('pwa')
  const [gpsStatus, setGpsStatus]       = useState<'idle' | 'acquiring' | 'acquired' | 'error'>('idle')
  const [gpsAccuracy, setGpsAccuracy]   = useState<number>(50)
  const [gpsLat, setGpsLat]             = useState<number>(0)
  const [gpsLng, setGpsLng]             = useState<number>(0)
  const [inArea, setInArea]             = useState<boolean>(true)
  const [geocoding, setGeocoding]       = useState(false)

  // Result state
  const [trustResult, setTrustResult]     = useState<ReturnType<typeof calculateDemoTrustScore> | null>(null)
  const [finalImageUrl, setFinalImageUrl] = useState<string | null>(null)
  const [resultHasC2PA, setResultHasC2PA] = useState(false)
  const [aiResult, setAiResult]           = useState<'authentic' | 'suspicious' | null>(null)
  const [cmsError, setCmsError]           = useState<string | null>(null)

  const fileRef    = useRef<HTMLInputElement>(null)
  const cameraRef  = useRef<HTMLInputElement>(null)

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>, source: 'camera' | 'library') => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setPhotoFile(compressed)
    setPhotoPreview(URL.createObjectURL(compressed))
    setPhotoSource(source)
  }

  const handleGps = () => {
    setGpsStatus('acquiring')

    if (!navigator.geolocation) {
      setGpsStatus('error')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat      = position.coords.latitude
        const lng      = position.coords.longitude
        const accuracy = Math.round(position.coords.accuracy)
        const within   = isWithinArea(lat, lng, config.area_center_lat, config.area_center_lng, config.area_radius_km)
        setGpsLat(lat)
        setGpsLng(lng)
        setInArea(within)
        setGpsAccuracy(accuracy)
        setGpsStatus('acquired')

        // Reverse geocoding — auto-fill landmark and district
        try {
          setGeocoding(true)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
            { headers: { 'User-Agent': 'VerifiedCrisisMapper/1.0' } }
          )
          const data = await res.json()
          const addr = data.address ?? {}

          // Landmark: prefer specific named places over generic road names
          // Priority: specific amenity/building → neighbourhood → suburb → quarter → city_district → road
          const landmark =
            addr.amenity        ??   // hospital, school, park, etc.
            addr.building       ??   // named building
            addr.neighbourhood  ??   // 丁目-level for JP; borough sub-area elsewhere
            addr.quarter        ??   // local quarter
            addr.suburb         ??   // suburb or 町
            addr.city_district  ??   // 区 level (Chiyoda-ku, etc.)
            addr.road           ??   // street name (last resort)
            addr.town           ??
            addr.city           ??
            data.display_name?.split(',')[0] ?? ''

          // District: administrative division (ward / borough / county)
          const district =
            addr.city_district  ??   // 千代田区
            addr.borough        ??
            addr.county         ??
            addr.state_district ??
            ''

          if (landmark) setLandmark(landmark)
          if (district) setDistrict(district)
        } catch {
          // geocoding failure is non-critical
        } finally {
          setGeocoding(false)
        }
      },
      (err) => {
        console.warn('[GPS]', err.message)
        setGpsStatus('error')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!damageLevel || !infraType) return

    setStep('submitting')
    setSubmitPhase('scoring')
    setCmsError(null)

    // 1. Determine C2PA: camera-taken photos carry simulated C2PA credentials
    const c2pa = photoSource === 'camera' && !!photoFile

    // 2. Calculate trust score
    const score = calculateDemoTrustScore({
      hasPhoto:    !!photoPreview,
      hasGps:      gpsStatus === 'acquired',
      gpsAccuracy,
      channel,
      isInArea:    gpsStatus === 'acquired' ? inArea : true,
      hasC2PA:     c2pa,
      aiAuthentic: true,
    })

    await sleep(800)

    // 3. AI image analysis step (simulated)
    setSubmitPhase('analyzing')
    await sleep(1200)
    setResultHasC2PA(c2pa)
    setAiResult('authentic')

    // 2. Upload photo to CMS (if CMS is writable and a photo was taken)
    let imageUrl: string | undefined
    let assetId:  string | undefined

    if (photoFile && CMS.writable) {
      setSubmitPhase('uploading')
      const asset = await uploadAsset(photoFile)
      if (asset) {
        imageUrl = asset.url
        assetId  = asset.id
      } else {
        // Upload failed — fall back to local blob URL for this session only
        imageUrl = photoPreview ?? undefined
        setCmsError('Photo upload failed — image visible in this session only')
      }
    } else if (photoPreview) {
      // CMS not writable — keep the local blob URL
      imageUrl = photoPreview
    }

    // 3. Build the local DamageReport object
    const reportLat = gpsStatus === 'acquired' ? gpsLat : config.area_center_lat + (Math.random() - 0.5) * 0.02
    const reportLng = gpsStatus === 'acquired' ? gpsLng : config.area_center_lng + (Math.random() - 0.5) * 0.02
    const newReport: DamageReport = {
      id:         `RPT-${Date.now().toString().slice(-4)}`,
      lat:        reportLat,
      lng:        reportLng,
      damageLevel: damageLevel as DamageLevel,
      infraType:   infraType  as InfraType,
      landmark:   landmark || `${config.subtitle} (demo GPS)`,
      district:   district || config.subtitle.split('/')[0].trim(),
      timestamp:  new Date().toISOString(),
      channel,
      trustScore: score,
      tier:       getTier(score.total),
      h3Cell:     '8865b1b6dffffff',
      hasC2PA:    c2pa,
      imageUrl,
    }

    // 4. Persist to CMS (if writable)
    if (CMS.writable) {
      setSubmitPhase('saving')
      const cmsId = await createReportItem(newReport, assetId)
      if (!cmsId && !cmsError) {
        setCmsError('CMS save failed — report visible in this session only')
      }
    }

    setSubmitPhase('done')
    setTrustResult(score)
    setFinalImageUrl(imageUrl ?? null)
    onNewReport(newReport)
    setStep('result')
  }

  const handleReset = () => {
    setStep('form')
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoSource(null)
    setDamageLevel('')
    setInfraType('')
    setLandmark('')
    setGpsStatus('idle')
    setGpsLat(0)
    setGpsLng(0)
    setInArea(true)
    setGeocoding(false)
    setDistrict('')
    setTrustResult(null)
    setFinalImageUrl(null)
    setResultHasC2PA(false)
    setAiResult(null)
    setCmsError(null)
    setSubmitPhase('scoring')
  }

  // ── Submitting screen ───────────────────────────────────────────────────────
  if (step === 'submitting') {
    const phases: Record<SubmitPhase, string[]> = {
      scoring:   ['Checking image integrity…', 'Cross-referencing satellite data…', 'Calculating Trust Score…'],
      analyzing: ['Trust Score calculated ✓', 'Running AI authenticity scan…', 'Verifying C2PA credentials…'],
      uploading: ['Trust Score calculated ✓', 'AI analysis complete ✓', 'Uploading photo to CMS…'],
      saving:    ['Trust Score calculated ✓', 'AI analysis complete ✓', 'Photo uploaded ✓', 'Saving report to CMS…'],
      done:      ['Trust Score calculated ✓', 'AI analysis complete ✓', 'Photo uploaded ✓', 'Report saved ✓'],
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600 text-sm font-medium">Verifying report…</p>
        <div className="text-xs text-gray-400 space-y-1 text-center">
          {phases[submitPhase].map((line, i) => (
            <p key={i} className={line.endsWith('✓') ? 'text-green-600' : ''}>{line}</p>
          ))}
        </div>
      </div>
    )
  }

  // ── Result screen ───────────────────────────────────────────────────────────
  if (step === 'result' && trustResult) {
    const tier   = getTier(trustResult.total)
    const colors = tierColors[tier]
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4 max-w-md mx-auto w-full">
        <div className={`w-full rounded-xl border-2 ${colors.border} ${colors.bg} p-5`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white"
              style={{ backgroundColor: colors.hex }}>
              {trustResult.total}
            </div>
            <div>
              <div className={`font-bold ${colors.text}`}>{getTierLabel(tier)}</div>
              <div className="text-xs text-gray-500">{getTierDescription(tier)}</div>
            </div>
          </div>

          {/* Photo — uses CMS asset URL when available, blob URL otherwise */}
          {finalImageUrl && (
            <img src={finalImageUrl} alt="submitted" className="w-full h-32 object-cover rounded-lg mb-4"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          )}

          <div className="space-y-2">
            <ScoreBar label="Image Integrity" value={trustResult.imageIntegrity} max={40} color={colors.hex} />
            <ScoreBar label="Geospatial"       value={trustResult.geospatial}     max={30} color={colors.hex} />
            <ScoreBar label="Cross-Report"     value={trustResult.crossReport}    max={20} color={colors.hex} />
            <ScoreBar label="Metadata"         value={trustResult.metadata}       max={10} color={colors.hex} />
          </div>

          {/* C2PA + AI badges */}
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            <div className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${resultHasC2PA ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
              <span>{resultHasC2PA ? '🔏' : '○'}</span>
              <span className="font-medium">C2PA Content Credentials:</span>
              <span>{resultHasC2PA ? 'Verified ✓' : 'Not present'}</span>
            </div>
            {aiResult && (
              <div className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${aiResult === 'authentic' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                <span>{aiResult === 'authentic' ? '🤖' : '⚠'}</span>
                <span className="font-medium">AI Analysis:</span>
                <span>{aiResult === 'authentic' ? 'Authentic content detected ✓' : 'Flagged for review'}</span>
              </div>
            )}
          </div>
        </div>

        {tier === 'green' && (
          <div className="w-full bg-green-50 border border-green-300 rounded-lg p-4 text-sm text-green-800">
            <strong>Your report is now live on the map.</strong>{' '}
            {CMS.enabled
              ? 'It has been saved to the Re:Earth CMS database.'
              : 'Thank you — your submission is helping guide emergency response.'}
          </div>
        )}
        {tier === 'amber' && (
          <div className="w-full bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-800">
            <strong>Report received.</strong> Additional verification is underway. Your report will appear on the map once reviewed.
          </div>
        )}

        {/* CMS error notice (non-blocking) */}
        {cmsError && (
          <div className="w-full bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-xs text-yellow-700">
            ⚠ {cmsError}
          </div>
        )}

        {/* CMS save confirmation */}
        {CMS.writable && !cmsError && (
          <div className="w-full text-center text-xs text-gray-400">
            Saved to Re:Earth CMS · visible on dashboard after reload
          </div>
        )}

        <div className="flex gap-3 w-full">
          <button onClick={handleReset}
            className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50">
            Submit Another
          </button>
          <button onClick={onViewDashboard}
            className="flex-1 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800">
            View Map
          </button>
        </div>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 max-w-md mx-auto w-full p-4 overflow-y-auto">
      {/* Scenario banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-700">
        <strong>Scenario:</strong> {config.scenario_label} · {config.subtitle}
        {CMS.writable && (
          <span className="ml-2 text-blue-500">· Reports saved to Re:Earth CMS</span>
        )}
      </div>

      {/* Out-of-area warning */}
      {gpsStatus === 'acquired' && !inArea && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4 text-xs text-amber-800">
          <strong>Location outside reporting area.</strong> Geospatial score will be 0 — your report will require manual review.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Step 1 — Photo */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">1. Photo</h2>
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="damage" className="w-full h-52 object-cover rounded-xl" />
              <button type="button"
                onClick={() => { setPhotoPreview(null); setPhotoFile(null) }}
                className="absolute top-2 right-2 bg-white rounded-full w-8 h-8 text-sm text-gray-600 shadow-md flex items-center justify-center">
                ✕
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              {/* Camera button */}
              <button type="button" onClick={() => cameraRef.current?.click()}
                className="flex-1 h-36 bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl flex flex-col items-center justify-center gap-2 text-blue-400 hover:bg-blue-100 hover:border-blue-500 active:bg-blue-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm font-semibold text-blue-600">Take Photo</p>
              </button>
              {/* Library button */}
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex-1 h-36 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:bg-gray-100 hover:border-gray-400 active:bg-gray-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-semibold text-gray-500">From Library</p>
              </button>
            </div>
          )}
          {/* Camera input — forces camera on mobile */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={e => handlePhoto(e, 'camera')} />
          {/* Library input — shows photo picker */}
          <input ref={fileRef} type="file" accept="image/*"
            className="hidden" onChange={e => handlePhoto(e, 'library')} />
        </section>

        {/* Step 2 — Damage Level */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">2. Damage Level</h2>
          <div className="flex flex-col gap-2">
            {(['minimal', 'partial', 'destroyed'] as DamageLevel[]).map(level => (
              <button key={level} type="button"
                onClick={() => setDamageLevel(level)}
                className={`w-full py-4 px-4 rounded-xl border-2 text-sm font-semibold transition-colors flex items-center gap-3 ${
                  damageLevel === level
                    ? level === 'destroyed' ? 'bg-red-600 text-white border-red-600'
                      : level === 'partial' ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-green-600 text-white border-green-600'
                    : 'border-gray-200 text-gray-600 bg-gray-50 active:bg-gray-100'
                }`}>
                <span className={`w-3 h-3 rounded-full shrink-0 ${
                  level === 'destroyed' ? 'bg-red-400'
                  : level === 'partial'  ? 'bg-amber-400'
                  : 'bg-green-400'
                } ${damageLevel === level ? 'bg-white' : ''}`} />
                {damageLevelLabel[level]}
              </button>
            ))}
          </div>
        </section>

        {/* Step 3 — Infrastructure Type */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">3. Infrastructure Type</h2>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(infraTypeLabel) as [InfraType, string][]).map(([key, label]) => (
              <button key={key} type="button"
                onClick={() => setInfraType(key)}
                className={`py-3 px-3 rounded-xl border-2 text-sm font-medium text-left transition-colors active:scale-95 ${
                  infraType === key
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'border-gray-200 text-gray-600 bg-gray-50 active:bg-gray-100'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Step 4 — Location */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">4. Location</h2>
          <button type="button" onClick={handleGps}
            className={`w-full py-3.5 rounded-xl border-2 text-sm font-medium mb-3 transition-colors ${
              gpsStatus === 'acquired'  ? 'bg-green-50 border-green-400 text-green-700'
              : gpsStatus === 'acquiring' ? 'bg-blue-50 border-blue-300 text-blue-600'
              : gpsStatus === 'error'   ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'border-gray-200 bg-gray-50 text-gray-600 active:bg-gray-100'
            }`}>
            {gpsStatus === 'idle'      && '📍 Auto-capture GPS location'}
            {gpsStatus === 'acquiring' && '⟳ Acquiring GPS…'}
            {gpsStatus === 'acquired'  && !geocoding && `✓ GPS captured (±${gpsAccuracy}m)`}
            {gpsStatus === 'acquired'  && geocoding  && `✓ GPS captured (±${gpsAccuracy}m) · Looking up address…`}
            {gpsStatus === 'error'     && '⚠ Location unavailable — tap to retry'}
          </button>
          {gpsStatus === 'error' && (
            <div className="mb-3 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700">
              GPS was denied or timed out. Your report will be placed near the centre of the reporting area.
              Enter a landmark below to help responders locate the site.
            </div>
          )}
          {/* GPS mini-map preview — appears when coordinates are acquired */}
          {gpsStatus === 'acquired' && (
            <div className="mb-3 rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{height: 130}}>
              <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${gpsLng-0.006},${gpsLat-0.005},${gpsLng+0.006},${gpsLat+0.005}&layer=mapnik&marker=${gpsLat},${gpsLng}`}
                className="w-full h-full border-0"
                loading="lazy"
                title="GPS Location Preview"
              />
            </div>
          )}

          {/* District — auto-filled from GPS, always editable */}
          <input
            type="text" value={district} onChange={e => setDistrict(e.target.value)}
            placeholder="District / ward (auto-filled from GPS)"
            className={`w-full border rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-blue-400 ${
              district ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-gray-300'
            }`}
          />

          <input type="text" value={landmark} onChange={e => setLandmark(e.target.value)}
            placeholder="Landmark / street name (e.g. Kanda River Bridge)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        </section>

        {/* Submit */}
        <button type="submit"
          disabled={!damageLevel || !infraType}
          className="w-full py-4 rounded-xl bg-blue-700 text-white font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-800 active:bg-blue-900 transition-colors shadow-md">
          Submit Report
        </button>
      </form>
    </div>
  )
}

async function compressImage(file: File, maxPx = 1280, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx }
        else { width = Math.round(width * maxPx / height); height = maxPx }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        if (!blob) { resolve(file); return }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 text-gray-500 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-10 text-right text-gray-600 font-medium">{value}/{max}</span>
    </div>
  )
}
