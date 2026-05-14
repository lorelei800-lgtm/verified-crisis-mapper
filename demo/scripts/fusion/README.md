# Fusion Pipeline — Webhook-driven Multi-Source Crisis Data Ingestion

> Multi-hazard public-data ingestion layer for Verified Crisis Mapper.
> Citizen reports remain the heart of the system; this pipeline adds three
> public sources so the dashboard is useful in the 0–2 hour window after a
> disaster, before citizens can physically file reports.

## Sources (all multi-hazard, all open)

| Source | Endpoint | Hazards covered | Method |
|---|---|---|---|
| **GDACS Alerts** | `https://www.gdacs.org/xml/rss.xml` | Earthquake, tsunami, cyclone, flood, volcano, drought | RSS poll, 5min |
| **Copernicus EMS Rapid Mapping** | `https://emergency.copernicus.eu/mapping/list-of-activations-rapid.json` | All hazards (satellite extent maps) | REST poll, 10min |
| **ReliefWeb (UN OCHA)** | `https://api.reliefweb.int/v1/reports` | All hazards (situation reports) | REST poll, 15min |

GDACS = Global Disaster Alert and Coordination System (UN-affiliated).
Copernicus EMS = European Commission's emergency mapping service.
ReliefWeb = the OCHA-run humanitarian information clearinghouse.

## How it fits

```
[Source Layer]                    [Fusion Pipeline]                [CMS]              [Dashboard]
GDACS RSS         ─┐
Copernicus REST   ─┼──→ normalize → H3 cluster → trust-score-v2 ──→ verified-events ──→ React PWA
ReliefWeb REST    ─┤    (CrisisEvent)  (FusedEvent)                                       (existing
[Citizen PWA]     ─┘                                                                      Dashboard +
                                                                                          Source Filter
                                                                                          + Lineage Card)
```

Citizen reports continue to flow through `damage-reports` (unchanged).
Webhook sources land in a new `verified-events` CMS model. The Dashboard
queries both and shows them on one map with a source filter.

## Directory

```
fusion/
├── README.md              ← this file
├── run.mjs                ← entry point: fetch all sources → dedupe → score → POST
├── post-to-cms.mjs        ← POST verified-events to Re:Earth CMS
├── normalizer.mjs         ← source-specific data → CrisisEvent
├── deduper.mjs            ← H3 res 8 + ±30min clustering → FusedEvent
├── trustScoreV2.mjs       ← multi-source 4-factor scoring (40/30/20/10)
├── sources/
│   ├── gdacs.mjs
│   ├── copernicus.mjs
│   └── reliefweb.mjs
└── sample-data/
    └── ...                ← static JSON for offline / demo replay
```

The types these scripts produce live in `demo/src/types/fusion.ts` so the
React app can consume them with full TypeScript safety.

## Running locally

```bash
cd demo
# Live fetch + post to CMS (requires VITE_CMS_TOKEN):
npm run fusion

# Dry run — fetch + normalize + dedupe + score, but don't POST:
npm run fusion -- --dry-run

# Use a single source (faster, useful for debugging):
npm run fusion -- --source=gdacs
```

## Scheduling

`.github/workflows/fusion-cron.yml` runs `npm run fusion` every hour on the
main branch. Public APIs we hit are unauthenticated and rate-friendly at this
frequency.

## Trust Score v2

Same 4-factor weighting as citizen reports (40 / 30 / 20 / 10); applied across
all sources:

| Factor | Citizen interpretation | Webhook interpretation |
|---|---|---|
| Source / Content Integrity (0–40) | C2PA + EXIF + AI fingerprint | HTTPS signature + known publisher prior |
| Geospatial Consistency (0–30) | GPS accuracy band + area containment | Polygon coverage / coordinate plausibility |
| Cross-Source Validation (0–20) | H3 neighbours agree | Same H3 cell ±30min from another source |
| Source Reliability × Metadata (0–10) | Channel prior + landmark completeness | GDACS=10, Copernicus=10, ReliefWeb=9, Citizen prior |

Routing thresholds (≥80 green, ≥50 amber, else red) are unchanged.
