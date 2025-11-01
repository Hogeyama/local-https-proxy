{
  description = "Local HTTPS terminator proxy packaged via Nix flakes";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forEachSystem = nixpkgs.lib.genAttrs systems;
    in
    {
      packages = forEachSystem
        (system:
          let
            pkgs = import nixpkgs { inherit system; };
          in
          rec {
            default = local-https-proxy;
            local-https-proxy =
              (pkgs.writeShellScriptBin "local-https-proxy"
                ''
                  exec ${pkgs.deno}/bin/deno run \
                    --allow-net \
                    --allow-env \
                    --allow-read \
                    ${./proxy.ts} "$@"
                '').overrideAttrs (_: {
                meta = with pkgs.lib; {
                  description = "Tiny HTTPS terminator that forwards to HTTP upstreams for local development";
                  homepage = "https://github.com/hogeyama/local-https-proxy";
                  license = licenses.mit;
                  platforms = platforms.linux ++ platforms.darwin;
                  mainProgram = "local-https-proxy";
                };
              });
          });

      devShells = forEachSystem
        (system:
          let
            pkgs = import nixpkgs { inherit system; };
          in
          {
            default = pkgs.mkShell {
              buildInputs = [ pkgs.deno ];
            };
          });
    };
}
