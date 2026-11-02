import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat } from 'three'

/** Seamless, deterministic multi-scale surface data; no color-space conversion. */
export function createGroundTextures() {
  const size = 1024
  const roughnessData = new Uint8Array(size * size * 4)
  const hash = (x: number, y: number) => {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return value - Math.floor(value)
  }
  // Cache the periodic noise lattice once; high-resolution generation stays cheap.
  const layers = [
    { cells: 4, weight: .12 }, { cells: 12, weight: .14 },
    { cells: 48, weight: .18 }, { cells: 128, weight: .28 },
    { cells: 256, weight: .18 }, { cells: 512, weight: .10 },
  ].map(layer => ({ ...layer, values: Float32Array.from({ length: layer.cells * layer.cells }, (_, index) => hash(index % layer.cells, Math.floor(index / layer.cells))) }))
  const noise = (u: number, v: number, cells: number, values: Float32Array) => {
    const x = u * cells, y = v * cells
    const ix = Math.floor(x), iy = Math.floor(y)
    const fx = x - ix, fy = y - iy
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    const a = values[(iy % cells) * cells + ix % cells], b = values[(iy % cells) * cells + (ix + 1) % cells]
    const c = values[((iy + 1) % cells) * cells + ix % cells], d = values[((iy + 1) % cells) * cells + (ix + 1) % cells]
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size
    let value = 0
    for (const layer of layers) value += noise(u, v, layer.cells, layer.values) * layer.weight
    const patch = Math.max(0, Math.min(1, (value - .36) / .28))
    const roughness = Math.round((.4 + .6 * patch) * 255)
    roughnessData.set([roughness, roughness, roughness, 255], (y * size + x) * 4)
  }
  const texture = (data: Uint8Array) => {
    const result = new DataTexture(data, size, size, RGBAFormat)
    result.wrapS = result.wrapT = RepeatWrapping
    result.repeat.set(320, 320)
    result.generateMipmaps = true
    result.minFilter = LinearMipmapLinearFilter
    result.magFilter = LinearFilter
    result.anisotropy = 8
    result.needsUpdate = true
    return result
  }
  return { roughness: texture(roughnessData) }
}
