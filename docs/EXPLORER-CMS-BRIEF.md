# Explorer CMS integration brief

## Goal

Make the existing Explorer render a complete catalog publication supplied by a CMS without coupling the browser UI to Drupal, Supabase, or another vendor. Markets, products, display copy, specifications, features, and image/video/PDF metadata must cross one validated delivery boundary. Preserve the current Explorer layout, private access gate, and no-index behavior.

## Delivery architecture

Drupal remains the intended enterprise authoring system, but its content model and endpoint are not available yet. NEXUS therefore consumes a small, versioned JSON publication contract rather than Drupal JSON:API records directly. A future trusted publication service maps Drupal content into that contract, signs or authenticates the publication as required, and exposes a public-read event endpoint. No authoring credentials belong in the kiosk client.

At runtime the catalog loader uses this order:

1. Fetch and validate the configured normalized JSON endpoint.
2. If the network, HTTP response, or schema is invalid, use the last validated IndexedDB publication.
3. If there is no valid cache, use the packaged demonstration publication.

The packaged publication also serves as an explicit local/mock provider for development and tests. Every provider returns the same domain model, so the Explorer does not contain vendor-specific field mapping or product copy.

## Implementation plan

- Define a versioned Zod schema for catalog-level copy, markets, products, specifications, features, and media.
- Reject unsafe media schemes; allow only same-origin root-relative paths or HTTPS URLs.
- Add provider and adapter contracts, a generic normalized-JSON adapter, an HTTP provider, and a packaged provider.
- Persist only schema-valid publications in IndexedDB and recover safely when remote content is offline or malformed.
- Move the current demonstration catalog into a JSON-like fixture parsed by the same schema.
- Add loading, fatal-empty, and non-blocking fallback states without restructuring the Explorer visual hierarchy.
- Render real image/video/PDF URLs with media-specific load errors and a branded fallback surface.
- Document the normalized payload and exact configuration needed for a future Drupal hookup.
- Verify schemas, providers, cache recovery, media failure behavior, lint, types, unit tests, production build, and browser behavior.

## Acceptance criteria

- With no endpoint configured, Explorer displays the packaged 6-market/30-product publication through the provider API.
- With a valid configured response, market/product/copy/spec/feature/media changes appear without edits to Explorer components.
- Malformed responses, unsafe URLs, empty markets, and products without media are rejected before reaching the UI.
- A successful remote publication is cached; a later network or validation failure loads that cached publication and exposes an accessible fallback notice.
- With neither remote nor cache available, the packaged publication loads and identifies itself as bundled fallback when a configured remote source failed.
- Image and video assets use CMS-supplied URLs. PDFs can be opened in the embedded viewer and in a new tab. A failed media asset shows an accessible error without breaking navigation.
- The access gate, robots metadata/header, existing Explorer navigation, and current visual structure remain intact.
- No CMS vendor, paid service, secret, endpoint, or deployment is provisioned.

## Out of scope / real-integration blockers

- Drupal content types, field machine names, JSON:API/view/export shape, base URL, authentication policy, CORS policy, and publication workflow are not supplied.
- Publication signing, CDN invalidation, asset rendition policy, editorial preview, role enforcement, and approval workflows require the trusted backend/Drupal owners.
- Large media must be downloaded or precached during event provisioning if guaranteed offline playback is required. Browser runtime caching alone is not a durable device-management strategy.
