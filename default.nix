{ pkgs ? import <nixpkgs> { } }:

pkgs.stdenv.mkDerivation rec {
  pname = "local-https-proxy";
  version = "0.1.0";

  src = ./.;

  nativeBuildInputs = [ pkgs.deno ];

  buildPhase = ''
    export DENO_DIR="$TMPDIR/deno"
    mkdir -p "$DENO_DIR"
    deno compile \
      --unstable \
      --allow-net \
      --allow-env \
      --allow-read \
      --output local-https-proxy \
      proxy.ts
  '';

  installPhase = ''
    install -Dm755 local-https-proxy $out/bin/local-https-proxy
  '';

  meta = with pkgs.lib; {
    description = "Tiny HTTPS terminator that forwards to HTTP upstreams for local development";
    homepage = "https://github.com/hogeyama/local-https-proxy";
    license = licenses.mit;
    platforms = platforms.linux ++ platforms.darwin;
    mainProgram = "local-https-proxy";
  };
}
