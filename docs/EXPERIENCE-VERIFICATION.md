# Experience module update — 2026-11-02

The supplied purple studio reference informs the procedural sky gradient, horizon, lighting palette, soft reflections, and infinite ground. It is a visual reference, not a runtime asset.

## Behavior

- A single Return to hub action replaces the obsolete top navigation. Vehicle title and interaction instructions sit at the top left.
- Configuration has three mutually exclusive, toggle-off add-ons. The default is bare. Add-on 1 controls the actual attachment; Add-ons 2/3 are explicitly labeled placeholders and remove the real attachment when selected.
- Four projected markers expand in place into purple-header panels. Selection does not modify the camera or orbit target. Only one panel opens; outside pointer input, Escape, and occlusion close it. Occluded markers become inert immediately and fade visually over one second.
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
