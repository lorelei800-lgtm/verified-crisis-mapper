# Changelog

All notable changes to this project will be documented in this file.  
Format follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) — per Eukarya Engineering Guidelines.

---

## [Unreleased]

*(no pending items)*

---

## [0.7.0] — 2026-04-17

### Changed
- `refactor`: Removed all multi-scenario switching logic (scenarios state, `fetchAllScenarios`, `handleScenarioChange`, `hasScenarioParam`, `scenarioCmsReports`, geographic area filter, header switcher JSX)
- `refactor`: App now loads a single `DeploymentConfig` via `fetchDeploymentConfig()` on startup — clean single-deployment model
- Deployment isolation strategy documented: multiple cities = separate deployments with separate CMS projects and env vars (not URL params)

---

## [0.6.0] — 2026-04-17

### Added
- `feat`: **Pending button** in Admin Review Panel — when a report is Approved or Rejected, a third `↩ Pending` button appears between Approve and Reject, allowing reviewers to revert a decision for re-examination
  - `onReview(id, null)` removes the key from `reviewMap` (local) and clears `review_status` in CMS
  - Pending state retains original 2-button layout; 3-button layout activates only when a decision exists
- `feat`: **Staff Login button** — "Government / Municipal Staff Login" link added to the Dashboard, accessible from:
  - Desktop: bottom of the report list sidebar
  - Mobile: bottom of the statistics overlay (when expanded)
  - Navigates directly to Admin PIN screen without requiring the logo secret-tap

### Changed
- `refactor`: Retired `viewer_pin` gate entirely — citizens access the Dashboard freely without any PIN; `ViewerPinGate` component removed
- `feat`: Moved scenario switcher from Dashboard sidebar/stats-overlay to the blue header bar; display conditioned on absence of `?scenario=` URL param (central-government overview use-case)

---

## [0.5.0] — 2026-04-16

### Added
- `feat`: **MapPickerOverlay** — full-screen floating-pin map picker in ReporterView for mobile location selection
  - User pans a satellite map; a fixed CSS center pin marks the selected point (`map.getCenter()`) — no tap-event detection needed
  - Eliminates the Android Chrome tap reliability issue (MapLibre v4 uses PointerEvent internally; `touchend.originalEvent.changedTouches` is undefined)
  - Lazy-loaded (`React.lazy` + `Suspense`) to keep MapLibre out of the main bundle; main chunk stays at ~62KB gzip
  - Live coordinate readout updates as map pans; "✓ Use this location" confirms selection
- `feat`: **PIN lockout** — both Admin and (formerly) ViewerPinGate PIN screens now enforce progressive lockout:
  - 3 failed attempts → 30-second lockout
  - 6+ failed attempts → 120-second lockout
  - Countdown rendered via `setInterval` / `setTick` pattern; button shows `🔒 {n}s` while locked
- `feat`: **URL-based scenario selection** — `?scenario=fukui-asuwa-flood` URL param sets initial scenario on load; `window.history.replaceState` updates URL on scenario switch without reload
- `feat`: **Scenario switcher in Dashboard** — `<select>` added to desktop sidebar and mobile stats overlay when multiple scenarios are available; scenario switches no longer reset viewer authentication

### Fixed
- `fix`: Android map tap — replaced `map.on('touchend')` (returns PointerEvent with no `changedTouches`) with native `canvas.addEventListener('pointerdown'/'pointerup')` and 50ms timeout + `layerConsumed` flag to distinguish cluster/point taps from empty-area taps

---

## [0.4.0] — 2026-04-15

### Added — Interactive Demo (full PWA implementation)

**ReporterView (damage submission form)**
- Photo capture (camera) or library upload with on-device compression (640px, 60% quality for low-bandwidth environments)
- Damage level: Minimal / Partially Damaged / Completely Destroyed
- Infrastructure type: 8 categories (Residential, Commercial, Government, Utility, Transport/Communication, Community, Public Space, Other)
- Location: GPS auto-capture with accuracy display + Nominatim reverse geocoding (auto-fills district and landmark); map picker; manual text fallback
- Cross-report validation: warns when GPS location diverges from nearby reports (> 500m)
- Trust Score calculation: 4-factor breakdown (Image Integrity 40 pts / Geospatial 30 pts / Cross-Report 20 pts / Metadata 10 pts) with result displayed immediately after submission
- C2PA credential detection (camera-sourced images flagged as credentialed in demo)
- Offline-first: submissions queued via IndexedDB; auto-synced via Background Sync when connectivity returns
- Pre-fill from map-click: coordinates passed from DashboardView "Open Form" strip

**DashboardView (real-time map + report list)**
- MapLibre GL JS satellite basemap (Esri World Imagery tiles)
- Trust-tier color-coded pins: green (≥80), amber (50–79), red (<50); dashed outline for unverified, solid for admin-approved
- Zoom-adaptive cluster markers (count badges at low zoom; individual pins at zoom ≥ 12)
- Desktop: 320px sidebar with tier filter, sort (newest / score), infrastructure filter, report list, and "Staff Login" link
- Mobile: collapsible statistics overlay (top), bottom-sheet report list with pull-to-refresh, bottom-sheet report detail
- Map click → "Report damage here?" strip with "Open Form" button (passes lat/lng to ReporterView)
- Selected report popup: photo, district, damage level, infrastructure type, channel, C2PA status, Trust Score bar chart

**AdminView (operator review panel)**
- 6-digit PIN authentication with progressive lockout (3 fails → 30s, 6+ fails → 120s); VCM logo 3-tap shortcut
- Review tabs: All / Pending / Approved / Rejected (with counts)
- Per-report card: photo, district, damage level, infrastructure type, landmark, timestamp, GPS coords, Trust Score bar breakdown
- Action buttons: Approve / ↩ Pending / Reject (3-button layout when decision exists; 2-button layout when pending)
- Reject reason dropdown (6 predefined options: image quality, duplicate, location mismatch, outside area, AI-generated, other)
- CMS write-back: `review_status` and `reject_reason` fields patched + re-published via Re:Earth CMS Integration API
- Cross-device real-time sync: review decisions visible on all connected dashboards within 30 seconds

**Re:Earth CMS integration**
- `deployment-config` model: single record per deployment (bounds, area, admin_pin, damage labels, description)
- `damage-reports` model: 15 fields (damage_level, infra_type, landmark, district, lat, lng, channel, has_c2pa, h3_cell, tier, trust_score_total/image/geo/cross/meta, image asset, review_status, reject_reason)
- Polling interval: 30 seconds; initial fetch on load; incremental refresh after new report submission (3s delay)
- Offline queue (`offlineQueue.ts`): IndexedDB-backed queue; up to 3 retry attempts per item; auto-processes on `online` event

**GitHub Actions CI/CD**
- `.github/workflows/deploy-demo.yml`: triggers on push to `main` for `demo/**`; builds with CMS secrets; deploys to GitHub Pages
- Live demo: https://lorelei800-lgtm.github.io/verified-crisis-mapper/demo/

---

## [0.3.0] — 2026-04-01

### Added
- `docs`: Complete English proposal document (docx) with 7 chapters, 3 Gemini-generated illustrations, architecture diagram, CMS schema design, and trust score engine specification
- `docs`: Mobile UI mockup (Phase 0/2/3 storyboard)
- `docs`: Government dashboard mockup (Re:Earth Visualizer)
- `docs`: Gemini image generation prompts (3 prompts: Phase 0, Phase 2, Phase 3)
- `docs`: Illustration set generated via Gemini (phase_0.png, phase_2.png, phase_3.png)

### Changed
- `docs`: Refined scope definition to explicitly exclude internet-shutdown scenarios (Iran 2026 case study added)
- `docs`: Trust Score engine framing updated — clarified as physical/geographical data integrity verification (not political speech judgment)

---

## [0.2.0] — 2026-03-31

### Added
- `docs`: Japanese proposal draft (proposal_ja.md) — 8-chapter structure
- `docs`: 3-layer system architecture design (Layer 1: CMS / Layer 2: Trust Engine / Layer 3: Visualizer)
- `docs`: CMS schema design — 27 fields across 4 groups including trust score fields
- `docs`: Architecture diagram (SVG, Re:Earth-based 3-layer structure)
- `docs`: User journey storyboard (Phase 0 / Phase 2 / Phase 3)
- `docs`: Mobile reporting form UI mockup
- `docs`: Government dashboard mockup with live data visualization

### Research
- Analyzed Iran 2026 internet blackout (98% traffic drop) — confirmed OUT OF SCOPE for internet-shutdown scenarios
- Reviewed historical precedents: Haiti 2010 (Ushahidi SMS 4636), Japan 2011 (Twitter), Kumamoto 2016 (LINE)
- Confirmed InnoCentive submission format: written proposal + interactive prototype/wireframe as attachment
- Confirmed UNDP misinformation policy alignment (iVerify, DPG standard)

---

## [0.1.0] — 2026-03-28

### Added
- `docs`: Initial theme selection and strategy proposal
- `docs`: UNDP challenge requirements analysis (Wazoku/InnoCentive platform)
- `docs`: Re:Earth capability assessment for crisis reporting use case
- `docs`: Competitive differentiation analysis (vs KoboToolbox, existing crisis tools)
- `docs`: Misinfomation/disinformation risk framing — confirmed as key differentiator
- `docs`: Document management strategy decision (Markdown → GitHub → PDF for submission)
- `docs`: Eukarya social GitHub rules confirmed via Notion Engineering Wiki

### Research
- UNDP Challenge #1 (underwater explosives) status: closed March 9, 2026; 385 solvers from 61 countries; results pending
- InnoCentive process confirmed: Register → Submit proposal+prototype → Evaluation → Shortlist → UNDP presentation
- Regional messaging app mapping (WhatsApp / LINE / Telegram / Viber by region)
- PWA offline access strategy validated against historical disaster cases

---

*Maintained by Eukarya Inc. | Follows Eukarya Engineering Guidelines (Conventional Commits)*
