import { useState, useRef } from 'react'
import type { DamageLevel, InfraType, SubmissionChannel, DamageReport } from '../types'
import { calculateDemoTrustScore, getTier, getTierLabel, getTierDescription } from '../utils/trustScore'
import { tierColors, damageLevelLabel, infraTypeLabel } from '../utils/trustColors'
import { uploadAsset, createReportItem } from '../services/cmsApi'
import { CMS } from '../config'

interface Props {
  onViewDashboard: () => void
  onNewReport: (report: DamageReport) => void
}

type FormStep = 'form' | 'submitting' | 'result'
type SubmitPhase = 'scoring' | 'uploading' | 'saving' | 'done'

// Demo: fixed coordinates near Don Mueang (simulated GPS)
const DEMO_LAT = 13.9051
const DEMO_LNG = 100.5988

export default function ReporterView({ onViewDashboard, onNewReport }: Props) {
  const [step, setStep]               = useState<FormStep>('form')
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('scoring')

  // Form state
  const [photoFile, setPhotoFile]     = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [damageLevel, setDamageLevel] = useState<DamageLevel | ''>('')
  const [infraType, setInfraType]     = useState<InfraType | ''>('')
  const [landmark, setLandmark]       = useState('')
  const [channel]                     = useState<SubmissionChannel>('pwa')
  const [gpsStatus, setGpsStatus]     = useState<'idle' | 'acquiring' | 'acquired' | 'error'>('idle')
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(50)

  // Result state
  const [trustResult, setTrustResult] = useState<ReturnType<typeof calculateDemoTrustScore> | null>(null)
  const [finalImageUrl, setFinalImageUrl] = useState<string | null>(null)  // CMS asset URL or blob fallback
  const [cmsError, setCmsError]       = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleGps = () => {
    setGpsStatus('acquiring')
    setTimeout(() => {
      setGpsAccuracy(12)
      setGpsStatus('acquired')
    }, 1500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!damageLevel || !infraType) return

    setStep('submitting')
    setSubmitPhase('scoring')
    setCmsError(null)

    // 1. Calculate trust score (simulated)
    const score = calculateDemoTrustScore({
      hasPhoto:    !!photoPreview,
      hasGps:      gpsStatus === 'acquired',
      gpsAccuracy,
      channel,
    })

    // Small delay so the user sees "Calculating Trust Score…" text
    await sleep(800)

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
    const newReport: DamageReport = {
      id:         `RPT-${Date.now().toString().slice(-4)}`,
      lat:        DEMO_LAT + (Math.random() - 0.5) * 0.02,
      lng:        DEMO_LNG + (Math.random() - 0.5) * 0.02,
      damageLevel: damageLevel as DamageLevel,
      infraType:   infraType  as InfraType,
      landmark:   landmark || 'Don Mueang area (demo GPS)',
      district:   'Don Mueang',
      timestamp:  new Date().toISOString(),
      channel,
      trustScore: score,
      tier:       getTier(score.total),
      h3Cell:     '8865b1b6dffffff',
      hasC2PA:    false,
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
    setDamageLevel('')
    setInfraType('')
    setLandmark('')
    setGpsStatus('idle')
    setTrustResult(null)
    setFinalImageUrl(null)
    setCmsError(null)
    setSubmitPhase('scoring')
  }

  // ── Submitting screen ───────────────────────────────────────────────────────
  if (step === 'submitting') {
    const phases: Record<SubmitPhase, string[]> = {
      scoring:   ['Checking image integrity…', 'Cross-referencing satellite data…', 'Calculating Trust Score…'],
      uploading: ['Trust Score calculated ✓', 'Uploading photo to CMS…'],
      saving:    ['Trust Score calculated ✓', 'Photo uploaded ✓', 'Saving report to CMS…'],
      done:      ['Trust Score calculated ✓', 'Photo uploaded ✓', 'Report saved ✓'],
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
        <strong>Demo Scenario:</strong> Bangkok Flood, October 2026 · Don Mueang / Pathum Thani
        {CMS.writable && (
          <span className="ml-2 text-blue-500">· Reports saved to Re:Earth CMS</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Step 1 — Photo */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">1. Photo</h2>
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="damage" className="w-full h-40 object-cover rounded-lg" />
              <button type="button"
                onClick={() => { setPhotoPreview(null); setPhotoFile(null) }}
                className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 text-xs text-gray-600 shadow flex items-center justify-center">
                ✕
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
              <span className="text-3xl">📷</span>
              <span className="text-xs">Tap to take photo or upload</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={handlePhoto} />
        </section>

        {/* Step 2 — Damage Level */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">2. Damage Level</h2>
          <div className="grid grid-cols-3 gap-2">
            {(['minimal', 'partial', 'destroyed'] as DamageLevel[]).map(level => (
              <button key={level} type="button"
                onClick={() => setDamageLevel(level)}
                className={`py-2 px-1 rounded-lg border text-xs font-medium transition-colors ${
                  damageLevel === level
                    ? level === 'destroyed' ? 'bg-red-600 text-white border-red-600'
                      : level === 'partial' ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-green-600 text-white border-green-600'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}>
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
                className={`py-1.5 px-2 rounded-lg border text-xs text-left transition-colors ${
                  infraType === key
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
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
            className={`w-full py-2 rounded-lg border text-sm mb-2 transition-colors ${
              gpsStatus === 'acquired'  ? 'bg-green-50 border-green-400 text-green-700 font-medium'
              : gpsStatus === 'acquiring' ? 'bg-blue-50 border-blue-300 text-blue-600'
              : 'border-gray-300 text-gray-600 hover:border-blue-400'
            }`}>
            {gpsStatus === 'idle'      && '📍 Auto-capture GPS location'}
            {gpsStatus === 'acquiring' && '⟳ Acquiring GPS…'}
            {gpsStatus === 'acquired'  && `✓ GPS captured (±${gpsAccuracy}m)`}
            {gpsStatus === 'error'     && '⚠ GPS unavailable'}
          </button>
          <input type="text" value={landmark} onChange={e => setLandmark(e.target.value)}
            placeholder="Landmark / street name (backup if no GPS)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        </section>

        {/* Submit */}
        <button type="submit"
          disabled={!damageLevel || !infraType}
          className="w-full py-3 rounded-xl bg-blue-700 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-800 transition-colors">
          Submit Report
        </button>
      </form>
    </div>
  )
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
