help:
    @echo "gen-certs cn=localhost   Generate self-signed TLS certificates for localhost"
    @echo "serve target='' port=''  Start the proxy server targeting the specified address and port"
    @echo "clean                    Remove generated certificate files"

gen-certs cn='localhost':
    #!/usr/bin/env bash
    set -euo pipefail

    # Server cert
    openssl genpkey -algorithm RSA -out server.key
    openssl req -new -key server.key -out server.csr \
      -subj "/CN={{ cn }}"

    # CA for signing server certs
    openssl genpkey -algorithm RSA -out localCA.key
    openssl req -x509 -new -nodes -key localCA.key -sha256 -days 1024 -out localCA.pem \
      -subj "/CN=My Local Test CA" \
      -addext "basicConstraints=critical,CA:TRUE" \
      -addext "keyUsage=critical,digitalSignature,cRLSign,keyCertSign"

    # Sign server cert with our CA
    openssl x509 -req -in server.csr -CA localCA.pem -CAkey localCA.key -CAcreateserial \
      -out server.crt -days 365 -sha256 \
      -extfile <(printf "basicConstraints=CA:FALSE\nsubjectAltName=DNS:{{ cn }},IP:127.0.0.1")

serve target='' port='':
    env TARGET={{ target }} PORT={{ port }} ./proxy.ts

clean:
    cat .gitignore | xargs -I {} rm -f {}
