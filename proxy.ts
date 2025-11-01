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
  string: ["port", "target", "cert", "key", "host-regex"],
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
      "      --host-regex <re>  Optional RegExp to match Host header (or $LOCAL_HTTPS_PROXY_HOST_REGEX)",
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

const hostRegexInput = resolveStringOption(
  args["host-regex"],
  "LOCAL_HTTPS_PROXY_HOST_REGEX",
);

let hostRegex: RegExp | undefined;
if (hostRegexInput) {
  try {
    hostRegex = new RegExp(hostRegexInput);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`--host-regex の正規表現が不正です: ${errorMessage}`);
    Deno.exit(1);
  }
}

const cert = resolveStringOption(args.cert, "LOCAL_HTTPS_PROXY_CERT_PATH");
if (!cert) {
  console.error(
    "TLS certificate file path is not specified. Please set --cert or LOCAL_HTTPS_PROXY_CERT_PATH.",
  );
  Deno.exit(1);
}

const key = resolveStringOption(args.key, "LOCAL_HTTPS_PROXY_KEY_PATH");
if (!key) {
  console.error(
    "TLS private key file path is not specified. Please set --key or LOCAL_HTTPS_PROXY_KEY_PATH.",
  );
  Deno.exit(1);
}

const formatTargetFromMatch = (
  format: string,
  match: RegExpMatchArray,
): string => {
  return format.replace(/\{([^{}]+)\}/g, (_substring, placeholder: string) => {
    if (match.groups && placeholder in match.groups) {
      const value = match.groups[placeholder];
      if (value !== undefined) {
        return value;
      }
    }
    const index = Number.parseInt(placeholder, 10);
    if (!Number.isNaN(index) && match[index] !== undefined) {
      return match[index];
    }
    throw new Error(
      `target 内のプレースホルダ {${placeholder}} に対応するキャプチャがありません。`,
    );
  });
};

const resolveTarget = (req: Request): {
  success: true;
  url: URL;
} | {
  success: false;
  message: string;
} => {
  const hasPlaceholder = /\{([^{}]+)\}/.test(targetUrl);
  if (!hasPlaceholder) {
    return {
      success: true,
      url: new URL(targetUrl),
    };
  } else {
    const hostname = new URL(req.url).hostname;
    const match = hostRegex ? hostname.match(hostRegex) : null;
    if (match) {
      try {
        const formatted = formatTargetFromMatch(targetUrl, match);
        return {
          success: true,
          url: new URL(formatted),
        };
      } catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : String(error);
        return {
          success: false,
          message: errorMessage,
        };
      }
    } else {
      return {
        success: false,
        message: "Host header did not match the provided regex.",
      };
    }
  }
};

Deno.serve(
  {
    port,
    cert: Deno.readTextFileSync(cert),
    key: Deno.readTextFileSync(key),
  },
  async (req) => {
    const url = new URL(req.url);
    const resolvedTarget = resolveTarget(req);

    if (!resolvedTarget.success) {
      const timestamp = new Date().toISOString();
      console.log(
        `[${timestamp}] ${req.method} ${url.pathname}${url.search} -> ERROR: ${resolvedTarget.message}`,
      );
      return new Response("Bad Request", { status: 400 });
    }

    const proxyUrl = new URL(
      url.pathname + url.search,
      resolvedTarget.url,
    );

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
