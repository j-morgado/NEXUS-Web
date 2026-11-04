# Explorer catalog publication contract

The browser consumes a normalized, versioned JSON publication. It does **not** consume Drupal JSON:API entities directly. This keeps Drupal field names, relationship expansion, authentication, and revisions out of the UI and lets a trusted delivery layer change independently.

## Configuration

Set the public read endpoint at build time:

```dotenv
VITE_NEXUS_CMS_CATALOG_URL=https://content.example.org/nexus/events/<event-id>/explorer.json
```

The endpoint may also be a root-relative path such as `/content/explorer.json`. It must return JSON over HTTPS (or same-origin), allow the deployed NEXUS origin through CORS when cross-origin, and require no authoring secret in the browser. The client sends `Accept: application/json`, omits credentials, validates the entire response, and stores the last valid publication in IndexedDB.

If the variable is absent, the explicit packaged mock provider is used. That fixture is marked `approvalStatus: "demonstration"`; it is not approved marketing content.

## Shape

```json
{
  "schemaVersion": 1,
  "publicationId": "event-2027-explorer",
  "revision": "42",
  "publishedAt": "2027-01-10T18:30:00.000Z",
  "approvalStatus": "approved",
  "copy": {
    "title": "Explorer",
    "introduction": "Browse products and services.",
    "systemSuffix": "system",
    "specificationsHeading": "Specifications",
    "featuresLabel": "Product features",
    "shareLabel": "Share",
    "shareIntroduction": "To receive more information, complete this form."
  },
  "markets": [
    {
      "id": "land",
      "name": "Land",
      "products": [
        {
          "id": "example-system",
          "marketId": "land",
          "name": "Example system",
          "designation": "Verified editorial designation",
          "description": "Approved description.",
          "specs": [{ "name": "Status", "value": "Available" }],
          "features": [{ "name": "Feature", "description": "Approved feature copy." }],
          "heroMediaId": "example-video",
          "heroMediaLabel": "Example system overview",
          "isFiller": false,
          "media": [
            {
              "id": "example-video",
              "name": "Overview video",
              "description": "Approved media description.",
              "kind": "video",
              "url": "https://cdn.example.org/media/example.mp4",
              "thumbnailUrl": "https://cdn.example.org/media/example.webp",
              "accent": "#8d63ea"
            },
            {
              "id": "example-document",
              "name": "Product overview",
              "description": "Approved document description.",
              "kind": "pdf",
              "url": "https://cdn.example.org/media/example.pdf",
              "thumbnailUrl": "https://cdn.example.org/media/example-document.webp",
              "accent": "#6753ac",
              "pageCount": 4
            }
          ]
        }
      ]
    }
  ]
}
```

The authoritative executable schema is `src/content/catalog.ts`. Arrays must be non-empty; IDs must be unique; product `marketId` values must match their containing market; hero IDs must resolve within the product; and asset URLs must be root-relative or HTTPS. `javascript:`, `data:`, protocol-relative, and plain HTTP asset URLs are rejected.

## Drupal integration requirements

The Drupal/content-platform team must provide these before the generic HTTP provider can be pointed at production:

1. Environment-specific publication URL and deployed NEXUS origins.
2. Drupal content types and field machine names for markets, products, specs, features, and media relationships.
3. A mapper/exporter that resolves Drupal relationships and media renditions into the normalized shape above.
4. Publication rules for `approvalStatus`, revisions, scheduled publishing, retirement, and rollback.
5. Asset/CDN CORS, range-request, MIME type, cache-control, and video codec policy.
6. A public-read or short-lived delivery authorization design. Drupal authoring/session credentials must never be embedded in Vite variables.
7. Editorial confirmation for all claims and compatibility relationships. JLTV carrier imagery does not establish that a named Leidos add-on—MXR or otherwise—is compatible.
8. Event provisioning rules for downloading the validated JSON and all required media to managed devices when guaranteed offline operation is required.

## Offline behavior

Valid remote publications are stored in IndexedDB. On fetch, HTTP, or validation failure, Explorer uses the last validated cache and displays a small accessible notice. With no cache it uses the packaged demonstration fixture. Media URLs are not bulk-downloaded by this adapter; guaranteed offline image/video/PDF access requires a provisioning manifest, storage budget, integrity metadata, and managed-device acceptance testing.

