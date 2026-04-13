# Verified Crisis Mapper — InnoCentive Form Field Texts

**Submitting Organization:** Eukarya Inc.  
**Participation Type:** Organization  
**Technology Readiness Level:** TRL 4–5  
**Challenge:** UNDP / Wazoku InnoCentive — Build the Future of Crisis Mapping

> Field 2 (Solution Overview) is expandable beyond 500 words per InnoCentive guidance.  
> All other fields are limited to 500 words.  
> `proposal_en.md` (full 7-chapter proposal) is submitted as an attachment.

---

## Field 1 — Problem & Opportunity

In the 72 hours following a sudden-onset disaster, humanitarian responders routinely make resource allocation decisions on incomplete, delayed, or geographically inaccurate data. Satellite imagery provides macro-level analysis but cannot resolve individual infrastructure damage. Ground-level human reporting is essential — yet no scalable, low-friction system currently exists to collect, validate, and visualize this data in real time.

The consequence is predictable: aid concentrates in visible, accessible areas while equally affected communities remain unmapped and unreached. In the 2010 Haiti earthquake, the absence of structured community damage data caused resource misallocation that persisted for weeks. In the 2016 Kumamoto earthquake, informal messaging groups became de facto reporting systems — functional but unstructured, unverifiable, and invisible to official coordination.

**A New and Unaddressed Threat: AI-Generated Disinformation**

A critical emerging challenge — not addressed by any existing crisis reporting tool — is the integrity of crowd-sourced data in the age of generative AI. Synthetic damage images can now be fabricated at near-zero cost using widely available AI image and video synthesis tools, with sufficient realism to deceive both automated systems and human reviewers. These images can be submitted to reporting platforms to misdirect aid to non-affected areas — or deny aid to genuinely affected ones.

Coordinated mass-reporting campaigns can manipulate damage priority rankings for political gain. GPS spoofing redirects emergency resources to incorrect locations. Recycled images from past disasters circulate widely during active crises, amplified by social media. No existing crisis reporting tool — including KoboToolbox, OpenStreetMap Tasking Manager, or Ushahidi — provides systematic automated verification capable of addressing AI-generated content.

**Honest Scope Definition**

We define our operating environment with deliberate transparency:

- **Natural disasters (earthquake, flood, storm, wildfire):** In scope. Government infrastructure remains operational; PWA pre-installation and SMS/radio URL distribution are both viable.
- **Conflict where government does not impose internet shutdown:** In scope. Partial infrastructure supports PWA and WhatsApp-based reporting.
- **Government-imposed full internet shutdown:** Explicitly out of scope. This is a political infrastructure problem no web-based tool can solve. Direct-to-Cell (D2C) satellite connectivity is the identified future pathway and is scoped for Phase 4.

This honest scope definition is itself a design principle. A system that clearly defines its limits is more trustworthy to decision-makers than one that overpromises.

---

## Field 2 — Solution Overview

**Verified Crisis Mapper** is a three-layer open-source platform built on Re:Earth — Eukarya's production-grade WebGIS — enabling crisis-affected communities to submit geo-tagged damage reports that are automatically verified for trustworthiness and visualized in real time.

**Layer 1 — Data Collection**

Three access routes ensure maximum reach:

- **Route A (Pre-installed PWA):** During preparedness drills, residents scan a QR code to install the Progressive Web App. In a crisis, they tap the home screen icon, photograph damage with GPS auto-capture, complete a 3-tap form, and submit. Offline-first: submissions queue locally via Service Worker and transmit automatically via Background Sync when connectivity returns.
- **Route B (First-time browser access):** Emergency responders broadcast a URL via SMS, radio, or shelter signage. Residents access the form directly in their mobile browser.
- **Route C (WhatsApp):** Users send a photo to a dedicated WhatsApp Business API number. The bot returns a damage classification prompt (1: Minimal / 2: Partially Damaged / 3: Completely Destroyed), captures GPS metadata from the image, and ingests the report into the system — zero app installation required.

Each submission collects: photo, damage classification (Minimal / Partially Damaged / Completely Destroyed), infrastructure type (8 categories: Residential, Commercial, Government, Utility, Transport/Communication, Community, Public Space, Other), crisis nature (natural hazard / technological / human-made), debris clearance assessment, GPS coordinates, and textual landmark description as GPS fallback.

**Layer 2 — Trust Verification Engine**

Each report is automatically assigned a Trust Score (0–100):

| Factor | Weight |
|---|---|
| Image Integrity (AI-generation detection applied to all submissions; EXIF GPS/timestamp consistency; C2PA cryptographic verification as high-confidence bonus where device-supported) | 40 pts |
| Geospatial Consistency (satellite damage probability cross-reference) | 30 pts |
| Cross-Report Validation (H3 spatial clustering, ~105m cells; neutral score during sparse early-reporting phase) | 20 pts |
| Submission Metadata (timestamp, GPS accuracy, channel weighting) | 10 pts |

Routing: ≥80 → map display (green) | 50–79 → flagged display (amber) | <50 → human review queue (red). The engine evaluates physical and geographical integrity only — not political speech or user identity. The scoring model is explicitly designed to function without C2PA, ensuring equal treatment of reports from low-end devices and WhatsApp submissions where metadata is stripped in transit.

**Layer 3 — Visualization & Decision Support**

The Re:Earth Visualizer dashboard displays trust-tier color-coded damage pins, building footprint overlays, priority area rankings, and satellite imagery. Data exports in GeoJSON, CSV, Shapefile, and REST API — compatible with HDX, OCHA IM Toolbox, KoboToolbox, and WFP systems.

**Engagement Without Gaming**

Participation incentives are non-monetary and anti-gaming by design: immediate map confirmation ("Your report is now live"), Trust Score feedback visible to the reporter, and Phase 0 community drill pre-registration that builds ownership before disaster strikes. Rapid repeat submissions, AI-generated images, and GPS spoofing are algorithmically penalized by the Trust Score engine.

All six UN official languages are supported: Arabic, Chinese, English, French, Russian, and Spanish.

**Building Footprint Integration**

The Re:Earth Visualizer incorporates building footprint overlays sourced from OpenStreetMap and government cadastral data where available. Reporters can tap a building outline on the map to auto-populate the location field — eliminating GPS ambiguity in dense urban environments and reducing misidentified infrastructure reports. Where footprint data is unavailable, textual landmark description (street name, nearby facility, distance reference) serves as the fallback for unambiguous location capture.

**Report Versioning**

Multiple damage reports for the same building are versioned in the database. The dashboard displays current status (most recent assessment) alongside the full historical record — enabling operators to track deterioration over time, confirm independent corroboration from multiple reporters, and flag conflicting assessments for targeted human review.

**Modular Appendix Questions**

Beyond core damage classification, the form supports optional modular fields for deeper situational awareness:

- **Electricity infrastructure:** Is power available at or near the reported site?
- **Health services:** Are medical facilities functioning in the surrounding area?
- **Community needs:** Most pressing requirements at the site (food, water, healthcare, shelter, livelihoods, WASH, infrastructure, protection, local authority support, other)

These fields are optional by default to minimize friction during rapid post-crisis reporting, but are configurable as required fields for specific deployment contexts or UNDP operational requirements.

**Dashboard Decision-Support Flow**

The Re:Earth Visualizer provides three operational views for government and UNDP operators:

1. **Real-time feed:** Incoming reports displayed as trust-tier color-coded pins (green/amber/red), updated as submissions arrive
2. **Priority zones:** H3 hexagonal clusters highlighting areas with high report density and high trust scores — guiding initial resource deployment decisions
3. **Export queue:** Operator-curated dataset selection for structured export in GeoJSON, CSV, Shapefile, and REST API formats, directly compatible with OCHA, WFP, HDX, and KoboToolbox workflows

---

## Field 3 — Solution Feasibility

**Built on Proven Infrastructure**

Verified Crisis Mapper is built on Re:Earth, Eukarya's open-source WebGIS platform currently powering Japan's national 3D city model initiative, Project PLATEAU (300 municipalities, ~30TB of geospatial data). The core visualization, mapping, CMS, and API infrastructure are production-proven. Challenge-specific development — crisis reporting form, Trust Score Engine, WhatsApp integration, and humanitarian dashboard — is scoped as an extension of this platform, not a rebuild.

The base platform is available at zero licensing cost under Apache-2.0. This significantly reduces cost, risk, and time-to-deployment.

**Use of the $50,000 Award**

The award will fund conversion of Verified Crisis Mapper into a reusable, distributable product:

- **Re:Earth plugin development:** Packaging the crisis reporting form, Trust Score Engine, and dashboard as a self-contained plugin deployable on any Re:Earth instance
- **Standalone service packaging:** Docker containerization enabling any government, NGO, or UNDP field team to self-host independently
- **WhatsApp Business API integration:** Bot development and multi-region testing
- **Multilingual UI completion:** Arabic, Chinese, French, Russian, Spanish
- **Phase 2 field testing coordination:** Pilot deployment in a UNDP target region

**Technology Readiness Level**

TRL **4–5** at submission (functional prototype with core components demonstrated using simulated data). Re:Earth base platform: TRL 9 (national-scale production). Full Trust Score Engine implementation (live C2PA and satellite API) is targeted for TRL 6 following shortlist selection in Phase 2.

**Scalability**

Architecture supports local events (50,000 uploads), regional crises (250,000), and national crises (500,000+). Multiple damage reports for the same building are versioned — the dashboard shows current status with full historical record.

**Deployment Speed**

Containerized infrastructure enables deployment within 48 hours of a declared crisis, requiring only a cloud environment and DNS configuration.

**Usability**

The reporting form is designed for one-hand smartphone operation with 3-tap core completion. It requires no account registration. WhatsApp Route C requires no installation — only a pre-distributed phone number.

---

## Field 4 — Experience & Expertise

**Re:Earth — Production-Proven at National Scale**

Eukarya is the creator and maintainer of Re:Earth, an open-source WebGIS platform published under the Apache-2.0 license. Re:Earth serves as the visualization and data management backbone for Japan's national 3D city model initiative, Project PLATEAU — a program of the Ministry of Land, Infrastructure, Transport and Tourism (MLIT) — covering 300 municipalities with approximately 30 terabytes of structured geospatial data. This demonstrates capability to handle national-scale data ingestion, real-time multi-stakeholder visualization, and high-availability infrastructure — the identical requirements as a national crisis reporting system.

**Humanitarian Data Ecosystem Compatibility**

Re:Earth's data export pipeline is directly compatible with UNDP and OCHA field tools: KoboToolbox (OCHA's standard field data collection platform), the Humanitarian Data Exchange (HDX), and the OCHA Information Management Toolbox. Data collected by Verified Crisis Mapper flows into existing UNDP/OCHA workflows without conversion.

**Active International Projects**

Eukarya is currently engaged in a geospatial infrastructure project with UNIDO (United Nations Industrial Development Organization) in Ukraine, demonstrating active experience in humanitarian and reconstruction contexts within the UN system. Eukarya is also in active discussions with UNDP and OCHA regarding geospatial platform needs for ongoing crisis operations — this challenge aligns directly with those strategic priorities.

**Global Open Source Geospatial Presence**

Eukarya is a regular presenter at FOSS4G (Free and Open Source Software for Geospatial), the annual flagship conference of the Open Source Geospatial Foundation (OSGeo). This positions Re:Earth within the international OSS GIS community that underpins OpenStreetMap, QGIS, and other humanitarian mapping infrastructure.

**Leadership**

CEO Kenya Tamura is a geographer by training, with expertise in spatial data infrastructure and public policy applications. Eukarya was founded from the University of Tokyo's Watanabe Laboratory.

**Open Source Commitment**

All challenge-specific extensions — crisis reporting form, Trust Score Engine, WhatsApp integration, dashboard — will be published under Apache-2.0, enabling any humanitarian organization or government to deploy at zero cost.

---

## Field 5 — Risk Analysis

**Risk 1: AI-Generated Disinformation and Social Media Misinformation (Primary Risk)**

Generative AI enables fabrication of plausible damage imagery at near-zero cost. Coordinated submission of fake reports can misdirect aid; recycled or AI-generated images spread via social media can overwhelm human review capacity before authentic reports are acted upon.

*Mitigation:* The Trust Score Engine is the primary defense. C2PA (Content Credentials) cryptographic metadata verification detects images lacking authentic device provenance. AI-generation fingerprint pattern matching flags synthetic content. H3 spatial clustering cross-validates each report against neighboring submissions — fabricated reports lacking geographic corroboration are automatically downgraded. Geospatial consistency checks cross-reference reported locations against satellite-derived damage probability maps. This layered, automated verification reduces the attack surface before human review is engaged.

**Risk 2: Internet Connectivity Disruption**

Partial or intermittent connectivity is endemic in disaster environments. Full internet shutdown is explicitly out of scope.

*Mitigation:* PWA Service Worker caches the reporting form on-device. Background Sync API queues submissions locally and transmits automatically when any connectivity returns — no user action required. WhatsApp queues natively in the app's offline state.

**Risk 3: C2PA-Non-Compliant Devices**

Hardware-level C2PA signing is not yet universal across all smartphone models.

*Mitigation:* C2PA contributes 40 of 100 Trust Score points. When unavailable, the remaining 60 points (satellite, H3, metadata) provide meaningful verification. Reduced confidence is transparently communicated via amber/red routing — the conservative outcome is correct behavior.

**Risk 4: Reporter Safety and Privacy**

In conflict-adjacent contexts, a reporter's identity or location may be sensitive.

*Mitigation:* Reporter contact information is entirely optional. No account creation is required. GPS data is encrypted at rest. Role-based access ensures reporters see only their own submission confirmation; aggregated data is visible only to verified operator accounts. Data retention policies are configurable per deployment.

**Risk 5: GPS Spoofing and Location Fraud**

Malicious actors may falsify coordinates to redirect resources.

*Mitigation:* Geospatial consistency scoring cross-references reported coordinates against satellite damage analysis. H3 outlier detection flags reports whose location is inconsistent with surrounding cluster patterns.

**Risk 6: Infrastructure Cost at Scale**

*Mitigation:* Cloud-agnostic Docker deployment avoids vendor lock-in. The $50,000 award covers Phase 1–2 development. Phase 3+ operational costs are addressed via UNDP partnership or government-hosted deployment.

---

## Field 6 — Online References

**Re:Earth Platform**
- Re:Earth GitHub (open-source, Apache-2.0): https://github.com/reearth
- Re:Earth official site: https://reearth.io

**Project PLATEAU (national deployment reference)**
- Ministry of Land, Infrastructure, Transport and Tourism (MLIT) Japan: https://www.mlit.go.jp/plateau/

**Technical Standards Referenced in Proposal**
- C2PA (Coalition for Content Provenance and Authenticity) Technical Specification v1.3: https://c2pa.org/specifications/  
  An industry standard (Adobe, Microsoft, BBC, Intel) for cryptographically signed media provenance metadata.
- Uber H3 Hexagonal Hierarchical Spatial Index: https://uber.github.io/h3/  
  Resolution 9 cells average 0.105 km² / 174m edge length — appropriate for building-level spatial clustering.

**Humanitarian Data Ecosystem**
- OCHA Humanitarian Data Exchange (HDX): https://data.humdata.org
- KoboToolbox (OCHA standard field data collection): https://www.kobotoolbox.org

**Open Source Geospatial Community**
- FOSS4G / Open Source Geospatial Foundation (OSGeo): https://www.osgeo.org/initiatives/foss4g/

**Key Academic References (full citations in attached proposal_en.md)**
- OCHA (2013). *Humanitarianism in the Network Age* — "critical 72-hour" framing
- Chesney & Citron (2019). "Deep Fakes: A Looming Challenge." *California Law Review* — AI disinformation risk
- Wardle & Derakhshan (2017). *Information Disorder.* Council of Europe — misinformation in crisis contexts
- Heinzelman & Waters (2010). *Crowdsourcing Crisis Information in Disaster-Affected Haiti.* USIP — Haiti SMS 4636 case
- Brodsky (2018). "H3: Uber's Hexagonal Hierarchical Spatial Index." — H3 technical reference

---

## How Did You Hear About This Challenge?

Eukarya Inc. is registered as a digital solutions provider on **UNDP Digital X** — UNDP's platform for identifying and scaling digital innovations for sustainable development. Through our active engagement on Digital X, we were directly recommended to apply to this challenge as a strong fit for Re:Earth's humanitarian geospatial capabilities. This challenge represents a natural extension of the partnership dialogue already underway between Eukarya and UNDP.

---

*Eukarya Inc. | info@eukarya.io | reearth.io | github.com/reearth*  
*Re:Earth — Apache-2.0 Open Source*
