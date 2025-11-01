#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
import { parseArgs } from "jsr:@std/cli/parse-args";

const args = parseArgs(Deno.args, {
  alias: {
    p: "port",
    t: "target",
    c: "cert",
    k: "key",
    h: "help",
  },
  string: ["port", "target", "cert", "key"],
  boolean: ["help"],
});

if (args.help) {
  console.log(
    [
      "Usage: deno run --allow-net --allow-env --allow-read proxy.ts [options]",
      "",
      "Options:",
      "  -p, --port <number>    Listens on this HTTPS port (default: 8443 or $LOCAL_HTTPS_PROXY_PORT)",
      "  -t, --target <url>     HTTP target to forward to (default: http://localhost:8080 or $LOCAL_HTTPS_PROXY_TARGET)",
      "  -c, --cert <path>      TLS certificate file path (required unless $LOCAL_HTTPS_PROXY_CERT_PATH is set)",
      "  -k, --key <path>       TLS private key file path (required unless $LOCAL_HTTPS_PROXY_KEY_PATH is set)",
      "  -h, --help             Show this help message",
    ].join("\n"),
  );
  Deno.exit(0);
}

const lastValue = <T>(value: T | T[] | undefined): T | undefined =>
  Array.isArray(value) ? value[value.length - 1] : value;

const resolveStringOption = (
  option: string | string[] | undefined,
  envVarName: string,
  fallback?: string,
): string | undefined => {
  const envValue = Deno.env.get(envVarName);
  return lastValue(option) ?? envValue ?? fallback;
};

const portInput = lastValue(args.port) ??
  Deno.env.get("LOCAL_HTTPS_PROXY_PORT") ?? "8443";
const port = Number.parseInt(String(portInput), 10);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(
    `Invalid port "${portInput}". Provide a positive integer between 1 and 65535.`,
  );
  Deno.exit(1);
}

const targetUrl = resolveStringOption(
  args.target,
  "LOCAL_HTTPS_PROXY_TARGET",
  "http://localhost:8080",
)!;

const cert = resolveStringOption(args.cert, "LOCAL_HTTPS_PROXY_CERT_PATH");
if (!cert) {
  console.error(
    "TLS証明書ファイルパスが指定されていません。--cert または LOCAL_HTTPS_PROXY_CERT_PATH を設定してください。",
  );
  Deno.exit(1);
}

const key = resolveStringOption(args.key, "LOCAL_HTTPS_PROXY_KEY_PATH");
if (!key) {
  console.error(
    "TLS秘密鍵ファイルパスが指定されていません。--key または LOCAL_HTTPS_PROXY_KEY_PATH を設定してください。",
  );
  Deno.exit(1);
}

Deno.serve(
  {
    port,
    cert: Deno.readTextFileSync(cert),
    key: Deno.readTextFileSync(key),
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
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.log(
        `[${timestamp}] ${req.method} ${url.pathname}${url.search} -> ${proxyUrl.toString()}: ERROR: ${errorMessage}`,
      );
      return new Response("Proxy Error", { status: 502 });
    }
  },
);
