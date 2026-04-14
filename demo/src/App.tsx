import { useState } from 'react'
import ReporterView from './views/ReporterView'
import DashboardView from './views/DashboardView'

type View = 'reporter' | 'dashboard'

export default function App() {
  const [view, setView] = useState<View>('reporter')

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-blue-800 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
              VCM
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight">Verified Crisis Mapper</div>
              <div className="text-blue-300 text-xs leading-tight">Bangkok Flood Demo · October 2026</div>
            </div>
          </div>
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-blue-600 text-sm">
            <button
              onClick={() => setView('reporter')}
              className={`px-3 py-1.5 transition-colors ${
                view === 'reporter'
                  ? 'bg-white text-blue-800 font-semibold'
                  : 'text-blue-200 hover:text-white hover:bg-blue-700'
              }`}
            >
              Report Damage
            </button>
            <button
              onClick={() => setView('dashboard')}
              className={`px-3 py-1.5 transition-colors ${
                view === 'dashboard'
                  ? 'bg-white text-blue-800 font-semibold'
                  : 'text-blue-200 hover:text-white hover:bg-blue-700'
              }`}
            >
              Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {view === 'reporter' ? (
          <ReporterView onViewDashboard={() => setView('dashboard')} />
        ) : (
          <DashboardView />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 text-center text-xs text-gray-400 py-2">
        Verified Crisis Mapper · Built on Re:Earth · Apache-2.0 Open Source · Eukarya Inc.
      </footer>
    </div>
  )
}
