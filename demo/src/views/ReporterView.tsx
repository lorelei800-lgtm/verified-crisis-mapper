import { useState, useRef } from 'react'
import type { DamageLevel, InfraType, SubmissionChannel } from '../types'
import { calculateDemoTrustScore, getTier, getTierLabel, getTierDescription } from '../utils/trustScore'
import { tierColors, damageLevelLabel, infraTypeLabel } from '../utils/trustColors'

interface Props {
  onViewDashboard: () => void
}

type FormStep = 'form' | 'submitting' | 'result'

export default function ReporterView({ onViewDashboard }: Props) {
  const [step, setStep] = useState<FormStep>('form')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [damageLevel, setDamageLevel] = useState<DamageLevel | ''>('')
  const [infraType, setInfraType] = useState<InfraType | ''>('')
  const [landmark, setLandmark] = useState('')
  const [channel] = useState<SubmissionChannel>('pwa')
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'acquired' | 'error'>('idle')
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(50)
  const [trustResult, setTrustResult] = useState<ReturnType<typeof calculateDemoTrustScore> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPhotoPreview(url)
  }

  const handleGps = () => {
    setGpsStatus('acquiring')
    setTimeout(() => {
      // Simulate GPS acquisition
      setGpsAccuracy(12)
      setGpsStatus('acquired')
    }, 1500)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!damageLevel || !infraType) return
    setStep('submitting')
    const score = calculateDemoTrustScore({
      hasPhoto: !!photoPreview,
      hasGps: gpsStatus === 'acquired',
      gpsAccuracy,
      channel,
    })
    setTimeout(() => {
      setTrustResult(score)
      setStep('result')
    }, 1800)
  }

  const handleReset = () => {
    setStep('form')
    setPhotoPreview(null)
    setDamageLevel('')
    setInfraType('')
    setLandmark('')
    setGpsStatus('idle')
    setTrustResult(null)
  }

  if (step === 'submitting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600 text-sm">Verifying report…</p>
        <div className="text-xs text-gray-400 space-y-1 text-center">
          <p>Checking image integrity…</p>
          <p>Cross-referencing satellite data…</p>
          <p>Calculating Trust Score…</p>
        </div>
      </div>
    )
  }

  if (step === 'result' && trustResult) {
    const tier = getTier(trustResult.total)
    const colors = tierColors[tier]
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4 max-w-md mx-auto w-full">
        {/* Result card */}
        <div className={`w-full rounded-xl border-2 ${colors.border} ${colors.bg} p-5`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white`}
              style={{ backgroundColor: colors.hex }}>
              {trustResult.total}
            </div>
            <div>
              <div className={`font-bold ${colors.text}`}>{getTierLabel(tier)}</div>
              <div className="text-xs text-gray-500">{getTierDescription(tier)}</div>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="space-y-2">
            <ScoreBar label="Image Integrity" value={trustResult.imageIntegrity} max={40} color={colors.hex} />
            <ScoreBar label="Geospatial" value={trustResult.geospatial} max={30} color={colors.hex} />
            <ScoreBar label="Cross-Report" value={trustResult.crossReport} max={20} color={colors.hex} />
            <ScoreBar label="Metadata" value={trustResult.metadata} max={10} color={colors.hex} />
          </div>
        </div>

        {tier === 'green' && (
          <div className="w-full bg-green-50 border border-green-300 rounded-lg p-4 text-sm text-green-800">
            <strong>Your report is now live on the map.</strong> Thank you — your submission is helping guide emergency response.
          </div>
        )}
        {tier === 'amber' && (
          <div className="w-full bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-800">
            <strong>Report received.</strong> Additional verification is underway. Your report will appear on the map once reviewed.
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

  // ---- FORM ----
  return (
    <div className="flex-1 max-w-md mx-auto w-full p-4">
      {/* Scenario banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-700">
        <strong>Demo Scenario:</strong> Bangkok Flood, October 2026 · Don Mueang / Pathum Thani
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1 — Photo */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">1. Photo</h2>
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="damage" className="w-full h-40 object-cover rounded-lg" />
              <button type="button" onClick={() => setPhotoPreview(null)}
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
              gpsStatus === 'acquired'
                ? 'bg-green-50 border-green-400 text-green-700 font-medium'
                : gpsStatus === 'acquiring'
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'border-gray-300 text-gray-600 hover:border-blue-400'
            }`}>
            {gpsStatus === 'idle' && '📍 Auto-capture GPS location'}
            {gpsStatus === 'acquiring' && '⟳ Acquiring GPS…'}
            {gpsStatus === 'acquired' && `✓ GPS captured (±${gpsAccuracy}m)`}
            {gpsStatus === 'error' && '⚠ GPS unavailable'}
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
