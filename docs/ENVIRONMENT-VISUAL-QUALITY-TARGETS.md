# NEXUS environment visual-quality targets

## Decision baseline

The current production JLTV renderer on `origin/main` is the minimum acceptable LAND quality. Environment exploration must preserve or improve its visual language rather than substitute simplified geometry.

Matched comparison conditions:

- Viewport: `1440×900`, DPR `1` browser / renderer cap `1.25`.
- Camera: `[7.1, 2.8, 9.2]`, target `[-0.6, 2.0, 0]`, FOV `38` for LAND.
- Vehicle: the same `jltv-runtime.glb`, no add-on, initial orbit.
- Evidence: full browser pixels after model, fonts, textures, and the scene-ready signal settle.

## LAND — production parity first

LAND is acceptable only when it retains all production cues:

- continuous shader-based sky, distant ridgelines, and low haze with no polygonal mountain props;
- repeated authored roughness and normal textures on the ground;
- planar reflection, contact shadow, and production-equivalent matte vehicle material treatment;
- production camera, target, model scale, and key/fill/rim/practical lighting;
- no continuous rendering once the static frame settles.

The matched LAND capture should be visually indistinguishable from the production environment apart from the review-harness UI.

## SEA — water must read optically as water

SEA must show, in one still frame:

- multi-directional, non-uniform wave forms rather than parallel corrugation;
- view-dependent Fresnel reflection, readable sky reflection, crest light, and a controlled sun/specular path;
- depth variation from deep navy through blue-violet shallows while remaining in NEXUS art direction;
- a vessel intersecting the waterline with broken, surface-conforming hull foam and a directional wake;
- buoyancy sampled from the same wave field at center, bow, stern, port, and starboard.

Motion evidence must separately demonstrate surface phase, sampled buoyancy, and contact foam. Reduced motion freezes all three.

## AIR — atmosphere before object

AIR must show:

- soft procedural cloud fields with irregular edges, internal density variation, and directional light response;
- at least two apparent depth bands with relative drift/parallax and atmospheric perspective;
- a horizon glow and sky gradient that frame the aircraft without flattening it;
- no visible primitive-sphere construction or repeated puff silhouettes;
- an explicitly labeled concept aircraft, lit consistently with the atmosphere.

## Performance-risk boundaries

- Preserve one WebGL context across environment switches.
- Cap renderer DPR at `1.25`.
- Keep LAND on demand rendering.
- Use bounded wave geometry and fixed shader loops; no fluid simulation or unbounded raymarch.
- Use procedural cloud cards/fields with a fixed layer count; no external runtime textures or services.
- Record renderer draw calls, triangles, programs, and textures in review telemetry. Software-browser timing is diagnostic only and is not a hardware FPS claim.

## Technique references

- Three.js official ocean shader example: <https://threejs.org/examples/webgl_shaders_ocean>
- Three.js official water examples index: <https://threejs.org/examples/?q=water>
- Three.js `WebGLRenderer` documentation, including renderer telemetry and performance guidance: <https://threejs.org/docs/pages/WebGLRenderer>

These references inform the optical and performance approach. The implementation remains local, deterministic, and free of externally loaded art assets.

## Candidate evidence

- LAND regression/baseline/candidate: `environment-exploration-evidence/land-regression-comparison.webp`
- SEA and AIR rejected/candidate comparison: `environment-exploration-evidence/sea-air-regression-comparison.webp`
- Full candidate captures: `candidate-land.webp`, `candidate-sea.webp`, `candidate-air.webp`
- SEA contact foam detail: `candidate-sea-contact-foam.webp`
- Responsive checks: `candidate-mobile-landscape-creator.webp`, `candidate-mobile-portrait-sea.webp`
- Pixel-based blocking QA and recorded renderer risk signals: `../design-qa.md`
