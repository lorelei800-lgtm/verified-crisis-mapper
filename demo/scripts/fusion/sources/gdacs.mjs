/**
 * GDACS — Global Disaster Alert and Coordination System.
 *
 * Endpoint: https://www.gdacs.org/xml/rss.xml
 * Covers:   earthquakes, tsunamis, tropical cyclones, floods, volcanoes,
 *           droughts, wildfires. UN-affiliated (UN OCHA + EU JRC).
 *
 * The RSS feed is multi-hazard so we parse `gdacs:eventtype` and translate to
 * our HazardType enum. Each <item> includes:
 *   - <title>            human-readable summary
 *   - <description>      paragraph-form summary
 *   - <pubDate>          when GDACS published this snapshot
 *   - <gdacs:fromdate>   when the underlying event started
 *   - <gdacs:eventtype>  EQ | TC | FL | VO | DR | WF (event code)
 *   - <gdacs:eventid>    stable id (e.g. 1462184)
 *   - <gdacs:alertlevel> Red | Orange | Green
 *   - <geo:Point> or lat/lng inside <description>
 *
 * TODO (WS-C.2): replace this stub with real fetch + parse. Keeping the
 * signature stable so run.mjs already wires through.
 */

/**
 * @returns {Promise<import('../../../src/types/fusion').CrisisEvent[]>}
 */
export async function fetchGdacs () {
  console.log('[gdacs] stub — implement in WS-C.2')
  return []
}
