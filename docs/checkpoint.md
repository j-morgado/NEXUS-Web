# 2026-11-02 bounded implementation checkpoint

## Verification

All commands passed in the saved cloud environment:

- `npm run typecheck`
- `npm run lint`
- `npm test` — 5 files, 6 tests
- `npm run build` — PWA precache generated with six entries (~4.34 MB)

Chromium functional smoke at 1920×1080 covered attract, selector, JLTV entry, attachment/bare toggles, hotspot/close, Explorer, email preview, validation, local submission, reload persistence, and three repeated module exit/re-entry cycles. No console or page errors remained. The local request count survived reload and sent remained zero.

Production service-worker verification provisioned online, then set the browser context offline and reloaded from scratch. Attract and the JLTV module loaded from the controlled service worker in 4.55 seconds in the cloud Chromium/SwiftShader environment with no page errors. This proves browser cold reload after provisioning, not physical device reboot or storage retention under eviction pressure.

## Measured evidence

- Initial development-shell load to network idle: about 0.9–1.1 seconds locally.
- Cached model resource timing observed around 20–40 ms locally.
- Runtime GLB: 3,088,360 bytes, down from 179,612,840 bytes.
- Production JavaScript is route-split: shell 326.82 KB / 99.98 KB gzip, Explorer 8.60 KB / 3.48 KB gzip, and deferred Configurator/Three.js 994.15 KB / 274.10 KB gzip. Further vendor chunking remains possible, but the 3D engine no longer blocks initial shell/Explorer parsing.
- Headless GPU is SwiftShader and is not evidence of the proposed 30 FPS target on a midrange integrated-GPU laptop.

## Implementation matrix

| Area | State | Evidence / boundary |
| --- | --- | --- |
| Shell and navigation | Implemented + smoke-tested | Attract, selector, secondary Explorer, JLTV return |
| JLTV rendering | Implemented + visually reviewed in cloud | Real optimized geometry, bounded camera, lighting |
| Addon toggle | Implemented + smoke-tested | Supplied `Addon 1`, never labeled MXR |
| Hotspot | Implemented + browser-tested | Model-space projection, raycast far-side occlusion, drag-safe activation, smooth close-up and prior-camera restoration |
| Inactivity reset | Implemented + unit-tested | Five-second warning and shortened-timeout reset |
| Explorer/email preview | Implemented + smoke-tested | Filler label, escaped HTML/text template |
| Durable local queue | Implemented + unit/smoke-tested | IndexedDB, duplicate suppression, reload persistence, honest pending state |
| Offline shell/model | Implemented + browser-tested | Cold offline reload after provisioning; reboot/eviction test deferred |
| Module failure recovery | Implemented + browser-tested | Corrupt-model recovery and injected WebGL-context interruption both captured; retry succeeds |
| CMS/roles/publication | Contract only | Full secure server-side implementation deferred |
| Real email transport | Interface boundary only | No provider, network send, sent status, or real recipient |
| Three-vehicle release | Deferred | Other two vehicles not selected/supplied |

## Known gaps / next bounded increment

1. Measure FPS, frame-time percentiles, GPU memory and repeated load/unload on a representative integrated-GPU laptop; adjust texture resolution/format from evidence.
2. Expand model-anchored hotspots beyond the single demonstration zone and validate authorable anchor metadata.
3. Reconcile approved package components and licensed font assets when authorized access becomes available.
4. Validate the 2048px texture tier on the target display; retain selective 4K textures for close-up regions if necessary.

## Independent review outcome

An independent native reviewer inspected the actual runtime pixels and interaction evidence, rejected the first pass for recovery/composition/readability/lighting defects, and re-reviewed after correction. The bounded checkpoint is now accepted internally. The reviewer specifically confirmed branded recovery surfaces, exact camera restoration, opacity-zero far-side marker occlusion, improved selector/smaller layout, route splitting, and readable front/rear lighting. No completed NEXUS Unity experience exists. Behavior is accepted against the agreed requirements, with `NEXUS-POC` contextual only; visual review uses the supplied NEXUS styleframes/available wireframes and the approved Leidos system. Exact inaccessible-Figma fidelity is not claimed.
