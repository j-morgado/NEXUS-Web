# JLTV asset receipt and runtime report

## Preserved source

- Private Library ID: `libfile_944514e26d108191a145f60ab57620c8`, version 0
- Filename: `JLTV.glb`
- Size: 179,612,840 bytes
- SHA-256: `06c722d7e3ee8be432ac1289a11252b891725fd41acd880a04a2cfe856671a23`
- Verified after cloud materialization on 2026-11-02. Original is outside Git.

## Cloud visual inspection

Blender 4.3.2 imported and rendered the actual GLB headlessly. It contains two top-level mesh objects named `JLTV` and `Addon 1`. Bounds are approximately 3.468 × 6.554 × 4.745 model units. The rendered source shows a detailed woodland-camouflage tactical vehicle with a roof-mounted attachment, antennas, wheel/tire detail, glazing, and metallic surface variation. Model front/orientation and real-world scale remain unverified.

## Runtime derivative

Generated in the cloud with glTF-Transform 4.5.1 while retaining the two separately addressable named meshes:

```bash
gltf-transform optimize JLTV.glb jltv-runtime.glb --flatten false --join false --palette false --texture-compress webp --texture-size 2048
```

- Size: 3,088,360 bytes (98.3% smaller than source)
- SHA-256: `d56ccd9b7f0b4cbc4225f265329b48cd9be7ad5bdde56745b368bbc98a6013f7`
- Geometry: two meshes, approximately 90,291 uploaded vertices / 273,957 rendered vertices
- Textures: nine embedded 2048×2048 WebP images; estimated uncompressed texture memory remains substantial (roughly 201 MB across the nine RGBA mip chains in the inspection report), so representative integrated-GPU testing is still required.
- Compression: `EXT_meshopt_compression`, `EXT_texture_webp`, and quantized geometry. Current target browsers must support those extensions through Three.js loaders.

The derivative is excluded from Git because of proprietary-content and repository-size concerns. In the local cloud run the browser served the cached model resource in roughly 20–40 ms; this is environment evidence, not network or target-device load time.

## Visual comparison

The source GLB and a texture-equivalent review derivative were rendered in Blender 4.3.2 using the same camera, lighting, 1280×720 output, and 64-sample Eevee settings. (Blender's bundled importer cannot decode `EXT_meshopt_compression`, so the review derivative disabled meshopt geometry compression while retaining the same 2048px WebP texture conversion used by the runtime file.)

- Full-frame SSIM: `0.993516`
- Normalized RMSE: `0.00609541`
- Side-by-side inspection found very close color/material response with mild fine-surface softening visible at close examination, especially on textured body panels and small hardware.

This supports the 2048px derivative for the current cloud demo but does **not** establish visually lossless conversion. Final acceptance still requires inspection on the 43-inch target display and focused close-up views; a selective 4K tier may be preferable for hotspot regions if softness is visible at event viewing distance.

## Known limitations

The supplied model has no authored animation. Attachment position is preserved as supplied. No real MXR geometry, verified mount dimensions, LODs, collision proxies, or approved environment/HDR was supplied.
