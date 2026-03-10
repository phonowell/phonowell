import { build } from "esbuild";

await build({
  entryPoints: ["webui/app.js"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outfile: "webui/app.bundle.js",
  sourcemap: false,
  logLevel: "info",
});
