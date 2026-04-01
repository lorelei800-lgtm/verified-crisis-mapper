# Verified Crisis Mapper

**An AI-Resilient, Trust-Scored Community Damage Reporting Platform**  
Built on Re:Earth — Open-Source WebGIS | Submitted by Eukarya Inc.

---

## Submission Information

| Field | Details |
|---|---|
| Submitting Organization | Eukarya Inc. (株式会社Eukarya) |
| Headquarters | Shibuya, Tokyo, Japan |
| CEO | Kenya Tamura (Geographer) |
| Core Platform | Re:Earth — Open-Source WebGIS (Apache-2.0) |
| Challenge | UNDP / Wazoku InnoCentive: Crisis Mapping Challenge |
| Contact | info@eukarya.io \| reearth.io |

---

## 1. Executive Summary

Eukarya Inc. proposes **Verified Crisis Mapper** — an open-source, AI-resilient community damage reporting platform built on Re:Earth, our production-grade WebGIS platform that currently powers Japan's national 3D city model initiative (Project PLATEAU, 300 municipalities, ~30TB of data).

The platform addresses UNDP's core requirement: enabling crisis-affected communities to submit geo-tagged photos and damage descriptions via mobile or web interfaces, with data displayed on a real-time map to guide humanitarian response.

Our key differentiator is a built-in **Trust Verification Engine** — a three-factor automated data quality layer that assigns each report a Trust Score (0–100). In an era of widespread AI-generated synthetic media, this feature ensures that decision-makers act on reliable ground-truth data rather than fabricated or erroneous reports.

> **Open-source statement:** Re:Earth is published under the Apache-2.0 license and is recognized as a Digital Public Good — fully satisfying UNDP's open-source requirement. All challenge-specific extensions will be released under the same license.

| Dimension | Details |
|---|---|
| Platform | Re:Earth WebGIS — Apache-2.0 OSS \| DPG certified |
| Unique Feature | Trust Score Engine — C2PA image verification + satellite cross-check + cross-report clustering |
| Proven Scale | PLATEAU: 300 municipalities, 30TB — same infrastructure, scaled for crisis reporting |
| Honest Scope | Natural disasters + non-shutdown conflicts; explicit out-of-scope for internet-blackout scenarios |

---

## 2. Problem Statement

### 2.1 The Information Gap in Crisis Response

In the critical 72 hours following a major disaster, humanitarian responders routinely make resource allocation decisions with incomplete, delayed, or geographically inaccurate data. Satellite imagery provides macro-level analysis but cannot resolve individual infrastructure damage. Ground-level human reporting is essential — yet no scalable, low-friction system exists to collect, validate, and visualize this data in real time.

### 2.2 The New Threat: AI-Generated Disinformation in Crisis Reporting

A critical emerging challenge — not addressed in existing crisis reporting tools — is the integrity of crowd-sourced data in the age of generative AI:

- AI-generated fake images of damage (Sora and equivalent tools) can be fabricated at near-zero cost and submitted to reporting systems, misdirecting aid to non-affected areas.
- Coordinated mass-reporting campaigns can manipulate priority rankings for political or logistical gain.
- GPS coordinate spoofing can redirect emergency resources to incorrect locations.
- Recycled images from past disasters (miscontextualized) frequently circulate during active crises.

> **2026 Iran conflict case:** During the Iran internet blackout (February 28, 2026), internet traffic dropped by 98%. AI-generated imagery was used deliberately to obscure the true scale and location of civilian casualties (Chatham House, March 2026; HRW, March 2026). Our Trust Score engine directly addresses this class of threat — for scenarios where internet access is maintained.

### 2.3 Honest Scope Definition

We define three distinct crisis communication environments and are explicit about what our system can and cannot do:

| Crisis Type | Scope | Rationale |
|---|---|---|
| Natural disasters (earthquake, flood, storm) | **IN SCOPE** | Government maintains internet access. PWA pre-installation and post-disaster SMS/radio URL distribution are both viable. Primary target scenario. |
| Conflict / post-conflict (government does NOT shut internet) | **IN SCOPE** | Internet access remains available through partial infrastructure. System functions as designed. |
| Conflict with government-imposed internet shutdown (Iran 2026 model) | **OUT OF SCOPE** | A 98% internet blackout renders all web-based tools ineffective. This is a political infrastructure problem beyond software design scope. Direct-to-Cell (D2C) satellite technology is identified as the future pathway and will be explored in Phase 4+ roadmap. |

This scope transparency reflects our engineering philosophy: a system that honestly defines its boundaries is more trustworthy than one that overpromises.

---

## 3. Solution: Verified Crisis Mapper

### 3.1 Three-Layer Architecture

| Layer | Description |
|---|---|
| **Layer 1 — Data Collection** (Re:Earth CMS) | Smartphone/web form for submitting photos, GPS-tagged location, damage category, and description. EXIF metadata and timestamps are auto-captured. Designed for minimal friction — operable with one hand, 3-tap completion for core fields. Supports offline-first operation via PWA service worker with Background Sync. |
| **Layer 2 — Trust Verification Engine** ★ Key Differentiator | Automated data quality assurance: (1) Image authenticity via C2PA standard + EXIF consistency + AI-generation fingerprint matching; (2) Geospatial consistency via satellite damage analysis cross-reference; (3) Cross-report validation via H3 spatial clustering and outlier detection; (4) Trust Score (0–100) auto-assigned to each report; (5) Score routing: ≥80 → map display (green); 50–79 → flagged display (amber); <50 → human review queue (red). |
| **Layer 3 — Visualization & Decision Support** (Re:Earth Visualizer) | Government/UNDP dashboard with real-time trust-tier color-coded map, priority area auto-ranking, satellite overlay, and structured GeoJSON/CSV export for WFP, OCHA, and partner system integration. |

### 3.2 User Journey

#### Phase 0 — Before the Disaster: Community Preparedness

![Phase 0 — Community preparedness: residents scan QR code to install PWA during a disaster drill](images/phase_0.png)

*Fig. 1 — During a community preparedness drill, a local government staff member distributes QR codes. Residents scan once to install the PWA — from this point, the reporting form works offline on their device.*

The critical design insight from historical precedent (Haiti 2010 SMS "4636", Kumamoto 2016 LINE) is that new tools cannot be learned during a crisis. The PWA installation takes approximately 10 seconds via QR code scan during a routine preparedness drill. Once installed, the reporting form is cached on-device and launches instantly — even without network connectivity.

#### Phase 2 — The Reporting Window: 2–72 Hours Post-Disaster

![Phase 2 — Resident photographs damage with GPS auto-tagged on smartphone](images/phase_2.png)

*Fig. 2 — In the reporting window (2–72 hours post-disaster), a resident photographs damage with GPS auto-tagged. An emergency van broadcasts the URL via SMS to reach residents without prior PWA installation.*

Two access routes:
- **Route A (pre-installed PWA):** Tap home screen icon → camera launches → GPS auto-captures → 3-tap form completion → data queued for sync. Zero network dependency during entry.
- **Route B (first-time access):** Emergency responders broadcast the URL via SMS blast, radio, or shelter signage. Residents with restored connectivity access the form via browser.

Offline resilience: Background Sync API queues submissions locally; data transmits automatically when connectivity returns — no user action required.

#### Phase 3 — Command & Decision: Real-Time Situational Awareness

![Phase 3 — Government and UNDP officials view Re:Earth Visualizer dashboard](images/phase_3.png)

*Fig. 3 — Government and UNDP officials in a joint operations center view the Re:Earth Visualizer dashboard. Color-coded pins and priority zone circles guide resource deployment decisions.*

### 3.3 Trust Score Engine — Technical Design

| Factor | Weight | Method |
|---|---|---|
| Image Authenticity | 40 pts | C2PA (Content Credentials) metadata verification; EXIF date/GPS consistency; AI-generation fingerprint pattern matching |
| Geospatial Consistency | 30 pts | Reported coordinates cross-referenced against satellite-derived damage probability map; historical baseline comparison |
| Cross-Report Validation | 20 pts | H3 spatial grid clustering (resolution 9, ~105m cells); outlier detection against neighbor report characteristics |
| Submission Metadata | 10 pts | Device timestamp plausibility; GPS accuracy radius; submission channel reliability weighting |
| Score Routing | — | 80–100: High Trust → map display (green) \| 50–79: Review → flagged display (amber) \| 0–49: Verify → human review queue (red) |

> **Political neutrality note:** The Trust Score engine addresses physical/geographical data integrity — verifying that a reported building collapse is real and correctly located. It does NOT evaluate political speech, opinion, or user identity. This keeps the system politically neutral and focused on its humanitarian purpose.

---

## 4. Technical Specifications & Open-Source Compliance

### 4.1 Technology Stack

| Component | Technology |
|---|---|
| Frontend / Visualization | Re:Earth Visualizer — React, TypeScript, CesiumJS (WGS84 globe) |
| Backend / CMS | Re:Earth CMS — Go, Rust; headless CMS with REST/GraphQL API |
| Plugin System | WebAssembly-based sandboxed plugin runtime |
| Offline / PWA | Service Worker + Background Sync API; IndexedDB local storage |
| Image Verification | C2PA open standard (Coalition for Content Provenance and Authenticity) |
| Spatial Indexing | Uber H3 hexagonal grid (resolution 9) for cross-report clustering |
| Data Export | GeoJSON, CSV — compatible with HDX, OCHA IM Toolbox, KoboToolbox |
| Hosting | Cloud-agnostic; Docker containerized; government-deployable |

### 4.2 Open-Source Requirements

- **License:** Apache-2.0 (commercial use, modification, redistribution all permitted)
- **Repository:** github.com/reearth — all challenge-specific extensions published under same license
- **Digital Public Good:** Meets DPGA standards (open source, open data, privacy-protecting, does no harm)
- **UNDP iVerify alignment:** Architecture is consistent with UNDP's existing OSS approach to information integrity tools

### 4.3 Privacy & Security Design

- Reporter contact information is optional and stored encrypted at rest
- No biometric data collection; no behavioral profiling
- Trust Score computation is fully transparent and auditable — open-source algorithm
- GDPR-compatible data handling; configurable data retention policies per deployment
- Role-based access control: reporters see submission confirmation only; government/UNDP operators see aggregated dashboard

---

## 5. Eukarya Inc. — Track Record & Credentials

Eukarya Inc. is a Tokyo-based geospatial technology company founded from the University of Tokyo's Watanabe Lab. Our mission: making geospatial data accessible to everyone, as a digital public good.

| Partner / Project | Description | Relevance |
|---|---|---|
| Project PLATEAU (MLIT Japan) | National 3D city model platform — 300 municipalities, ~30TB of data. Re:Earth serves as the visualization and CMS backbone. | Disaster preparedness, urban infrastructure |
| UNIDO Ukraine 3D City Model | UN Industrial Development Organization adoption of Re:Earth for a nationwide digital twin feasibility study in Ukraine. | Post-conflict reconstruction |
| UNDP / OCHA Compatibility | Re:Earth data output (GeoJSON/CSV) is fully compatible with KoboToolbox, HDX, and OCHA IM Toolbox standards used by UNDP field teams. | Humanitarian data interoperability |
| Princeton University | Academic adoption of Re:Earth for research and educational data visualization. | Knowledge sharing, public good |
| FOSS4G (Global OSS GIS Conference) | Regular presenter at the world's largest open-source GIS conference. | OSS credibility, global network |

---

## 6. Implementation Plan

| Phase | Timeline | Title | Deliverables |
|---|---|---|---|
| Phase 1 | 0–3 months | Core Platform MVP | Re:Earth CMS schema, PWA form, basic map visualization, trust score MVP |
| Phase 2 | 3–6 months | Verification Engine | C2PA module, satellite API integration, geospatial consistency engine, full dashboard UI |
| Phase 3 | 6–12 months | Field Testing | Pilot in UNDP target region, multilingual UI (Arabic, French, Spanish, Swahili), offline optimization |
| Phase 4 | 12+ months | Scale & Future Tech | Multi-region deployment, OCHA/WFP API integration, D2C satellite connectivity exploration |

### 6.1 Prototype Status at Submission

At the time of proposal submission, the following components are operational and demonstrable via live URL:

- Re:Earth CMS: Damage report schema with trust_score fields, form deployment, API access
- Re:Earth Visualizer: Real-time map with trust-score color coding, priority area ranking, satellite overlay
- Trust Score MVP: Mock implementation demonstrating the full scoring pipeline and routing logic
- PWA offline functionality: Form caches on-device, Background Sync queues submissions for deferred transmission

> **Implementation note:** Full Trust Score engine implementation (live C2PA verification, satellite API integration) is scoped for Phase 2 following shortlist selection. The prototype demonstrates the complete user journey and data model — the verification layer is architected and documented, using simulated scoring for the prototype demo.

---

## 7. Expected Impact

### 7.1 Direct Humanitarian Impact

- Reduce the information gap in crisis initial response from days to hours
- Provide decision-makers with trust-calibrated data — knowing not just where damage is reported, but how confident to be in each report
- Protect against AI-generated disinformation that could misdirect limited humanitarian resources
- Enable GeoJSON/CSV data export for direct integration with WFP, OCHA, and other UNDP partner systems

### 7.2 Long-Term Systemic Impact

- Open-source publication allows any humanitarian organization, government, or NGO to deploy at zero licensing cost
- Trust Score engine is applicable beyond crisis reporting: election monitoring, environmental damage reporting, conflict documentation
- Establishes a community of practice around AI-resilient humanitarian data collection
- UNDP collaboration positions Verified Crisis Mapper as a potential global standard for community-powered crisis data integrity

### 7.3 Alignment with UNDP Strategic Priorities

- **Digital Public Goods:** Re:Earth is already DPG-aligned; this project extends that infrastructure into a new humanitarian domain
- **Information Integrity:** Directly supports UNDP's existing iVerify initiative and broader mis/disinformation mitigation mandate
- **SDG 11** (Sustainable Cities) and **SDG 17** (Partnerships): Open infrastructure that governments can own and operate

---

*Submitted by Eukarya Inc. | info@eukarya.io | github.com/reearth | reearth.io*  
*Re:Earth — Opening Up Data for All | Apache-2.0 Open Source | Digital Public Good*
