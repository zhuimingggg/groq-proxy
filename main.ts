// Groq Reverse Proxy - follows redirects and rewrites HTML content URLs
// Usage:
//   /api/...     -> forwards to api.groq.com
//   Everything else -> forwards to console.groq.com (follows all redirects)

const API_HOST = "https://api.groq.com";
const CONSOLE_HOST = "https://console.groq.com";

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/health") {
    return new Response(JSON.stringify({ status: "ok", message: "Groq Proxy is running" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isApi = path.startsWith("/api");
  const targetHost = isApi ? API_HOST : CONSOLE_HOST;
  const targetPath = isApi ? path.replace(/^\/api/, "") || "/" : path;
  const targetUrl = `${targetHost}${targetPath}${url.search}`;

  const headers = new Headers();
  const allowedHeaders = ["accept", "content-type", "authorization", "cookie", "user-agent", "x-requested-with", "referer", "origin"];
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
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      let html = await response.text();
      html = html.replace(/https:\/\/(api\.groq\.com)/g, "/api");
      html = html.replace(/https:\/\/(console\.groq\.com)/g, "");
      html = html.replace(/https:\/\/(api\.stytchb2b\.groq\.com)/g, "/stytch");
      html = html.replace(/https:\/\/([a-zA-Z0-9-]+)\.groq\.com/g, "/$1");

      const respHeaders = new Headers();
      respHeaders.set("Content-Type", "text/html; charset=utf-8");
      respHeaders.set("Content-Length", new TextEncoder().encode(html).length.toString());
      respHeaders.set("Access-Control-Allow-Origin", "*");
      return new Response(html, { status: response.status, headers: respHeaders });
    }

    const respHeaders = new Headers(response.headers);
    respHeaders.set("Access-Control-Allow-Origin", "*");
    respHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    respHeaders.set("Access-Control-Allow-Headers", "*");
    respHeaders.set("Access-Control-Expose-Headers", "*");
    return new Response(response.body, { status: response.status, headers: respHeaders });
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
