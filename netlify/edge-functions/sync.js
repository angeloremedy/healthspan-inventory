// Simple proxy — forwards to the background function which does all the work
// This keeps the /api/sync endpoint the HTML already calls
export default async function handler(request, context) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Forward to the Netlify function (no timeout on background functions)
  const url = new URL('/.netlify/functions/refresh', request.url);
  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const body = await resp.text();
  return new Response(body, {
    status: resp.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export const config = { path: '/api/sync' };
