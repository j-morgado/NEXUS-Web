# Explorer research import

`leidos-explorer-research.json` is the materialized, version-pinned research package supplied for CMS/editorial preparation. It is **not** runtime content, approved marketing copy, or a redistribution clearance for any referenced media. Vite does not import it and the production build does not publish it.

## Status preserved

- 31 product/program draft records and their source registry are retained verbatim.
- All records remain `editorialState: "draft"`, `publicationReady: false`.
- Per-claim sources, uncertainty notes, asset access status, and asset rights status remain attached.
- `GeoRover`, the held SES/Analogic screening portfolio, and `VACIS` remain in `excludedOrHeld`, not in the publishable catalog.
- MXR is identified as radar. The source package confirms a HMMWV demonstration but explicitly does not verify JLTV mounting compatibility. Do not describe the current turret placeholder as MXR.

Run the integrity guard after replacing the research package:

```bash
npm run validate:research
```

## Draft-to-publication mapping

The research package is intentionally richer than the browser delivery contract:

| Research field | CMS/editorial action | Normalized publication field |
| --- | --- | --- |
| `marketIds[]` | Confirm one navigation placement or intentionally duplicate a presentation record | containing `markets[].id` and `product.marketId` |
| `name` | Approve exact product/variant name | `product.name` |
| `shortDescription` / `description` | Edit and approve claims | `designation` / `description` |
| `features[]` | Approve each claim; retain claim-source lineage in CMS | `features[].name` and `features[].description` |
| `specs[]` | Approve sourced values; never fill unknowns | `specs[]` |
| `assets[]` | Inspect pixels/playback, clear rights, create accessible renditions, and host on approved CDN | `media[]`, `heroMediaId` |
| `sourceIds`, `claimSources`, `uncertainties` | Preserve in Drupal/editorial records and approval audit; resolve before publish | not exposed in the kiosk payload |
| `editorialState`, `verificationState`, `publicationReady` | Publication gate; only approved records may enter an `approvalStatus: "approved"`, `publicationState: "published"` payload | publication approval/lifecycle fields |

The normalized kiosk schema deliberately does not treat a public source URL as approval. A trusted Drupal exporter must select only approved records and approved media, resolve market relationships, assign unique media IDs, and emit `src/content/catalog.ts`'s `explorerCatalogSchema` shape.

