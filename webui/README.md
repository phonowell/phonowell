# WebUI

`webui` now contains a runnable React 19 canvas-first V1 interface.

## Implemented UX

- top bar with stage status + Generate button
- goal-origin drafting and confirmation panel
- asset drop form (`note/doc/url/image/generated`)
- relation connect form (`from -> to`)
- canvas nodes + relation lines visualization
- summary edit in the asset detail panel
- dry-run, generate, and verify buttons
- latest automation applied/deferred decisions in the asset detail panel
- latest verify route, priority audit, and acceptance coverage details in the asset detail panel
- runtime packet panel for explicit execution evidence
- project create/switch/delete controls
- asset layer filter and layer badges on graph nodes
- glanceable observability stats for schema/assets/relations/packets

## Notes

- built as minimal static React 19 client (`index.html + app.js + styles.css`)
- talks to `/api/*` endpoints served by `src/server.ts`
