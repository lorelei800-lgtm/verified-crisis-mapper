import { useState } from 'react'
import type { DamageReport } from './types'
import ReporterView from './views/ReporterView'
import DashboardView from './views/DashboardView'

type View = 'reporter' | 'dashboard'

export default function App() {
  const [view, setView] = useState<View>('reporter')
  const [submittedReports, setSubmittedReports] = useState<DamageReport[]>([])

  const handleNewReport = (report: DamageReport) => {
    setSubmittedReports(prev => [report, ...prev])
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">

      {/* ── Header (logo only — nav moved to bottom bar) ── */}
      <header className="bg-blue-800 text-white shadow-md shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
            VCM
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">Verified Crisis Mapper</div>
            <div className="text-blue-300 text-xs leading-tight">Bangkok Flood Demo · October 2026</div>
          </div>
        </div>
      </header>

      {/* ── Main content (pb-16 keeps content above the bottom nav) ── */}
      <main className="flex-1 flex flex-col pb-16 overflow-hidden" style={{ minHeight: 0 }}>
        {view === 'reporter' ? (
          <ReporterView
            onViewDashboard={() => setView('dashboard')}
            onNewReport={handleNewReport}
          />
        ) : (
          <DashboardView submittedReports={submittedReports} />
        )}
      </main>

      {/* ── Bottom navigation bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex">
        <button
          onClick={() => setView('reporter')}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
            view === 'reporter'
              ? 'text-blue-700'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs font-medium">Report Damage</span>
          {view === 'reporter' && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-700 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setView('dashboard')}
          className={`flex-1 relative flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
            view === 'dashboard'
              ? 'text-blue-700'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            {submittedReports.length > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-green-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {submittedReports.length}
              </span>
            )}
          </div>
          <span className="text-xs font-medium">Dashboard</span>
          {view === 'dashboard' && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-700 rounded-full" />
          )}
        </button>
      </nav>

    </div>
  )
}
