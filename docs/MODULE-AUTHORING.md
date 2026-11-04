# Experience module authoring

Experience modules are packaged, versioned data consumed by one shared React/Three.js runtime. The source of truth is an `ExperienceModuleDefinition` validated by `src/modules/schema.ts`; packaged examples live in `src/modules/configs.ts` and are registered in `src/modules/registry.ts`.

## Create a packaged module

1. Copy the claim-free `trainingRigModule` definition, then assign unique `id` and `slug` values and reset `version` to the module's initial semantic version.
2. Put the optimized GLB and any image/texture derivatives under `public/assets/`. Keep source assets and proprietary originals outside Git according to the existing asset policy.
3. Set `vehicle.modelUrl`, `vehicle.vehicleNode`, add-on node names, and hotspot positions/cameras to values verified against that GLB. Do not guess node names or publish unreviewed specifications.
4. Replace presentation, hotspot, and add-on labels with approved content. The schema deliberately keeps visitor content in the module definition rather than in rendering components.
5. Tune `scene.camera`, `scene.environment`, and `scene.lighting`. Colors, fog distances, ground textures, camera framing, and the light rig are module values.
6. Add the parsed definition to `packagedModuleDefinitions`. Import-time validation rejects incompatible schema/engine versions, invalid ranges, and duplicate registry IDs/slugs.
7. Test the direct route at `/modules/<slug>`. Adding a hub card is a separate product decision; registration alone does not expose a new card.

## Hosting modes

- **NEXUS hub:** the existing JLTV card mounts `ModuleHost` in `hub` mode and returns to the selector without reloading.
- **Standalone:** `/modules/<slug>` mounts the same `ModuleHost` in `standalone` mode. It remains behind the existing session password gate and retains the site's noindex policy. Exit returns to `/`.

Both modes emit schema-validated `nexus:module` ready/exit/error events. Module interactions also emit `nexus:activity` with the module ID. `ModuleHost` owns the adapter and disposes it on unmount; the stage continues to release cloned geometry/materials, ground texture clones, particles, requestAnimationFrame work, and document listeners.

## Media and asset boundaries

- GLB and texture URLs are same-origin paths by default and are loaded by Drei's Suspense-aware loaders.
- Production builds include packaged assets in the existing Workbox cache glob. A future remote CMS adapter must define CORS, integrity, revisioning, cache quotas, and failure fallbacks before remote assets are enabled.
- The `training-rig` sample intentionally reuses `jltv-runtime.glb`; its title and copy clearly identify it as a validation fixture. It is not a second product or a source of product claims.

## Current limitations

- The engine supports exclusive add-on selection. The available demonstration GLB contains one verified add-on node; additional control slots are reserved placeholders. Validate transition behavior before authoring a model with multiple real add-on nodes.
- Studio scene values are configurable, but environment *types* remain the existing ground/studio implementation. Land/sea/air environment engines belong to the separate environment workstream.
- Module definitions are packaged TypeScript data. CMS publication, trust/signing, author roles, drafts, and remote media delivery belong to the separate CMS workstream.
- Hotspots use model-local coordinates and therefore require per-asset authoring. There is no visual creator tool in the visitor runtime.
- The hidden Dev Options surface remains existing hub behavior. Standalone modules do not render it, and this branch adds no creator controls to visitor UI.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:modules
```

The full repository lint currently reports pre-existing React purity/state-in-effect findings; module-branch lint deltas should still be reviewed separately.

