# Verified Crisis Mapper

**An AI-Resilient, Trust-Scored Community Damage Reporting Platform**  
Built on Re:Earth — Open-Source WebGIS | Submitted by Eukarya Inc.

---

## Submission Information

| Field | Details |
|---|---|
| Submitting Organization | Eukarya Inc. (株式会社Eukarya) |
| Headquarters | Shibuya, Tokyo, Japan |
| CEO | Kenya Tamura |
| Core Platform | Re:Earth — Open-Source WebGIS (Apache-2.0) |
| Challenge | UNDP / Wazoku InnoCentive: Crisis Mapping Challenge |
| Contact | info@eukarya.io |

---

## 1. Executive Summary

Eukarya Inc. proposes **Verified Crisis Mapper** — an open-source, AI-resilient community damage reporting platform built on Re:Earth, our production-grade WebGIS platform that currently powers Japan's national 3D city model initiative (Project PLATEAU, 300 municipalities, ~30TB of data).[^12]

The platform addresses UNDP's core requirement: enabling crisis-affected communities to submit geo-tagged photos and damage descriptions via mobile or web interfaces, with data displayed on a real-time map to guide humanitarian response.

Our key differentiator is a built-in **Trust Verification Engine** — a three-factor automated data quality layer that assigns each report a Trust Score (0–100). In an era of widespread AI-generated synthetic media, this feature ensures that decision-makers act on reliable ground-truth data rather than fabricated or erroneous reports.

> **Open-source statement:** Re:Earth is published under the Apache-2.0 license — fully satisfying UNDP's open-source requirement. All challenge-specific extensions will be released under the same license.

| Dimension | Details |
|---|---|
| Platform | Re:Earth WebGIS — Apache-2.0 OSS |
| Unique Feature | Trust Score Engine — AI-generation detection + satellite cross-check + H3 spatial clustering + C2PA when available[^8] |
| Proven Scale | PLATEAU: 300 municipalities, 30TB[^12] — same infrastructure, scaled for crisis reporting |
| Honest Scope | Natural disasters + non-shutdown conflicts; explicit out-of-scope for internet-blackout scenarios |

---

## 2. Problem Statement

### 2.1 The Information Gap in Crisis Response

In the critical 72 hours[^1] following a major disaster, humanitarian responders routinely make resource allocation decisions with incomplete, delayed, or geographically inaccurate data. Satellite imagery provides macro-level analysis but cannot resolve individual infrastructure damage. Ground-level human reporting is essential — yet no scalable, low-friction system exists to collect, validate, and visualize this data in real time.

### 2.2 The New Threat: AI-Generated Disinformation in Crisis Reporting

A critical emerging challenge — not addressed in existing crisis reporting tools — is the integrity of crowd-sourced data in the age of generative AI:

- AI-generated fake images of damage can be fabricated at near-zero cost using widely available AI image and video synthesis tools, and submitted to reporting systems, misdirecting aid to non-affected areas.[^2]
- Coordinated mass-reporting campaigns can manipulate priority rankings for political or logistical gain.[^3]
- GPS coordinate spoofing can redirect emergency resources to incorrect locations.
- Recycled images from past disasters (miscontextualized) frequently circulate during active crises.[^3]

### 2.3 Honest Scope Definition

We define three distinct crisis communication environments and are explicit about what our system can and cannot do:

| Crisis Type | Scope | Rationale |
|---|---|---|
| Natural disasters (earthquake, flood, storm) | **IN SCOPE** | Government maintains internet access. PWA pre-installation and post-disaster SMS/radio URL distribution are both viable. Primary target scenario. |
| Conflict / post-conflict (government does NOT shut internet) | **IN SCOPE** | Internet access remains available through partial infrastructure. System functions as designed. |
| Conflict with government-imposed internet shutdown | **OUT OF SCOPE** | A full internet blackout renders all web-based tools ineffective. This is a political infrastructure problem beyond software design scope. Direct-to-Cell (D2C) satellite technology is identified as the future pathway and will be explored in Phase 4+ roadmap. |

This scope transparency reflects our engineering philosophy: a system that honestly defines its boundaries is more trustworthy than one that overpromises.

---

## 3. Solution: Verified Crisis Mapper

### 3.1 Three-Layer Architecture

| Layer | Description |
|---|---|
| **Layer 1 — Data Collection** (Re:Earth CMS) | Smartphone/web form for submitting photos, GPS-tagged location, damage category, and description. EXIF metadata and timestamps are auto-captured. Designed for minimal friction — operable with one hand, 3-tap completion for core fields. Supports offline-first operation via PWA service worker with Background Sync. |
| **Layer 2 — Trust Verification Engine** ★ Key Differentiator | Automated data quality assurance: (1) Image integrity via AI-generation fingerprint detection + EXIF GPS/timestamp consistency + C2PA verification[^8] when available on the submitting device; (2) Geospatial consistency via satellite damage analysis cross-reference; (3) Cross-report validation via H3 spatial clustering[^9] and outlier detection; (4) Trust Score (0–100) auto-assigned to each report; (5) Score routing: ≥80 → map display (green); 50–79 → flagged display (amber); <50 → human review queue (red). |
| **Layer 3 — Visualization & Decision Support** (React PWA Dashboard) | Mobile-first, installable Progressive Web App dashboard for government and UNDP operators. Displays real-time trust-tier color-coded map (MapLibre GL JS + satellite imagery), priority area auto-ranking, and structured GeoJSON/CSV export for WFP, OCHA, and partner system integration. Runs on any smartphone or desktop browser — no separate app installation required beyond the single PWA. |

### 3.2 User Journey

#### Phase 1 — Before the Disaster: Community Preparedness

![Phase 1 — Community preparedness: residents scan QR code to install PWA during a disaster drill](images/phase_0.png)

*Fig. 1 — During a community preparedness drill, a local government staff member distributes QR codes. Residents scan once to install the PWA — from this point, the reporting form works offline on their device.*

The critical design insight from historical precedent (Haiti 2010 SMS "4636"[^6], Kumamoto 2016 LINE[^7]) is that new tools cannot be learned during a crisis. The PWA installation takes approximately 10 seconds via QR code scan during a routine preparedness drill. Once installed, the reporting form is cached on-device and launches instantly — even without network connectivity.

#### Phase 2 — The Reporting Window: 2–72 Hours Post-Disaster

![Phase 2 — Resident photographs damage with GPS auto-tagged on smartphone](images/phase_2.png)

*Fig. 2 — In the reporting window (2–72 hours post-disaster), a resident photographs damage with GPS auto-tagged. An emergency van broadcasts the URL via SMS to reach residents without prior PWA installation.*

Three access routes:
- **Route A (pre-installed PWA):** Tap home screen icon → camera launches → GPS auto-captures → 3-tap form completion → data queued for sync. Zero network dependency during entry.
- **Route B (first-time access):** Emergency responders broadcast the URL via SMS blast, radio, or shelter signage. Residents with restored connectivity access the form via browser.
- **Route C (WhatsApp Business API bot):** For residents who will not install an app and do not have a browser link, a WhatsApp bot accepts photo + location + damage description via familiar chat interface. The bot normalises submissions into the same CMS schema as Routes A/B — all three routes feed the same Trust Score pipeline and map.

Offline resilience: Background Sync API queues submissions locally; data transmits automatically when connectivity returns — no user action required.

#### Phase 3 — Command & Decision: Real-Time Situational Awareness

![Phase 3 — Government and UNDP officials view Verified Crisis Mapper dashboard](images/phase_3.png)

*Fig. 3 — Government and UNDP officials in a joint operations center view the Verified Crisis Mapper dashboard. Trust-tier color-coded pins (green/amber/red) and satellite imagery guide resource deployment decisions. The same PWA used for field reporting doubles as the operator dashboard — a single codebase for all users.*

### 3.3 Trust Score Engine — Technical Design

| Factor | Weight | Method |
|---|---|---|
| Image Integrity | 40 pts | Primary: AI-generation fingerprint detection (frequency-domain analysis applied to all submissions); EXIF GPS/timestamp consistency check; C2PA (Content Credentials)[^8] cryptographic verification applied as a high-confidence bonus where supported by the submitting device. Note: C2PA hardware support remains limited in crisis-affected regions; the scoring model is designed to function without it. |
| Geospatial Consistency | 30 pts | Reported coordinates cross-referenced against satellite-derived damage probability map; historical baseline comparison |
| Cross-Report Validation | 20 pts | H3 spatial grid clustering[^9] (resolution 9, ~0.105 km² cells); outlier detection against neighbor report characteristics; graceful degradation to neutral score during sparse early-reporting phase |
| Submission Metadata | 10 pts | Device timestamp plausibility; GPS accuracy radius; submission channel reliability weighting |
| Score Routing | — | 80–100: High Trust → map display (green) \| 50–79: Review → flagged display (amber) \| 0–49: Verify → human review queue (red) |

> **Political neutrality note:** The Trust Score engine addresses physical/geographical data integrity — verifying that a reported building collapse is real and correctly located. It does NOT evaluate political speech, opinion, or user identity. This keeps the system politically neutral and focused on its humanitarian purpose.

> **Design honesty note:** The Image Integrity factor applies AI-generation detection and EXIF analysis to all submissions. C2PA cryptographic verification contributes as a high-confidence signal when present, but the system is explicitly designed not to require it — ensuring equal treatment of reports from low-end devices and WhatsApp Route C submissions where metadata is stripped in transit.

---

## 4. Technical Specifications & Open-Source Compliance

### 4.1 Technology Stack

| Component | Technology |
|---|---|
| Frontend / Visualization | React PWA + MapLibre GL JS — mobile-first, installable, Apache-2.0 OSS |
| Backend / CMS | Re:Earth CMS — Go, Rust; headless CMS with REST/GraphQL API |
| Plugin System | WebAssembly-based sandboxed plugin runtime |
| Offline / PWA | Service Worker + Background Sync API; IndexedDB local storage |
| Image Verification | C2PA open standard (Coalition for Content Provenance and Authenticity)[^8] |
| Spatial Indexing | Uber H3 hexagonal grid[^9] (resolution 9) for cross-report clustering |
| Data Export | GeoJSON, CSV — compatible with HDX, OCHA IM Toolbox, KoboToolbox |
| Hosting | Cloud-agnostic; Docker containerized; government-deployable |

### 4.2 Open-Source Requirements

- **License:** Apache-2.0 (commercial use, modification, redistribution all permitted)
- **Repository:** github.com/reearth — all challenge-specific extensions published under same license

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
| Project PLATEAU (MLIT Japan)[^12] | National 3D city model platform — 300 municipalities, ~30TB of data. Re:Earth serves as the visualization and CMS backbone. | Disaster preparedness, urban infrastructure |
| UNDP / OCHA Compatibility | Re:Earth data output (GeoJSON/CSV) is fully compatible with KoboToolbox, HDX, and OCHA IM Toolbox standards used by UNDP field teams. | Humanitarian data interoperability |
| FOSS4G (Global OSS GIS Conference)[^15] | Regular presenter at the world's largest open-source GIS conference. | OSS credibility, global network |

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

**Live demo:** https://lorelei800-lgtm.github.io/verified-crisis-mapper/demo/
*(Deployment: Tokyo Flood Response, Kanda River Basin — Chiyoda / Kanda area)*

- **Reporting PWA:** Mobile-first damage report form with photo upload, GPS auto-capture with Nominatim reverse geocoding (landmark + district auto-fill), damage classification (Minimal / Partially Damaged / Completely Destroyed), 8 infrastructure categories, and real-time Trust Score result display immediately after submission. Operates without GPS (graceful degradation with user guidance). Offline-first: submissions queue via IndexedDB and auto-sync via Background Sync when connectivity returns.
- **Map-Based Location Picker:** Full-screen satellite map overlay (floating-pin style) for mobile location selection — user pans map under a fixed CSS center pin, then confirms with `map.getCenter()`. Eliminates Android Chrome tap reliability issues. Lazy-loaded to keep main bundle at ~62KB gzip.
- **Operator Dashboard:** React + MapLibre GL JS satellite map with color-coded reports (green ≥ 80 / amber 50–79 / red < 50), zoom-adaptive marker clustering (individual pins at zoom ≥ 12; cluster count badges at lower zoom), tier and infrastructure filtering, sort by newest or Trust Score, and per-report Trust Score breakdown. Citizens access the dashboard freely — no viewer PIN gate.
- **Staff Login Button:** "Government / Municipal Staff Login" link embedded in the Dashboard (desktop sidebar bottom; mobile statistics overlay bottom) — navigates directly to the Admin PIN screen without requiring the logo secret-tap.
- **Admin Review Panel:** PIN-authenticated government operator view with progressive lockout (3 failed attempts → 30-second lockout; 6+ attempts → 120-second lockout). Three-button review workflow: **Approve** / **↩ Pending** / **Reject** — the Pending button allows reviewers to revert a decision for re-examination. Reject includes a 6-option reason dropdown. All decisions are written back to Re:Earth CMS and propagate to all connected dashboards within 30 seconds.
- **Cross-Device Real-Time Sync:** Review decisions and new submissions appear on all connected devices within 30 seconds via CMS polling.
- **Trust Score MVP:** Full scoring pipeline demonstrated — image integrity, geospatial consistency, cross-report validation, and submission metadata factors. Score breakdown displayed as bar chart in both the reporter confirmation screen and the Admin detail card.
- **Re:Earth CMS:** Single-deployment model — one CMS project per deployment context (city/region), with `deployment-config` model (bounds, area, admin_pin, labels) and `damage-reports` model (15 fields including trust score sub-scores, review_status, reject_reason, image asset). Production-ready backend for multi-device, multi-operator deployment.

> **TRL Status:** TRL 4–5 at submission. Core data collection, verification pipeline, and multi-device operator workflow are functional. Full Trust Score engine (live C2PA verification, satellite API integration) is scoped for Phase 2 following shortlist selection.

---

## 7. Expected Impact

### 7.1 Direct Humanitarian Impact

- Reduce the information gap in crisis initial response from days to hours[^1]
- Provide decision-makers with trust-calibrated data — knowing not just where damage is reported, but how confident to be in each report
- Protect against AI-generated disinformation[^2] that could misdirect limited humanitarian resources
- Enable GeoJSON/CSV data export for direct integration with WFP, OCHA, and other UNDP partner systems

### 7.2 Long-Term Systemic Impact

- Open-source publication allows any humanitarian organization, government, or NGO to deploy at zero licensing cost
- Trust Score engine is applicable beyond crisis reporting: election monitoring, environmental damage reporting, conflict documentation
- Establishes a community of practice around AI-resilient humanitarian data collection
- UNDP collaboration positions Verified Crisis Mapper as a potential global standard for community-powered crisis data integrity

### 7.3 Alignment with UNDP Strategic Priorities

- **Information Integrity:** Directly supports UNDP's broader mis/disinformation mitigation mandate
- **SDG 11** (Sustainable Cities) and **SDG 17** (Partnerships)[^16]: Open infrastructure that governments can own and operate

---

## References

[^1]: UN Office for the Coordination of Humanitarian Affairs (OCHA). (2013). *Humanitarianism in the Network Age*. New York: United Nations. The "critical 72 hours" framing also appears in: Inter-Agency Standing Committee (IASC). (2012). *Reference Module for Cluster Coordination at the Country Level*. Geneva: IASC; and International Federation of Red Cross and Red Crescent Societies (IFRC). (2013). *World Disasters Report 2013: Focus on Technology and the Future of Humanitarian Action*. Geneva: IFRC.

[^2]: Chesney, R. & Citron, D.K. (2019). "Deep Fakes: A Looming Challenge for Privacy, Democracy, and National Security." *California Law Review*, 107(6), 1753–1820. See also: Vaccari, C. & Chadwick, A. (2020). "Deepfakes and Disinformation: Exploring the Impact of Synthetic Political Video on Deception, Uncertainty, and Trust in News." *Social Media + Society*, 6(1), 1–13. https://doi.org/10.1177/2056305120903408

[^3]: Wardle, C. & Derakhshan, H. (2017). *Information Disorder: Toward an Interdisciplinary Framework for Research and Policy Making*. Council of Europe Report DGI(2017)09. Strasbourg: Council of Europe.

[^6]: Heinzelman, J. & Waters, C. (2010). *Crowdsourcing Crisis Information in Disaster-Affected Haiti*. Special Report 252. Washington, D.C.: United States Institute of Peace. See also: Meier, P. (2012). "Crisis Mapping in Action: How Open Source Software and Global Volunteer Networks Are Changing the World, One Map at a Time." *Journal of Map & Geography Libraries*, 8(2), 89–100.

[^7]: Cabinet Office, Government of Japan. (2016). *Heisei 28-nen Kumamoto Jishin ni kakawaru Kinkyu Taiou* [Emergency Response Measures for the 2016 Kumamoto Earthquake]. Tokyo: Cabinet Office of Japan. For broader context: Reuter, C., Hughes, A.L., & Kaufhold, M-A. (2018). "Social Media in Crisis Management: An Evaluation and Analysis of Crisis Informatics Research." *International Journal of Human–Computer Interaction*, 34(4), 280–294. https://doi.org/10.1080/10447318.2018.1427832

[^8]: Coalition for Content Provenance and Authenticity (C2PA). (2023). *C2PA Technical Specification v1.3*. https://c2pa.org/specifications/ The C2PA is an industry consortium including Adobe, Microsoft, BBC, and Intel developing an open standard for cryptographically signed provenance metadata attached to digital media files.

[^9]: Brodsky, I. (2018). "H3: Uber's Hexagonal Hierarchical Spatial Index." *Uber Engineering Blog*, 27 June 2018. https://www.uber.com/blog/h3/ H3 resolution 9 has an average hexagon area of 0.1053 km² and average edge length of approximately 174 m.

[^12]: Ministry of Land, Infrastructure, Transport and Tourism (MLIT), Japan. *Project PLATEAU: 3D City Model Initiative*. https://www.mlit.go.jp/plateau/

[^15]: Open Source Geospatial Foundation (OSGeo). *FOSS4G — Free and Open Source Software for Geospatial*. https://www.osgeo.org/initiatives/foss4g/ FOSS4G has been held annually since 2004 and is the flagship international conference of the OSGeo Foundation.

[^16]: United Nations. (2015). *Transforming Our World: The 2030 Agenda for Sustainable Development*. Resolution A/RES/70/1. New York: United Nations.

---

*Submitted by Eukarya Inc. | info@eukarya.io | github.com/reearth | reearth.io*  
*Re:Earth — Opening Up Data for All | Apache-2.0 Open Source*
