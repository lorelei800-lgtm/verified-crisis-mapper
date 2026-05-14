/**
 * Copernicus EMS — European Commission's Emergency Management Service.
 *
 * Rapid Mapping activations: https://emergency.copernicus.eu/mapping/list-of-activations-rapid
 * (JSON feed available at the same path with `.json` suffix on some mirrors;
 * fall back to scraping the HTML list if needed.)
 *
 * Each activation includes:
 *   - actId (e.g. "EMSR753")
 *   - title (e.g. "Flood in Thailand")
 *   - eventType (FL / EQ / WF / VO / OT)
 *   - country
 *   - activationDate (ISO 8601)
 *   - geometry (optional — bounding polygon)
 *
 * Copernicus activations are slower to trigger than GDACS (hours, not minutes)
 * but provide the most rigorous geospatial extent — they're the satellite
 * cross-reference that gives our citizen reports their best Trust Score boost.
 *
 * TODO (WS-C.3): replace this stub with real fetch + parse.
 */

/**
 * @returns {Promise<import('../../../src/types/fusion').CrisisEvent[]>}
 */
export async function fetchCopernicus () {
  console.log('[copernicus] stub — implement in WS-C.3')
  return []
}
