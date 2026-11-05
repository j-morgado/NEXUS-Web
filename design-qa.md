# Environment exploration design QA

## Scope and matched references

This QA covers the isolated `?environmentLab=1` review harness only. It does not approve a merge or deployment.

- Rejected checkpoint: `docs/environment-exploration-evidence/{land,sea,air}.webp`
- Minimum LAND baseline: `docs/environment-exploration-evidence/live-land-baseline.webp` from `origin/main` at `1440×900`
- Reworked candidate: `docs/environment-exploration-evidence/candidate-{land,sea,air}.webp`
- Responsive evidence: `candidate-mobile-landscape-creator.webp` at `844×390` and `candidate-mobile-portrait-sea.webp` at `390×844`
- Comparison sheets: `land-regression-comparison.webp` is rejected → live baseline → candidate; `sea-air-regression-comparison.webp` is rejected/candidate by row.

## Blocking visual findings

| Priority | Finding | Resolution | Evidence |
| --- | --- | --- | --- |
| P0 | LAND regressed from the live renderer to flat ground and polygonal mountains. | Reused the live reflector textures, sky/ridgeline shader, haze, contact shadow, camera target, matte vehicle treatment, and light rig. The default scene now has the same material response and framing as the baseline. | `live-land-baseline.webp`, `candidate-land.webp` |
| P0 | SEA read as purple plastic, with parallel corrugation and detached foam. | Added a shared four-component wave field, view-dependent Fresnel/sky reflection, tight and broad specular response, crest lighting, fragment micro-normal detail, five-point buoyancy sampling, and surface-conforming hull foam/wake. | `candidate-sea.webp`, `candidate-sea-contact-foam.webp` |
| P0 | AIR used visibly repeated low-poly sphere clouds. | Removed all cloud sphere meshes. Added a procedural FBM atmosphere plus two independently drifting cloud-deck layers with irregular density, light/shadow response, horizon haze, and depth separation. | `candidate-air.webp` |
| P1 | LAND creator motion was unused and the environment controls could be cosmetic. | LAND motion stays hidden; atmospheric depth, accent, key/fill light, and haze density now affect rendered uniforms/lights. | `candidate-land.webp`, `creator-tools.png` in local review evidence |
| P1 | Reduced-motion and scene readiness did not fully establish settled art. | Readiness now lives inside the scene Suspense boundary. Reduced motion freezes sea, buoyancy, foam, aircraft, and atmosphere while switching the renderer to demand mode. | Environment e2e |
| P1 | Mobile portrait controls/status overlapped and SEA framing clipped. | Reserved independent status and creator-control regions; portrait camera scaling keeps the complete stand-in in frame. | `candidate-mobile-portrait-sea.webp` |

## Interaction and rendering checks

- One WebGL canvas remains mounted across repeated LAND/SEA/AIR switches.
- LAND is demand-rendered and pixel-stable after settling.
- SEA independently advances surface phase, sampled buoyancy, and foam phase.
- AIR independently advances atmosphere phase.
- Reduced motion freezes all scene animation, not only CSS transitions.
- Creator reset/export, access gate, noindex, and normal-route isolation remain covered by browser tests.
- Renderer DPR remains capped at `1.25`; shader loops and cloud layers are fixed and bounded.

Software-browser renderer snapshots after the final switch settled:

| Scene | Draw calls | Triangles | Programs | Textures | Geometries |
| --- | ---: | ---: | ---: | ---: | ---: |
| LAND | 7 | 92,283 | 15 | 22 | 8 |
| SEA | 8 | 42,844 | 19 | 20 | 16 |
| AIR | 9 | 3,424 | 18 | 20 | 23 |

Program and memory counts include resources retained by the intentionally stable shared WebGL context; draw calls and triangles are per-scene frame risk signals.

## Remaining P3 limitations

- Vessel and aircraft are intentionally labeled concept stand-ins; they are not final product art.
- Water/foam is a bounded visual approximation, not a fluid simulation.
- Cloud depth is a layered procedural approximation, not a volumetric raymarch.
- Software Chromium telemetry is useful for relative risk only and is not a business-laptop or hardware-FPS claim.
- Final visual acceptance still requires the independent reviewer requested by the parent thread.

**Final result: passed** — the reworked pixels clear the documented internal P0–P2 criteria and are ready for an independent critical checkpoint. This is not user acceptance and does not authorize publication.
