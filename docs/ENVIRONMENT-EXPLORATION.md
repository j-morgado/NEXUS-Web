# NEXUS environment exploration

## Branch brief

Branch: `feature/nexus-environment-exploration`

This branch prototypes three reviewable scene directions without changing the live visitor journey:

- **Land** preserves the current purple ground, haze, mountain-ridge, and JLTV direction.
- **Sea** demonstrates a lightweight animated ocean, a buoyant vessel-shaped concept stand-in, and animated contact foam at the waterline.
- **Air** demonstrates a layered sky, moving procedural clouds, and an aircraft-shaped concept stand-in.

The ship and aircraft geometry are explicitly concept stand-ins. They are not final art, sourced product models, or approved product representations. No hub card or hub media is changed by this branch.

The exploration is available only through the review harness query `?environmentLab=1`. The normal visitor route remains unchanged. Creator controls appear only inside that harness and are not added to the visitor experience.

## Implementation prompts / plan

1. Add typed, reviewable environment presets for palette, lighting, fog, terrain, waves, buoyancy, foam, and cloud density.
2. Add an isolated React Three Fiber environment harness with LAND / SEA / AIR switching.
3. Keep geometry and shader budgets suitable for ordinary 2025/2026 business laptops: capped DPR, bounded plane subdivisions, simple materials, and no added heavyweight runtime dependencies.
4. Add creator-only controls for lighting, atmosphere, environment-specific motion/density, reset, and JSON copy. Keep them outside the visitor route.
5. Add automated interaction checks and capture screenshots at a 1440×900 business-laptop viewport.

## Testable acceptance criteria

- Visiting the normal root does not expose environment selection or creator controls.
- Visiting `?environmentLab=1` after the existing access gate shows a LAND / SEA / AIR selector and a creator-tools disclosure.
- LAND shows the supplied JLTV in the established purple land direction with ground and mountain silhouettes.
- SEA visibly animates its surface, vessel buoyancy, and waterline contact foam. The vessel is labeled `CONCEPT STAND-IN · FINAL ART PENDING`.
- AIR shows moving cloud layers and an aircraft-shaped stand-in against a suitable atmospheric background. The aircraft is labeled `CONCEPT STAND-IN · FINAL ART PENDING`.
- Switching environments updates the scene title, description, status metadata, and environment-specific creator control.
- LAND remains static between interactions and does not expose a non-functional ambient-motion control.
- Creator controls can change key light, fill light, fog, accent color, and the active environment characteristic; Reset restores that environment's preset; Copy JSON produces a serializable configuration.
- Keyboard focus is visible, selector state is exposed with `aria-pressed`, and the creator controls are usable without pointer input.
- Environment switching preserves the WebGL canvas, and reduced-motion preference pauses scene animation as well as CSS transitions.
- The branch passes typecheck, lint, unit tests, production build, and its environment browser check. Existing unrelated failures, if any, are reported separately.
- Review screenshots exist for all three environments at 1440×900, and browser console/page errors are reported.

## Cost and production notes

This prototype uses no paid service and adds no production infrastructure. It reuses the existing Three.js stack and local assets.

The animated sea is intentionally visual rather than a full fluid simulation. Buoyancy samples the same deterministic wave function at the hull center, bow, stern, port, and starboard points, which is plausible and inexpensive but not physics-authoritative. Contact foam uses the same wave displacement across a subdivided hull-footprint mask, so it follows the rendered surface rather than a detached fixed ring. It remains a lightweight visual approximation, not fluid interaction. Production ships would need authored hull data and calibrated buoyancy points.

Clouds are bounded transparent meshes with deterministic drift. This keeps the prototype responsive, but final air art should use approved cloud volumes or baked cards and an approved aircraft model.

Creator settings currently copy as JSON and reset in memory. Persistence, schema publication, roles, and CMS integration belong to the separate templating/CMS workstreams.

## Review checkpoint

The implemented harness is intentionally reachable only at `?environmentLab=1` behind the existing preview gate. Captures use a 1440×900 viewport:

| Direction | Evidence |
| --- | --- |
| Land | [land.webp](environment-exploration-evidence/land.webp) |
| Sea | [sea.webp](environment-exploration-evidence/sea.webp) |
| Air | [air.webp](environment-exploration-evidence/air.webp) |
| Creator controls | [creator-tools.webp](environment-exploration-evidence/creator-tools.webp) |
| Sea contact foam | [sea-contact-foam.webp](environment-exploration-evidence/sea-contact-foam.webp) |
| Mobile landscape creator controls | [mobile-landscape-creator.webp](environment-exploration-evidence/mobile-landscape-creator.webp) |

The remediation browser pass also captures a close crop of the sea contact foam and an `844×390` landscape view of the open creator panel. It verifies the ocean wave phase, sampled buoyancy height, and foam phase independently; repeated LAND/SEA/AIR switches on one canvas; static demand rendering for LAND; creator edit/reset/export; reduced-motion pausing; access-gate and noindex behavior; normal-route isolation; and no browser console or page errors. The vessel and aircraft remain explicitly labeled concept stand-ins.
