# WebUI

`webui` now contains a runnable React 19 canvas-first V1 interface.

## Implemented UX

- default surface is being compressed toward one working screen:
- add material
- confirm or revise goal
- continue the assistant loop or review the requested checkpoint
- inspect the current artifact/result and accept direction when ready
- explicit acceptance is now recorded separately from "ready for judgment"
- diagnostics retain manual controls for relation correction, summary edits, and explicit stage execution
- canvas, audit details, and raw runtime evidence remain available behind progressive disclosure

## Notes

- built as minimal static React 19 client (`index.html + app.js + styles.css`)
- talks to `/api/*` endpoints served by `src/server.ts`
