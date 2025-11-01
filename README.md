# local-https-proxy

A tiny HTTPS-to-HTTP forward proxy for local development. It lets clients that insist on HTTPS (browsers, mobile SDKs, webhooks) talk to services that only expose HTTP on your machine. Traffic terminates TLS locally, then the proxy forwards the request to your chosen upstream target.

## Prerequisites
- [Deno](https://deno.com/) 1.45+ (used via the Shebang in `proxy.ts`)
- OpenSSL (for certificate generation) and a shell that can run the `just` recipes

## Quick Start
```bash
# 1. Generate certificates (defaults CN to localhost)
just gen-certs cn=localhost

# 2. Trust the generated CA (one-time per machine)

# 3. Run the proxy. TARGET defaults to http://localhost:8080, PORT defaults to 443
just serve target=http://localhost:3000 port=8443
```
Then point your HTTPS client to `https://localhost:8443` (or whichever port you chose).

## Manual Invocation (without just)
You can also run the proxy directly:
```bash
./proxy.ts --port 8443 --target http://localhost:3000 --cert server.crt --key server.key
```
The script reads `server.crt` / `server.key` from the repo root. Feel free to supply your own cert/key pair if you already have trusted credentials.

## Cleaning Up
Run `just clean` to delete generated certificates, or remove specific files manually. Remember to revoke the CA from your trust store if you no longer need it.

## Advanced Usage

* Dynamic Targeting by Hostname
  ```
  ./proxy.ts \
    --key  '/path/to/*.localhost.hogeyama.com.key' \
    --cert '/path/to/*.localhost.hogeyama.com.cer' \
    --port 8443 \
    --host-regex '(?<port>[0-9]{4})\.localhost\.hogeyama\.com' \
    --target 'http://localhost:{port}'
  ```
  * 3000.localhost.hogeyama.com:8443 → http://localhost:3000
  * 8080.localhost.hogeyama.com:8443 → http://localhost:8080
