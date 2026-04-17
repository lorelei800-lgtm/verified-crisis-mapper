# Verified Crisis Mapper

**An AI-Resilient, Trust-Scored Community Damage Reporting Platform**

> Submitted to the UNDP Global Innovation Challenge #2 — Crisis Impact Reporting  
> Built on [Re:Earth](https://reearth.io) by **Eukarya Inc.**

---

## What is this?

Verified Crisis Mapper is an open-source platform that enables crisis-affected communities to report damage in real time via smartphone or web browser. Reports are geo-tagged, photo-verified, and automatically scored for data trustworthiness — helping governments and UNDP direct aid where it is needed most.

### Key differentiator: Trust Score Engine

Every submitted report receives a Trust Score (0–100) computed from:

| Factor | Weight |
|---|---|
| Image authenticity (C2PA verification + AI-generation detection) | 40 pts |
| Geospatial consistency (satellite cross-reference) | 30 pts |
| Cross-report validation (H3 spatial clustering) | 20 pts |
| Submission metadata integrity | 10 pts |

- **Score ≥ 80** → High Trust → displayed on map (green)
- **Score 50–79** → Review → flagged display (amber)
- **Score < 50** → Human review queue (red)

---

## User Journey

### Phase 0 — Before the disaster: community preparedness

![Phase 0 — Community preparedness drill](proposal/images/phase_0.png)

During a disaster preparedness drill, residents scan a QR code to install the PWA. From this point, the reporting form works offline on their device.

### Phase 2 — The reporting window: 2–72 hours post-disaster

![Phase 2 — Resident reports damage](proposal/images/phase_2.png)

Tap the home screen icon → camera launches → GPS auto-captures → 3-tap form → data queued for sync. Works offline; auto-syncs when connectivity returns.

### Phase 3 — Command & decision: real-time situational awareness

![Phase 3 — Government dashboard](proposal/images/phase_3.png)

Government and UNDP officials view the live dashboard — a React PWA with MapLibre GL JS satellite imagery. Color-coded pins and Trust Score breakdowns guide resource deployment decisions.

---

## Live Demo

**👉 https://lorelei800-lgtm.github.io/verified-crisis-mapper/demo/**

*(Scenario: Tokyo Flood Response — Chiyoda / Kanda River Basin)*

### What's implemented

| Feature | Status |
|---|---|
| Mobile damage report form (photo, GPS, damage classification, 8 infra types) | ✅ Live |
| Map-based location picker (floating-pin satellite overlay, no tap detection) | ✅ Live |
| Offline-first submission queue (IndexedDB + Background Sync) | ✅ Live |
| Trust Score display immediately after submission (4-factor breakdown) | ✅ Live |
| MapLibre GL JS satellite dashboard with color-coded pins (green/amber/red) | ✅ Live |
| Zoom-adaptive marker clustering | ✅ Live |
| Admin Review Panel — PIN auth with lockout (3 fails → 30s; 6+ → 120s) | ✅ Live |
| Admin 3-button review: Approve / ↩ Pending / Reject (with reject reason) | ✅ Live |
| Staff Login button in Dashboard (desktop sidebar + mobile overlay) | ✅ Live |
| Re:Earth CMS write-back + 30-second cross-device sync | ✅ Live |
| Free citizen access — no PIN gate required | ✅ Live |

---

## Documents

| Document | Description |
|---|---|
| [proposal/proposal_en.md](proposal/proposal_en.md) | Full English proposal (7 chapters) |
| [proposal/form_fields_en.md](proposal/form_fields_en.md) | InnoCentive form field texts (6 fields) |
| [CHANGELOG.md](CHANGELOG.md) | Revision history |

---

## Platform

Built on **Re:Earth** — the world's first scalable open-source WebGIS platform.

- License: Apache-2.0
- Repository: [github.com/reearth](https://github.com/reearth)
- Published under Apache-2.0 — freely deployable by any government or humanitarian organization

---

*Submitted by Eukarya Inc. | info@eukarya.io | [reearth.io](https://reearth.io)*
