# Dev Options

Open the panel with **Ctrl+Shift+D** or the existing three-dot button. Escape closes it. Settings persist on the current device. Individual rendering changes select **Custom**; selecting Low, Standard or High replaces the visual settings with that template. Standard preserves the preceding scene appearance. Low reduces rendering cost; High enables additional screen-space lighting/reflections.

| Control | Quality value |
| --- | --- |
| SSGI | 8–32 neighboring color/depth samples for a subtle screen-space indirect-light approximation |
| SSAO | 8–32 hemisphere depth samples; half-resolution, edge-filtered occlusion |
| SSR | 16–64 view-space ray-march steps over an 8-unit trace |
| Motion Blur | 3–15 depth-reprojected color samples during camera motion |

SSGI and SSR use visible color/depth only; they cannot recover hidden/offscreen surfaces. SSR is an additional effect independent of planar ground reflections. Motion blur respects reduced-motion preferences. Disabled effects skip their work. Render resolution changes the 3D target size without scaling interface text; maximum pixel ratio, planar reflection resolution, and shadow resolution provide additional cost controls.

Performance stats show render FPS, CPU submission time (not GPU execution time), draw calls, triangles, geometries and textures. The overlay updates independently of the demand-driven renderer, displays idle/inactive states, and does not force continuous 3D frames.

The update preference controls explicit startup checks. **Check for updates** works manually regardless of that preference. **Update now** checks and activates a waiting worker with a reload; it reports unavailable/offline/downloading/up-to-date states. Local development may not have an installed service worker. Existing config recovery remains internal; inactivity, module-disable, configuration-history, rollback and explanatory footer UI have been removed from this panel.

Validation: production build, 25 unit tests, and `node scripts/dev-options-e2e.mjs` pass. The browser check covers shortcuts, presets/Custom, persistence, update feedback, live GPU settings, disabled effects, stats, idle rendering, mobile bounds and shader errors using software WebGL. Physical target-device frame rates and a newly published live service-worker update were not measured in that check.
