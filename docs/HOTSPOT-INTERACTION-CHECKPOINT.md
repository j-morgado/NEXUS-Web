# Hotspot interaction checkpoint

## Brief

Keep an opened hotspot attached to its projected vehicle anchor, including near viewport edges. A click or tap outside the hotspot closes it, while a pointer drag used to orbit the vehicle keeps it open unless the selected point becomes occluded by the vehicle.

This checkpoint is intentionally limited to hotspot behavior on `main`. Add-on UI and environment/editor explorations are separate workstreams and must not be merged here.

## Acceptance criteria

- [x] Opening a hotspot does not shift its anchor horizontally or vertically.
- [x] Near-bottom behavior is verified at desktop and phone viewports.
- [x] Outside mouse click closes the hotspot.
- [x] Mouse drag does not close the hotspot by gesture handling alone.
- [x] Outside touch tap closes the hotspot.
- [x] Touch drag does not close the hotspot by gesture handling alone.
- [x] Repeated open, close, and reopen flows remain functional.
- [x] Vehicle occlusion can still hide and close the selected hotspot.
- [x] Password gate, public/noindex hosting configuration, and unrelated experience behavior remain unchanged.

## Verification

Run:

```sh
npm test
npm run build
npm run test:e2e:hotspot-interactions
```

The browser check covers 960×620 desktop and 390×844 phone viewports, mouse and touch pointer sequences, repeated toggles, anchor stability, and occlusion dismissal.
