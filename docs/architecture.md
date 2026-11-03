# First-increment architecture

## Contracts

- Zod schemas in `src/domain` version product, vehicle/addon/hotspot, event config, and module bridge messages.
- Seed content is separate from rendering. Future CMS publication can hydrate the same schemas without changing module UI.
- Shell routing, inactivity reset, local queue, usage events, and operator controls are services around the configurator module.
- `modules/contract.ts` defines explicit ready/exit/error/activity lifecycle and disposal hooks for independently registered modules.
- Event configuration includes active/previous bundle identifiers now. This is a contract only; secure publishing, compatibility verification, activation, and rollback are deferred.

## Reversible defaults

React 19, TypeScript, Vite, React Three Fiber/Three.js, Zod, IndexedDB via `idb`, and Workbox through `vite-plugin-pwa` are used for the bounded prototype. No backend or vendor service is provisioned. The transport boundary can later map the local outbox to a server idempotency/retry adapter without putting provider secrets in the client.

Configurator/Three.js and Explorer are lazy route chunks. The shell loads independently; the service worker precaches all bounded release chunks after provisioning so route splitting does not break verified offline entry.

## Ownership and disposal

The configurator clones the loaded GLB scene, toggles the attachment node by name, and disposes cloned geometry/materials on unmount. A production asset manager should add explicit texture reference counting once multiple modules share textures.
