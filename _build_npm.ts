#!/usr/bin/env -S deno run --allow-all

import { build, emptyDir } from "https://deno.land/x/dnt@0.38.1/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: ["./src/lib/index.ts"],
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  package: {
    // package.json properties
    name: "@discere-os/flac.wasm",
    version: "1.5.0",
    description: "WebAssembly port of FLAC - Free Lossless Audio Codec with SIMD optimization",
    keywords: [
      "flac",
      "audio",
      "codec",
      "compression",
      "webassembly",
      "wasm",
      "simd",
      "lossless",
      "encoding",
      "decoding"
    ],
    author: {
      name: "Isaac Johnston",
      email: "isaac@discere.school",
      url: "https://github.com/superstructor"
    },
    homepage: "https://github.com/discere-os/discere-nucleus/tree/main/client/emscripten/flac.wasm",
    repository: {
      type: "git",
      url: "git+https://github.com/discere-os/discere-nucleus.git",
      directory: "client/emscripten/flac.wasm"
    },
    bugs: {
      url: "https://github.com/discere-os/discere-nucleus/issues"
    },
    license: "BSD-3-Clause",
    files: [
      "esm/",
      "script/",
      "types/",
      "dist/",
      "README.md",
      "LICENSE"
    ],
    engines: {
      node: ">=18.0.0"
    },
    main: "./script/lib/index.js",
    module: "./esm/lib/index.js",
    types: "./types/lib/index.d.ts",
    exports: {
      ".": {
        import: "./esm/lib/index.js",
        require: "./script/lib/index.js",
        types: "./types/lib/index.d.ts"
      },
      "./types": {
        import: "./esm/lib/types.js",
        require: "./script/lib/types.js",
        types: "./types/lib/types.d.ts"
      }
    },
    sideEffects: false,
    funding: {
      type: "github",
      url: "https://github.com/sponsors/superstructor"
    }
  },
  postBuild() {
    // Copy additional files
    Deno.copyFileSync("README.md", "npm/README.md");
    Deno.copyFileSync("COPYING.Xiph", "npm/LICENSE");

    // Create dist directory and copy WASM files if they exist
    try {
      Deno.mkdirSync("npm/dist", { recursive: true });

      // Copy MAIN_MODULE files for NPM distribution
      try {
        Deno.copyFileSync("install/wasm/flac-main.js", "npm/dist/flac-main.js");
        Deno.copyFileSync("install/wasm/flac-main.wasm", "npm/dist/flac-main.wasm");
        console.log("✅ Copied WASM files to npm/dist/");
      } catch {
        console.log("⚠️  WASM files not found - run 'deno task build:wasm' first");
      }
    } catch (error) {
      console.log("Warning: Could not copy additional files:", error.message);
    }
  },
});

console.log("✅ NPM package built successfully in ./npm/");
console.log("📦 To publish: cd npm && npm publish");