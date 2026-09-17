// Retired 2026-09-17 (app-wide audit). Visits live in the Supabase `visits` table under
// RLS since the CRM brick moved off Blobs; this endpoint let any signed-in account read
// every specialist's notes and post as any specialist, and the browser no longer calls
// it (its two fallbacks were removed from js/02-views.js). Kept as a stub so an old
// cached client gets a clear answer instead of a 404 from the platform.
export const handler = async () => ({
  statusCode: 410,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify({ error: 'This endpoint was retired. Visits are read and written through the database (visits table).' })
});
