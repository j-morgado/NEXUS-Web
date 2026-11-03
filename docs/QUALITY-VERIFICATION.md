# First-version quality verification

## Automated and browser evidence

- TypeScript, ESLint, 14 Vitest tests, and the production build pass.
- `npm run test:e2e:quality` visits all 30 catalog products; checks media counts and image/video/PDF controls; exercises the touch keyboard and durable pending state; verifies bare/add-on and anchored-hotspot behavior; tests timeout reset from share, media, and configurator contexts; and audits key surfaces with axe-core.
- `npm run test:e2e:timeout-production` measures from a deliberate user input with `performance.now()`: the warning begins after the full 60-second idle interval at `:10`, and reset occurs after the separate ten-second countdown. Unit tests distinguish 50+10, 60 total, and the required 60+10 behavior, including tap-to-resume.
- The local six-second H.264 placeholder is a real muted looping video. Quality E2E waits through a complete decode/loop, then verifies that the same connected video element and playback position survive Attract → Hub while blur/dimming is applied. The clip is included in the service-worker precache.
- Keyboard verification covers first-focus skip navigation, visible focus styling, dialog focus placement, Escape dismissal, and global operator access above modal state.
- Reduced-motion browser emulation verifies hotspot camera movement completes without a continuing animated transition; CSS disables nonessential UI motion.
- Actual browser integration verifies local module-disable persistence across reload and active/previous configuration rollback through the operator UI.
- Synthetic IndexedDB quota exhaustion reports that storage is full and never displays a saved/sent claim.
- Simulated IndexedDB eviction restarts with an honest empty queue and `Sent: 0`.
- A blocked service-worker update leaves the existing worker controlling a usable configurator. This proves safe retention of the current provisioned build; it is not a complete enterprise publication system.
- With networking disabled after provisioning, a fresh route traversal reloads the app, authentic font, configurator bundle, and JLTV model far enough to project the model-anchored hotspot. This is stronger evidence than a screenshot of an already-running page.

## Bundle measurement

The current configurator route is approximately 994.90 KB minified / 274.33 KB gzip. A measured manual split of Three/R3F created an 8.63 KB route plus a 1,213.19 KB engine chunk, totaling about 345.27 KB gzip for entry—roughly 71 KB worse—so it was rejected and reverted. No model fidelity or offline reliability was traded for a cosmetic chunk-size reduction. Further engine reduction is optional measured engineering, not a first-version acceptance blocker.

## Evidence boundaries

- Browser storage can be evicted; the app recovers honestly but cannot guarantee request retention after eviction. Production delivery requires the deferred server outbox.
- The interrupted-update test verifies retention of the active service worker, not signed remote publication or device-fleet management.
- No completed NEXUS Unity experience exists, so Unity parity is not an acceptance criterion. `NEXUS-POC` is behavioral context only. Visual acceptance uses the supplied NEXUS styleframes and available wireframes, while the approved Leidos system governs colors, fonts, and components. Exact fidelity to inaccessible Figma frames is not claimed.
- Target integrated-GPU and 43-inch touch acceptance remains pending physical hardware.

## Timeout presentation

The warning is portaled to the document body and centered against the viewport, with the obsolete sideways transform removed. Its 350ms opacity entrance runs independently from a 1200ms background darkening and 12px backdrop blur. The dialog fits mobile widths and reduced-motion preferences suppress the animation. `node scripts/timeout-presentation-e2e.mjs` verifies centering at 1280×720, 960×640, and 390×844; intermediate/final animation styles; dismissal; reduced motion; and expiry back to attract. Existing idle/countdown timing remains unchanged.

## Bounded media viewer

Images and PDF placeholders zoom/pan within a clipped, scrollable viewport; controls occupy a separate row inside the same bordered frame. Image, video, and PDF toolbars share fullscreen enter/exit, with a viewport-filling fallback if native fullscreen is unavailable. Video controls drive the existing demo clip through HTML video playback, metadata duration, current time, and a seek slider. The global idle warning portals into the active fullscreen element so it remains visible. `npm run test:e2e:media` covers all three media types at desktop/mobile sizes, zoom containment, PDF page controls, actual seeking/play/pause, native fullscreen, fallback/Escape, close behavior, and the fullscreen timeout warning. Image/PDF content remains the existing catalog placeholders.

Shared module loading transitions now fade over the outgoing screen for 300ms before changing routes. “Loading” and a 3px square-cornered purple progress bar appear with a delayed fade. The destination remains inert until ready: Explorer/hub wait for fonts, images and two animation frames, and the experience reports its existing asset/GPU readiness and real progress. The overlay then fades out over 400ms after a brief completion hold. Cached navigation and returns to the hub use the same sequence. Reduced-motion removes the fades. Recovery UI can dismiss the gate after a module failure. `scripts/module-transitions-e2e.mjs` passes at 1280px and 390px for initial hub, repeated Explorer entry/return, inert gating, bar styling and reduced motion. The delayed-asset and warm-cache experience loading checks also pass, as do the build and 19 unit tests.

Attract-to-hub now bypasses the loading screen. The same video element continues playing while its blur/darkening transitions over 800ms. Only this entrance uses a rightward-origin card-strip slide, delayed text/arrow fades and a leftward-origin Explorer-button slide. Module entry and module-to-hub returns retain the shared loading gate. Reduced motion disables this choreography. The updated module-transition browser checks pass at 1280px and 390px, including direct initial hub entry, continuous video, animation assignments, repeat Explorer entry/return and reduced-motion navigation. Build passes.

Explorer share presentation fades the panel and the backdrop's darkening/12px blur together over 350ms. The X, Escape, header, and all empty space outside `.share-form`, `.touch-keyboard`, and the saved confirmation dismiss it with a 300ms reverse fade before unmounting. The closing form is inert and focus returns to Share. Reduced motion removes animations. `scripts/share-motion-e2e.mjs` checks interpolated panel/backdrop styles, input/keyboard interaction, X/header/outside/Escape dismissal, retained closing markup, and reduced motion; all pass, as does the production build.

Explorer market rows fade and rise with a 70ms stagger after the shared loading overlay finishes. The first market opens after the final row's 420ms entrance. Feature rows replay the same sequence for each product and then open the first feature; manually toggling either menu cancels its automatic opening. Hero eyebrow, title, designation, description and footer fade/rise in 90ms sequence steps on product change. Entrance animations pause beneath the loading overlay and are disabled with reduced motion (automatic opening is immediate). Features and media gallery have distinct product-specific keys. `scripts/explorer-entrance-e2e.mjs` verifies the market sequence, per-product feature/hero replay, stable markets on product changes and reduced motion; production build passes.
