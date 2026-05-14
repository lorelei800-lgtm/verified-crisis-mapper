/**
 * ReliefWeb — UN OCHA's humanitarian situation-report clearinghouse.
 *
 * Endpoint: https://api.reliefweb.int/v1/reports
 * Docs:     https://apidoc.rwlabs.org
 *
 * ReliefWeb covers all hazards as "situation reports" rather than primary
 * alerts. We filter for reports with `disaster_type` set, `date.original`
 * within the last 30 days, and country fields populated. It's slower-moving
 * than GDACS but adds rich human-readable context that's useful for the
 * Lineage Card on the dashboard.
 *
 * Each hit includes:
 *   - id, url, title, body (HTML)
 *   - date.original, date.created
 *   - country[].name, country[].location.lat / .lon
 *   - disaster[].name, disaster[].type[].name (mapped to HazardType)
 *
 * TODO (WS-C.4): replace this stub with real fetch + parse.
 */

/**
 * @returns {Promise<import('../../../src/types/fusion').CrisisEvent[]>}
 */
export async function fetchReliefWeb () {
  console.log('[reliefweb] stub — implement in WS-C.4')
  return []
}
