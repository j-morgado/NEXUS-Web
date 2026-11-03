# Experience module update — 2026-11-02

The supplied purple studio reference informs the procedural sky gradient, horizon, lighting palette, soft reflections, and infinite ground. It is a visual reference, not a runtime asset.

## Behavior

- A single Return to Hub button at the bottom left replaces the obsolete top navigation. The vehicle title sits at the top left; the rotation/zoom instruction line is removed.
- Configuration has three mutually exclusive, toggle-off add-ons. The default is bare. Add-on 1 controls the actual attachment; Add-ons 2/3 are explicitly labeled placeholders and remove the real attachment when selected.
- Four projected markers support In place (default), Zoom in place, and Zoom side bar modes. In place preserves the camera. Zoom modes use a bounded close-up and restore the prior view on dismissal; canvas drags are distinguished from outside clicks. Only one panel opens; outside clicks, Escape, the minus button, and occlusion close it. Occluded markers become inert immediately and fade visually over half a second.
- Camera motion blur uses five depth-reprojected samples capped at two physical pixels. It runs only during camera movement and is disabled for reduced motion. When stationary the same output pass uses a single unblurred sample, keeping fog and sky color processing consistent.

## Asset inspection and corrections

The runtime GLB has two named objects and two material assignments. Its detail material used `alphaMode: BLEND` and double-sided rendering even though most of its alpha atlas is opaque (mean alpha approximately 247/255). That sorted tires and body details as one transparent mesh. Runtime detail materials now use depth-writing alpha-tested cutouts with alpha-to-coverage; body surfaces use front-face rendering. Thin detail cards remain double-sided.

The authored normal vectors agree with triangle winding on all 19,736 body triangles and 71,551 of 71,583 detail triangles. The few differing detail triangles do not establish globally inverted normals; blanket normal recomputation or face reversal would discard authored smoothing. No such global operation is applied.

The maps named Glossiness are bound to glTF metallic/roughness textures. Their green-channel means are approximately 104/255 (body) and 124/255 (detail). A legacy filename alone does not prove inverted data. The implementation preserves glTF's green-channel roughness convention and remaps it into matte ranges: body [0.65, 1], detail [0.78, 1]. Clearcoat is disabled, specular intensity reduced, and nonmetallic materials retained.

The loader sanitizes `Addon 1` to `Addon_1`; both names are handled. The actual object's visibility is included in browser verification, rather than relying solely on button state.

## Verification and performance boundaries

`npm run build`, `npm test`, and `npm run test:e2e:experience` cover the updated module. The browser test uses the actual WebGL model and checks initial bare state, all add-on transitions, zoom preservation, in-place expansion, one-open behavior, outside/Escape dismissal, all four markers becoming reachable, occlusion dismissal, intermediate fade opacity, camera-motion blur, reduced motion, idle rendering, and return navigation. It also captures front/hotspot and opposite-side screenshots and fails on browser/shader errors.

Rendering uses demand-driven frames, cached contact shadows, bounded pixel ratio and reflector resolution, and BVH-accelerated occlusion queries at up to 20 Hz. Additional blur sampling is skipped when still; the consistent color-output pass remains. Resource allocations and event listeners have explicit cleanup. The cloud browser uses SwiftShader software rendering: these checks establish functionality, not target kiosk GPU frame rate. The original nine 2048px maps remain a substantial texture allocation; integrated-GPU frame time and memory need measurement on the target display/device.

The horizon correction uses the same output pipeline during movement and rest, with a non-tone-mapped sky source and shared horizon/fog color. Distance haze (18–90 model units) remains active when stationary; it does not depend on camera-motion blur.

The darker studio revision uses shared `#9254b1` horizon/fog and `#401d73` zenith colors, with a `#3a234d` ground base. A deterministic seamless 1024px multi-scale roughness data texture varies the reflection blur over 6.25-unit surface tiles. The reflector blend samples transformed roughness UVs, matching the physical material; mipmaps suppress distant texture aliasing. Texture generation is memoized and the texture is disposed on exit.

The detailed-surface revision shifts noise energy into 128/256/512-cell grain layers, increases local roughness contrast, and uses a very small 0.0008-unit bump for fine surface light response. Cached periodic lattices avoid per-pixel trigonometric work. Reflection blur is reduced to preserve texture clarity.

Scene loading uses the same minimal Loading/purple-progress surface during lazy code loading and asset loading. The complete experience remains hidden and inert until the asset Suspense boundary resolves, three renderer frames complete, a one-time GPU synchronization finishes, and document fonts are ready. A throttled-download browser check (`node scripts/scene-loading-e2e.mjs`) verifies no partial scene is exposed, then checks completed-frame reveal and warm-cache reentry. WebGL recovery restarts the readiness gate.

Add-on 1 now uses a reversible world-space 65mm voxel dissolve with a luminous purple edge. The same mask drives the attachment and its directional shadow. A 112-point surface-sampled particle burst rises and fades over approximately two seconds; a short, bounded bloom pass softens its emission. Effects run only during the transition/tail, then demand rendering returns to idle. Reduced motion applies the final attachment state immediately and suppresses particles/glow. `npm run test:e2e:addons` covers appearance, disappearance, mid-transition reversal, placeholder selection, particle cleanup, reduced motion, and browser/shader errors. Add-ons 2/3 remain placeholders.

The horizon now contains three procedural mountain-ridge layers in the studio palette. Integer angular frequencies keep the profiles seamless through a full 360-degree orbit; depth layering and base haze integrate the silhouettes with the existing fog and ground. The mountains use the existing sky shader and add no external asset downloads or additional scene draw calls.

Mountain haze now uses the same horizon color and 18–90-unit distance-fog curve as the ground, with separate virtual distances for each ridge layer. A continuous low-altitude fog field is applied after compositing sky and mountains, so lower slopes converge to the ground fog color instead of fading into a differently colored sky strip. Distant ridgelines receive softer edges and stronger atmospheric attenuation.

## Supplied ground maps

The user-supplied 1024×1024 JPEG roughness and normal maps now replace the generated surface texture and bump approximation. Both are sampled as non-color data with matching 160× repeat (12.5-unit surface tiles), mipmapping, and anisotropic filtering. The normal scale is 0.5 on each tangent axis. A 0.5 roughness multiplier caps the mapped surface roughness at 0.5 while retaining its variation in both lighting and reflections. The reflector shader uses transformed UVs for both maps and applies normal scale as amplitude, keeping the reflected texture aligned with the physical material. Both assets preload alongside the vehicle and remain inside the scene readiness gate. The original downloaded bytes are retained in `public/assets/ground/roughness.jpg` and `normal.jpg`.

The HUB action shares the hub-page Explorer button geometry: 186×50px pill, 24px left/20px bottom placement, 16px typography, and arrow spacing. HUB uses a leading left-pointing arrow before its label. Its dark variant uses a purple fill with white text/border and the existing dark hover palette. Narrow-screen configuration controls sit above the navigation row to prevent overlap.

Ambient occlusion uses a 16-sample depth-reconstructed hemisphere (0.38-unit radius, 0.018 bias) at half render resolution, with edge-aware filtering and a subtle 45% blend before output tone mapping. It reuses the existing scene depth so alpha cutouts and add-on dissolve visibility remain consistent. The effect fades with distance before the fog horizon and stays active with reduced motion. It adds no geometry pass or idle animation loop; its render target and shader are disposed with the output pipeline. Build and 19 unit tests pass; software WebGL front/rear captures show no shader or browser errors. Target-device frame rates remain unmeasured.


## Hotspot modes

Use **Dev Options → Hotspots → Preview mode** to try all three modes on the existing JLTV markers. This device preference is the fallback; content can specify a per-hotspot `mode` of `in-place`, `zoom-in-place`, or `zoom-sidebar`. Existing content without a mode continues to use In place by default. Optional `details: [{ heading, text }]` sections appear in the sidebar and can scroll.

Zoom modes approach the selected model-space anchor from the currently visible side at a nominal 2.8-unit distance. Once the camera arrives, orbit is limited to ±0.22 radians horizontally and ±0.16 vertically, and zoom to 2.35–3.25 units. Pan remains disabled. Closing restores the original position, target, unrestricted orbit bounds, and projection; interrupted transitions retain the original return view. Reduced motion jumps directly to the destination.

Zoom side bar first settles the close-up, then morphs the same marker element into a purple-header right panel, hides the other markers and the vehicle heading, and shifts camera framing left to keep the selected area clear of the panel. Camera and morph advance with demand-rendered frames, with nominal 650ms durations each. Text retains its final layout and is clipped/revealed, never scaled. A narrower phone sidebar keeps a visible camera area and stays above navigation/configuration controls. Raycast dismissal is suspended only during camera transitions.

Build and 29 unit tests pass. `scripts/hotspot-modes-e2e.mjs` passes on the actual software-WebGL scene: unchanged In place camera, bounded close-up movement, drag retention, Escape/outside dismissal, original-view restoration, intermediate morph widths, same-marker identity, purple header, hidden other markers, desktop/phone bounds and no shader/browser errors. Physical target-device performance remains unmeasured.
