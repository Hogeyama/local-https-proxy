#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
const port = parseInt(Deno.env.get("PORT") || "443");
const targetUrl = Deno.env.get("TARGET") || "http://localhost:8080";

Deno.serve(
  {
    port,
    cert: Deno.readTextFileSync("./server.crt"),
    key: Deno.readTextFileSync("./server.key"),
  },
  async (req) => {
    const url = new URL(req.url);
    const proxyUrl = new URL(url.pathname + url.search, targetUrl);

    const timestamp = new Date().toISOString();

    const proxyReq = new Request(proxyUrl.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });

    try {
      const response = await fetch(proxyReq);

      console.log(
        `[${timestamp}] ${req.method} ${url.pathname}${url.search} -> ${proxyUrl.toString()}: ${response.status} ${response.statusText}`,
      );

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(
        `[${timestamp}] ${req.method} ${url.pathname}${url.search} -> ${proxyUrl.toString()}: ERROR: ${errorMessage}`,
      );
      return new Response("Proxy Error", { status: 502 });
    }
  },
);
