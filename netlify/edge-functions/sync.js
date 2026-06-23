export default async function handler(request, context) {
  // Only allow POST
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: { message: "ANTHROPIC_API_KEY not set in Netlify environment variables." } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Optional: restrict to your Netlify domain only
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = [
    Deno.env.get("SITE_URL") || "",
    "http://localhost:8888",
    "http://localhost:3000",
  ].filter(Boolean);
  const isAllowed = allowedOrigins.length === 0 || allowedOrigins.some(o => origin.startsWith(o));
  if (!isAllowed) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const body = await request.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "mcp-client-2025-04-04",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: "Proxy error: " + err.message } }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

export const config = {
  path: "/api/sync",
};
