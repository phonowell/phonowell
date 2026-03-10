import { build } from "esbuild";

await build({
  entryPoints: ["webui/app.js"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outfile: "webui/app.bundle.js",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": "\"production\"",
  },
  logLevel: "info",
});
