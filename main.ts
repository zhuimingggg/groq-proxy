const GROQ_API_BASE = "https://api.groq.com";

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // Health check
  if (url.pathname === "/" || url.pathname === "/health") {
    return new Response(JSON.stringify({ status: "ok", message: "Groq Proxy is running" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build target URL
  const targetUrl = `${GROQ_API_BASE}${url.pathname}${url.search}`;

  // Forward request to Groq API
  const headers = new Headers();
  const allowedHeaders = ["accept", "content-type", "authorization"];
  for (const [key, value] of request.headers.entries()) {
    if (allowedHeaders.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Proxy Error", message: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Handle CORS preflight
function handleOptions(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return handleOptions(request);
  }
  return await handleRequest(request);
});
