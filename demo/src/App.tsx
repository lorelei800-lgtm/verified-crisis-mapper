import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import type { DamageReport, DeploymentConfig, ReviewMap, ReviewStatus } from './types'
import { fetchAllScenarios, fetchCmsReports, updateReviewStatus, DEFAULT_CONFIG, uploadAsset, createReportItem } from './services/cmsApi'
import { getAllQueued, removeQueued, incrementAttempts, countQueued } from './services/offlineQueue'
import { CMS } from './config'
import { mockReports } from './data/mockReports'
import { isWithinArea } from './utils/geo'
import ReporterView from './views/ReporterView'
const DashboardView = lazy(() => import('./views/DashboardView'))
const AdminView     = lazy(() => import('./views/AdminView'))

type View = 'reporter' | 'dashboard' | 'admin'

const REVIEW_KEY  = 'vcm_review_status'

function loadReviewMap(): ReviewMap {
  try {
    const raw = localStorage.getItem(REVIEW_KEY)
    return raw ? (JSON.parse(raw) as ReviewMap) : {}
  } catch {
    return {}
  }
}

export default function App() {
  const [view, setView]                     = useState<View>('reporter')
  // Start empty every session — CMS is the source of truth across devices.
  // Submitted reports appear immediately in this session only (not loaded from localStorage).
  const [submittedReports, setSubmittedReports] = useState<DamageReport[]>([])
  const [config, setConfig]                 = useState<DeploymentConfig>(DEFAULT_CONFIG)
  const [scenarios, setScenarios]           = useState<DeploymentConfig[]>([DEFAULT_CONFIG])
  const [activeScenarioIdx, setActiveScenarioIdx] = useState(0)
  /**
   * True when the page was opened with a ?scenario= URL param.
   * In that case the scenario switcher is hidden — the URL already pins the context
   * (citizen / municipal staff use-case). Without the param (central govt overview),
   * the switcher is shown in the header.
   */
  const [hasScenarioParam] = useState(
    () => !!new URLSearchParams(window.location.search).get('scenario')
  )
  const [unseenCount, setUnseenCount]       = useState(0)
  const [newReportIds, setNewReportIds]     = useState<Set<string>>(new Set())
  const [reviewMap, setReviewMap]           = useState<ReviewMap>(loadReviewMap)
  const [cmsReports, setCmsReports]         = useState<DamageReport[]>([])
  const [isCmsLoading, setIsCmsLoading]     = useState(true)
  const [cmsFetchError, setCmsFetchError]   = useState<string | null>(null)
  const [adminAuthed, setAdminAuthed]       = useState(false)
  // viewer_pin is retired — citizens see the dashboard freely without a PIN.
  // Municipal staff reach Admin via the "Staff Login" button in the dashboard.
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  /** Coordinates placed by a map click — passed to ReporterView as prefilledLocation */
  const [mapReportLocation, setMapReportLocation] = useState<{ lat: number; lng: number } | null>(null)
  /** Incremented on each map-report nav to force ReporterView remount (re-runs prefill effect) */
  const [reporterKey, setReporterKey] = useState(0)

  // Secret tap counter: tap VCM logo 5 times to open Admin
  const logoTapCount = useRef(0)
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleLogoTap = () => {
    logoTapCount.current += 1
    if (logoTapTimer.current) clearTimeout(logoTapTimer.current)
    logoTapTimer.current = setTimeout(() => { logoTapCount.current = 0 }, 2000)
    if (logoTapCount.current >= 3) {
      logoTapCount.current = 0
      setView('admin')
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }
  }

  // Track whether notifications have been granted
  const notifEnabled = useRef(false)

  useEffect(() => {
    fetchAllScenarios().then(all => {
      setScenarios(all)

      // Determine initial scenario from ?scenario= URL param
      // Supports exact match against scenario_label or title (case-insensitive).
      // Example: https://vcm.app/?scenario=fukui-asuwa-flood
      const param = new URLSearchParams(window.location.search).get('scenario')
      let initIdx = 0
      if (param) {
        const p = param.toLowerCase()
        const found = all.findIndex(s =>
          s.scenario_label.toLowerCase() === p ||
          s.title.toLowerCase() === p ||
          // also match slug-style: spaces/special chars → hyphens
          s.scenario_label.toLowerCase().replace(/[^a-z0-9]+/g, '-') === p
        )
        if (found >= 0) initIdx = found
      }
      setActiveScenarioIdx(initIdx)
      setConfig(all[initIdx])
    })
  }, [])

  const handleScenarioChange = (idx: number) => {
    setActiveScenarioIdx(idx)
    setConfig(scenarios[idx])
    // Update URL param so the current scenario is bookmarkable / shareable
    const url = new URL(window.location.href)
    const label = scenarios[idx].scenario_label
    if (label) {
      url.searchParams.set('scenario', label.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    } else {
      url.searchParams.delete('scenario')
    }
    window.history.replaceState({}, '', url.toString())
    // viewer_pin is "access to this dashboard deployment", not per-scenario
    // → do NOT reset viewerAuthed when switching scenarios
  }

  // Single source of truth for CMS data — prevents double-polling white screen
  const doFetch = (isInitial = false) => {
    setCmsFetchError(null)
    fetchCmsReports().then(({ reports, reviewMap: cmsReviewMap }) => {
      setCmsReports(prev => {
        if (!isInitial && reports.length > prev.length) {
          fireNotification(
            `${reports.length - prev.length} new report(s) received`,
            'Open the Admin panel to review and approve.'
          )
        }
        return reports
      })
      // CMS review_status is the source of truth — merge into local reviewMap
      if (Object.keys(cmsReviewMap).length > 0) {
        setReviewMap(prev => ({ ...prev, ...cmsReviewMap }))
      }
    }).catch(() => {
      setCmsFetchError('Could not load CMS data')
    }).finally(() => {
      setIsCmsLoading(false)
    })
  }

  useEffect(() => {
    console.info('[CMS] config — enabled:', CMS.enabled, 'writable:', CMS.writable)
    if (!CMS.enabled) return
    doFetch(true)
    const id = setInterval(() => doFetch(), 30_000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Merged list: CMS + session submitted (deduped) — ALL scenarios
  const allKnownReports = useMemo(() => {
    const base = CMS.enabled ? cmsReports : mockReports
    const sessionIds = new Set(submittedReports.map(r => r.id))
    return [...submittedReports, ...base.filter(r => !sessionIds.has(r.id))]
  }, [cmsReports, submittedReports])

  /**
   * Reports scoped to the active scenario's geographic area.
   *
   * Design rule:
   *   ?scenario=xxx  →  show only reports within that scenario's area_radius_km.
   *                     Municipal staff (Fukui / Chiyoda) each see their own data.
   *   no param       →  show all reports across all scenarios (central govt view).
   *
   * Phase 2 (future): replace geographic filter with an explicit `scenario_label`
   * field stored on each CMS report item for unambiguous scoping.
   */
  const adminScopedReports = useMemo(() => {
    if (!hasScenarioParam) return allKnownReports   // central govt: see everything
    return allKnownReports.filter(r =>
      isWithinArea(r.lat, r.lng, config.area_center_lat, config.area_center_lng, config.area_radius_km)
    )
  }, [allKnownReports, config, hasScenarioParam])

  // Pending review count — scoped to the active scenario (same logic as adminScopedReports)
  const adminPendingCount = useMemo(
    () => adminScopedReports.filter(r => !reviewMap[r.id]).length,
    [adminScopedReports, reviewMap]
  )

  // Persist review map
  useEffect(() => {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(reviewMap))
  }, [reviewMap])

  // Keep notifEnabled in sync with permission state
  useEffect(() => {
    if ('Notification' in window) {
      notifEnabled.current = Notification.permission === 'granted'
    }
  }, [])

  // ── Offline detection & queue sync ────────────────────────────────────────
  useEffect(() => {
    // Check initial queue count
    countQueued().then(setPendingOfflineCount).catch(() => {})

    const goOnline = async () => {
      setIsOnline(true)
      // Process offline queue
      try {
        const items = await getAllQueued()
        if (items.length === 0) return
        console.info(`[offlineQueue] processing ${items.length} queued reports`)
        for (const item of items) {
          if (item.attempts >= 3) continue   // give up after 3 failures
          try {
            await incrementAttempts(item.queueId)
            let assetId: string | undefined
            if (item.photo) {
              const file  = new File([item.photo], 'damage.jpg', { type: 'image/jpeg' })
              const asset = await uploadAsset(file)
              if (asset) assetId = asset.id
            }
            const cmsId = await createReportItem(item.report, assetId)
            if (cmsId) {
              await removeQueued(item.queueId)
              setPendingOfflineCount(prev => Math.max(0, prev - 1))
            }
          } catch (err) {
            console.warn('[offlineQueue] sync failed for', item.queueId, err)
          }
        }
      } catch (err) {
        console.warn('[offlineQueue] processing error', err)
      }
    }

    const goOffline = () => setIsOnline(false)

    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fireNotification = (title: string, body: string) => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.ico' })
      } catch { /* iOS Safari requires service-worker notifications — silently skip */ }
    }
  }

  const handleNewReport = (report: DamageReport) => {
    setSubmittedReports(prev => [report, ...prev])
    setNewReportIds(prev => new Set([...prev, report.id]))
    setUnseenCount(prev => prev + 1)
    // Notify admin if they have enabled notifications
    fireNotification(
      'New Damage Report',
      `${report.district} · Score: ${report.trustScore.total} · ${report.id}`
    )
    // Refresh CMS after a short delay to pick up the newly published item
    if (CMS.enabled) setTimeout(() => doFetch(), 3000)
  }

  /** Navigate to reporter via normal tab — clears any map-placed pin */
  const handleGoToReporter = () => {
    setMapReportLocation(null)
    setView('reporter')
  }

  /** Called from DashboardView when the user taps "Open Form" on a map pin */
  const handleMapReport = (lat: number, lng: number) => {
    setMapReportLocation({ lat, lng })
    setReporterKey(k => k + 1)   // remount ReporterView so prefill useEffect re-runs
    setView('reporter')
  }

  const handleGoToDashboard = () => {
    setView('dashboard')
    setUnseenCount(0)
  }

  const handleReview = (id: string, status: ReviewStatus, reason?: string) => {
    // Optimistic local update
    setReviewMap(prev => ({ ...prev, [id]: status }))
    // Write back to CMS so other devices see the change
    const report = adminScopedReports.find(r => r.id === id)
    console.info('[Admin] handleReview', id, status, reason ?? '(no reason)', 'cmsId:', report?.cmsId, 'writable:', CMS.writable)
    if (report?.cmsId) {
      updateReviewStatus(report.cmsId, status, reason).then(ok => {
        if (!ok) console.warn('[Admin] review write-back failed — check VITE_CMS_TOKEN secret in GitHub')
      })
    } else {
      console.warn('[Admin] no cmsId for report', id, '— review not synced to CMS')
    }
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-blue-800 text-white shadow-md shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          {/* Logo + title (tap 5× to open Admin) */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleLogoTap}
              className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0 select-none focus:outline-none active:opacity-70"
            >
              VCM
            </button>
            <div className="min-w-0">
              <div className="font-semibold text-sm leading-tight truncate">Verified Crisis Mapper</div>
              <div className="text-blue-300 text-xs leading-tight truncate">{config.description ?? config.scenario_label}</div>
              {pendingOfflineCount > 0 && (
                <div className="text-[10px] text-orange-300 leading-tight">
                  📵 {pendingOfflineCount} report{pendingOfflineCount > 1 ? 's' : ''} queued offline
                </div>
              )}
            </div>
          </div>

          {/* Scenario switcher — only on base URL (no ?scenario= param) = central govt overview */}
          {!hasScenarioParam && scenarios.length > 1 && (
            <div className="hidden lg:flex items-center gap-1.5 min-w-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 004 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <select
                value={activeScenarioIdx}
                onChange={e => handleScenarioChange(+e.target.value)}
                className="text-sm bg-blue-700 border border-blue-500 rounded-lg px-2 py-1 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer max-w-[200px] truncate"
              >
                {scenarios.map((s, i) => (
                  <option key={i} value={i}>{s.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* PC nav — shown only on lg+ screens */}
          <div className="hidden lg:flex items-center rounded-xl overflow-hidden border border-blue-600 text-sm shrink-0">
            <button
              onClick={handleGoToReporter}
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
              onClick={handleGoToDashboard}
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
              {unseenCount > 0 && (
                <span className="bg-green-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
                  +{unseenCount}
                </span>
              )}
            </button>
            {/* Admin tab appears only when already authenticated */}
            {adminAuthed && (
              <>
                <div className="w-px h-8 bg-blue-600" />
                <button
                  onClick={() => setView('admin')}
                  className={`px-4 py-2 flex items-center gap-2 transition-colors ${
                    view === 'admin'
                      ? 'bg-white text-blue-800 font-semibold'
                      : 'text-blue-200 hover:bg-blue-700 hover:text-white'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  Admin
                  {adminPendingCount > 0 && (
                    <span className="bg-amber-400 text-amber-900 text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
                      {adminPendingCount}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      {/* pb-16 on mobile keeps content above the bottom nav bar */}
      <main className="flex-1 flex flex-col lg:pb-0 pb-16 overflow-hidden" style={{ minHeight: 0 }}>
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          {view === 'reporter' ? (
            <ReporterView
              key={reporterKey}
              config={config}
              onViewDashboard={handleGoToDashboard}
              onNewReport={handleNewReport}
              existingReports={CMS.enabled ? cmsReports : mockReports}
              isOnline={isOnline}
              prefilledLocation={mapReportLocation ?? undefined}
            />
          ) : view === 'dashboard' ? (
            // No viewer_pin gate — citizens access the dashboard freely.
            // Municipal staff use the "Staff Login" button inside the dashboard.
            <DashboardView
              config={config}
              submittedReports={submittedReports}
              newReportIds={newReportIds}
              reviewMap={reviewMap}
              cmsReports={CMS.enabled ? cmsReports : null}
              isCmsLoading={isCmsLoading}
              cmsFetchError={cmsFetchError}
              onRefresh={() => doFetch()}
              onMapReport={handleMapReport}
              onGoToAdmin={() => setView('admin')}
            />
          ) : (
            <AdminView
              reports={adminScopedReports}
              reviewMap={reviewMap}
              onReview={handleReview}
              isAuthed={adminAuthed}
              onAuthSuccess={() => setAdminAuthed(true)}
              onLogout={() => { setAdminAuthed(false); handleGoToReporter() }}
              adminPin={config.admin_pin}
            />
          )}
        </Suspense>
      </main>

      {/* ── Mobile bottom nav (hidden on lg+) ──────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex">
        <button
          onClick={handleGoToReporter}
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
          <span className="text-xs font-medium">Report</span>
        </button>

        <button
          onClick={handleGoToDashboard}
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
            {unseenCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-green-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unseenCount}
              </span>
            )}
          </div>
          <span className="text-xs font-medium">Dashboard</span>
        </button>

        {/* Admin tab — only visible after authentication */}
        {adminAuthed && (
          <button
            onClick={() => setView('admin')}
            className={`flex-1 relative flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
              view === 'admin' ? 'text-blue-700' : 'text-gray-400'
            }`}
          >
            {view === 'admin' && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-blue-700 rounded-full" />
            )}
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              {adminPendingCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {adminPendingCount > 9 ? '9+' : adminPendingCount}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">Admin</span>
          </button>
        )}
      </nav>

    </div>
  )
}
