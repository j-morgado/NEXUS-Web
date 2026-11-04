# Config-driven experience modules

## Review brief

Create a versioned, validated module definition that lets an author change a vehicle asset, labels and descriptions, add-on metadata, hotspots, camera, lighting, and studio treatment without editing the rendering engine. The same definition must run through the existing NEXUS hub or at a direct standalone URL.

This branch is infrastructure and authoring work. It does not add a new hub card, redesign the add-on controls, connect a CMS, implement land/sea/air simulation, remove the preview password, change indexing policy, deploy, or merge other branches.

## Implementation prompt

1. Define a Zod-backed `ExperienceModuleDefinition` with an explicit schema version and bounded engine compatibility.
2. Keep visitor content (presentation, vehicle, add-ons, hotspots) separate from engine settings (camera, light rig, studio environment).
3. Add a registry that validates packaged definitions on import, rejects duplicate IDs/slugs, and resolves direct module URLs.
4. Turn the configurator into a reusable module runtime. Hub-hosted and standalone entry points must render the same runtime and lifecycle adapter.
5. Carry ready, exit, error, and activity events through a validated browser event bridge. Clean up listeners, Three.js clones, textures, and animations on unmount.
6. Keep current JLTV behavior and visual defaults. Include a second clearly labelled training configuration that reuses the available demonstration asset and makes no vehicle or performance claims.
7. Document the authoring workflow, asset boundaries, and current engine limitations.

## Acceptance criteria

- [ ] Existing `/` attract → hub → JLTV flow still uses the password gate and current hub card.
- [ ] `/modules/jltv` opens the same validated module directly in standalone mode behind the password gate.
- [ ] `/modules/training-rig` proves a second definition can run without adding a hub card or inventing specifications.
- [ ] An unknown `/modules/:slug` produces a recoverable, non-crashing module-not-found screen.
- [ ] Invalid definitions fail validation before rendering; duplicate IDs and slugs are rejected.
- [ ] Module copy, vehicle asset URL/node, add-ons, hotspots, camera, lighting, and studio colors/fog are configuration values.
- [ ] Ready/exit/error/activity lifecycle messages are schema-validated and include the module ID.
- [ ] Standalone exit returns to `/`; hub exit returns to the selector without a reload.
- [ ] Runtime unmount removes module-scoped DOM listeners and releases owned Three.js resources.
- [ ] Normal visitors do not see authoring or creator controls.
- [ ] Unit tests cover schema/registry/route/lifecycle behavior; typecheck, lint, unit tests, production build, and browser checks cover hub and standalone paths.
- [ ] `robots` noindex directives and the existing access gate remain intact.

## Review checkpoints

1. **Contract:** schemas, packaged examples, registry, route resolution, unit tests.
2. **Runtime:** shared host/configurator/stage adapters and lifecycle behavior.
3. **Verification:** static checks, browser evidence for hub and both direct routes, plus an explicit limitations list.

## Checkpoint results

- Contract, registry, route, lifecycle, real synthetic node extraction, schema validation, and independent multi-add-on transition coverage: 41/41 repository tests passing.
- TypeScript and production build: passing.
- Browser module suite: strict static direct links/reload, hub-hosted JLTV, standalone JLTV, standalone training fixture, configured runtime nodes/scene values, ready/exit/error/activity events, repeated entry/listener cleanup, access gate, no standalone creator controls, and unchanged hub cards passing in Chromium.
- Existing access-gate browser suite: passing at desktop and phone viewports.
- Full lint remains blocked by pre-existing React rules in `CameraMotionBlur`, `ModelStage`, `PerformanceStats`, `Configurator`, and `Explorer`; this branch does not claim a clean lint run. No new module/registry/route/lifecycle file is named in the lint findings.

