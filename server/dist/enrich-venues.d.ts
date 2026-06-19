/**
 * Batch venue enrichment:
 *   - MapTiler reverse geocoding → address fields (uses existing MAPTILER_KEY)
 *   - Foursquare Places API v3   → phone, website, hours (needs valid fsq3... key)
 *
 * Usage:
 *   npx ts-node enrich-venues.ts                  # addresses only
 *   npx ts-node enrich-venues.ts --full            # addresses + Foursquare
 *   npx ts-node enrich-venues.ts --limit 100       # cap at 100 venues
 *   npx ts-node enrich-venues.ts --dry-run         # preview, no writes
 *
 * Foursquare free key: https://developer.foursquare.com/ → create project → copy "API Key" (starts with fsq3)
 */
import 'dotenv/config';
//# sourceMappingURL=enrich-venues.d.ts.map