# UI exploration checkpoint

## Branch and isolation

This work belongs only on `explore/addon-ui-media`. It must not be merged into `main` or deployed to the current live NEXUS Site without a separate review and authorization.

## Brief

Explore richer add-on selection and hub-card media without changing approved product claims:

- show a recognizable thumbnail derived from the actual add-on model in the bottom configuration menu;
- preserve the existing voxel reveal/hide animation;
- open a responsive right-side panel with picture, name, description, and specifications;
- mark every unknown description/specification explicitly as pending approved data;
- try a muted, inline, looping hub-card video with the current still image as fallback and retain an optional image-only mode.

## Acceptance criteria

- [x] Only add-ons present in the vehicle data/model are offered.
- [x] The menu and panel use the real rendered add-on thumbnail.
- [x] Selecting and deselecting retains the existing reveal/hide animation.
- [x] The panel includes image, name, description, and specification rows.
- [x] Unknown content is labeled as placeholder/pending approval; no product facts are invented.
- [x] The panel fits desktop and phone layouts without obscuring configuration controls.
- [x] Hub video is muted, inline, looping, and uses the existing authorized placeholder video.
- [x] The video pauses when offscreen or the page is hidden and yields to the still image for reduced motion, errors, or image-only mode.
- [x] Image fallback and optional image mode are covered by tests.
- [x] This branch remains isolated from production.

## Verification

```sh
npm test
npm run build
npm run test:e2e:addons
npm run test:e2e:ui-exploration
```
