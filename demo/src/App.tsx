import { useState, useEffect } from 'react'
import type { DamageReport, DeploymentConfig } from './types'
import { fetchDeploymentConfig, DEFAULT_CONFIG } from './services/cmsApi'
import ReporterView from './views/ReporterView'
import DashboardView from './views/DashboardView'

type View = 'reporter' | 'dashboard'

const STORAGE_KEY = 'vcm_submitted_reports'

function loadStoredReports(): DamageReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as DamageReport[]
    // Drop blob URLs — they don't survive page reload
    return parsed.map(r => ({
      ...r,
      imageUrl: r.imageUrl?.startsWith('blob:') ? undefined : r.imageUrl,
    }))
  } catch {
    return []
  }
}

export default function App() {
  const [view, setView] = useState<View>('reporter')
  const [submittedReports, setSubmittedReports] = useState<DamageReport[]>(loadStoredReports)
  const [config, setConfig] = useState<DeploymentConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    fetchDeploymentConfig().then(setConfig)
  }, [])

  // Persist submitted reports to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(submittedReports))
  }, [submittedReports])

  const handleNewReport = (report: DamageReport) => {
    setSubmittedReports(prev => [report, ...prev])
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-blue-800 text-white shadow-md shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          {/* Logo + title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
              VCM
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm leading-tight truncate">Verified Crisis Mapper</div>
              <div className="text-blue-300 text-xs leading-tight truncate">{config.scenario_label}</div>
            </div>
          </div>

          {/* PC nav — shown only on lg+ screens */}
          <div className="hidden lg:flex items-center rounded-xl overflow-hidden border border-blue-600 text-sm shrink-0">
            <button
              onClick={() => setView('reporter')}
              className={`px-4 py-2 flex items-center gap-2 transition-colors ${
                view === 'reporter'
                  ? 'bg-white text-blue-800 font-semibold'
                  : 'text-blue-200 hover:bg-blue-700 hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Report Damage
            </button>
            <div className="w-px h-8 bg-blue-600" />
            <button
              onClick={() => setView('dashboard')}
              className={`px-4 py-2 flex items-center gap-2 transition-colors ${
                view === 'dashboard'
                  ? 'bg-white text-blue-800 font-semibold'
                  : 'text-blue-200 hover:bg-blue-700 hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Dashboard
              {submittedReports.length > 0 && (
                <span className="bg-green-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
                  +{submittedReports.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      {/* pb-16 on mobile keeps content above the bottom nav bar */}
      <main className="flex-1 flex flex-col lg:pb-0 pb-16 overflow-hidden" style={{ minHeight: 0 }}>
        {view === 'reporter' ? (
          <ReporterView
            config={config}
            onViewDashboard={() => setView('dashboard')}
            onNewReport={handleNewReport}
          />
        ) : (
          <DashboardView config={config} submittedReports={submittedReports} />
        )}
      </main>

      {/* ── Mobile bottom nav (hidden on lg+) ──────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex">
        <button
          onClick={() => setView('reporter')}
          className={`flex-1 relative flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
            view === 'reporter' ? 'text-blue-700' : 'text-gray-400'
          }`}
        >
          {view === 'reporter' && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-blue-700 rounded-full" />
          )}
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs font-medium">Report Damage</span>
        </button>

        <button
          onClick={() => setView('dashboard')}
          className={`flex-1 relative flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
            view === 'dashboard' ? 'text-blue-700' : 'text-gray-400'
          }`}
        >
          {view === 'dashboard' && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-blue-700 rounded-full" />
          )}
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            {submittedReports.length > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-green-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {submittedReports.length}
              </span>
            )}
          </div>
          <span className="text-xs font-medium">Dashboard</span>
        </button>
      </nav>

    </div>
  )
}
