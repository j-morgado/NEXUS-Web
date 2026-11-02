# Internal review checkpoint

## Implemented in this increment

- Attract → platform selector → JLTV → same selector
- Explorer as a secondary entry
- Real JLTV model and supplied Addon 1 toggle
- Bounded orbit/zoom, front-three-quarter start, one model-anchored raycast-occluded hotspot, smooth close-up, interruption-safe orbit control, and close restoration to the prior camera.
- Global inactivity warning/reset and local operator shortcut
- Fresh Explorer entry, filler catalog structure, generated email preview, validation, IndexedDB request queue, duplicate suppression, honest pending status, sent count zero
- Versioned content/config/bridge contracts and service-worker foundation

## Evidence collected

- Typecheck, lint, six automated tests and production build pass.
- Chromium smoke at 1920×1080 and 820×1180 covers the requested functional path.
- Screenshots cover selector, JLTV with/without attachment, model-anchored hotspot, Explorer, preview, pending state, corrupt-model recovery, WebGL recovery, and opacity-zero far-side occlusion.
- A 2.9-second frame-derived interaction recording captures hotspot focus and camera restoration.
- Offline cold reload after provisioning passed with the service worker controlling the page and route-split JLTV module.
- Repeated module enter/exit, corrupt-model recovery, WebGL recovery/retry and queue persistence passed.
- Asset sizes/hashes/load timing and source-versus-optimized SSIM/RMSE comparison are recorded.

## Evidence still required for release claims

- Representative integrated-GPU laptop and 43-inch touchscreen performance, visual scale, input latency and texture-fidelity validation.
- Physical reboot/eviction-pressure durability, operating-day soak and production packaging validation.
- Compare behavior against the agreed NEXUS requirements, using `NEXUS-POC` only as proof-of-concept context. Compare design against the supplied NEXUS Figma/styleframes where visible; use the approved Leidos system for colors, fonts, and components. Do not treat POC migration styling as authority or claim exact unseen-Figma fidelity.

## Deferred

Full CMS/editor/roles; secure publication and activation; server outbox/provider; real sending; real visitor policy; two additional vehicles; final catalog/media; representative 43-inch touchscreen validation; full-day soak; independent module publication; production hosting and deployment.
