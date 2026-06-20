// Multi-domain Groq proxy - supports api.groq.com and console.groq.com
// Usage:
//   /api/...     -> forwards to api.groq.com
//   /console/... -> forwards to console.groq.com

const GROQ_HOSTS: Record<string, string> = {
  api: "https://api.groq.com",
  console: "https://console.groq.com",
};

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Health check
  if (path === "/" || path === "/health") {
    return new Response(JSON.stringify({ status: "ok", message: "Groq Proxy is running", hosts: Object.keys(GROQ_HOSTS) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Match /:host/... pattern
  const match = path.match(/^\/(api|console)(\/.*)?$/);
  if (!match) {
    return new Response(JSON.stringify({ error: "Invalid path", usage: "Use /api/... or /console/..." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const host = match[1];
  const restPath = match[2] || "/";
  const targetUrl = `${GROQ_HOSTS[host]}${restPath}${url.search}`;

  // Forward headers
  const headers = new Headers();
  const allowedHeaders = ["accept", "content-type", "authorization", "cookie", "user-agent", "x-requested-with"];
  for (const [key, value] of request.headers.entries()) {
    if (allowedHeaders.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      redirect: "manual",
    });

    const responseHeaders = new Headers();

    // Copy response headers, rewriting Location for redirects
    for (const [key, value] of response.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "location") {
        // Rewrite redirect Location to go through our proxy
        let newLocation = value;
        if (value.startsWith("/")) {
          newLocation = `/${host}${value}`;
        } else {
          try {
            const locUrl = new URL(value);
            if (locUrl.hostname.includes("groq.com")) {
              newLocation = `/${host}${locUrl.pathname}${locUrl.search}${locUrl.hash}`;
            }
          } catch {
            // Keep original
          }
        }
        responseHeaders.set(key, newLocation);
      } else if (lowerKey === "set-cookie") {
        responseHeaders.set(key, value);
      } else if (lowerKey !== "content-encoding" && lowerKey !== "transfer-encoding") {
        responseHeaders.set(key, value);
      }
    }

    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    responseHeaders.set("Access-Control-Expose-Headers", "*");

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Proxy Error", message: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }
  return await handleRequest(request);
});
