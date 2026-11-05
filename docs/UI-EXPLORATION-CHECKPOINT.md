# UI exploration checkpoint

## Branch and isolation

This work originated on `explore/addon-ui-media`. João explicitly authorized merging the reviewed UI preview into `main` and publishing it. The merge is now on `main`; public publication remains paused only for the active responsive QA checkpoint.

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
- [x] The panel fits desktop, tablet, short-landscape, and phone layouts without obscuring configuration controls.
- [x] Hub video is muted, inline, looping, and uses the existing authorized placeholder video.
- [x] The video pauses when offscreen or the page is hidden and yields to the still image for reduced motion, errors, or image-only mode.
- [x] Image fallback and optional image mode are covered by tests.
- [x] `?hubMedia=image` exposes the reviewable image-only comparison without changing the default video experiment.
- [x] Browser geometry and stacking assertions keep media full-card and below the gradient/content at desktop and phone sizes.
- [x] Phone and short-landscape Hub layouts preserve a usable card height, keep content inside the card, and maintain a tested heading gap.
- [x] The UI preview remained isolated until João authorized the merge; the merged `main` build is undergoing final responsive QA before public publication.

## Verification

```sh
npm test
npm run build
npm run test:e2e:addons
npm run test:e2e:ui-exploration
```
