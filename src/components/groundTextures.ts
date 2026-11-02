import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat } from 'three'

/** Seamless, deterministic multi-scale surface data; no color-space conversion. */
export function createGroundTextures() {
  const size = 256
  const roughnessData = new Uint8Array(size * size * 4)
  const hash = (x: number, y: number) => {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return value - Math.floor(value)
  }
  const noise = (u: number, v: number, cells: number) => {
    const x = u * cells, y = v * cells
    const ix = Math.floor(x), iy = Math.floor(y)
    const fx = x - ix, fy = y - iy
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    const a = hash(ix % cells, iy % cells), b = hash((ix + 1) % cells, iy % cells)
    const c = hash(ix % cells, (iy + 1) % cells), d = hash((ix + 1) % cells, (iy + 1) % cells)
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size
    const value = noise(u, v, 4) * .5 + noise(u, v, 12) * .28 + noise(u, v, 48) * .16 + noise(u, v, 128) * .06
    const patch = Math.max(0, Math.min(1, (value - .25) / .5))
    const roughness = Math.round((.48 + .52 * patch) * 255)
    roughnessData.set([roughness, roughness, roughness, 255], (y * size + x) * 4)
  }
  const texture = (data: Uint8Array) => {
    const result = new DataTexture(data, size, size, RGBAFormat)
    result.wrapS = result.wrapT = RepeatWrapping
    result.repeat.set(320, 320)
    result.generateMipmaps = true
    result.minFilter = LinearMipmapLinearFilter
    result.magFilter = LinearFilter
    result.anisotropy = 4
    result.needsUpdate = true
    return result
  }
  return { roughness: texture(roughnessData) }
}
