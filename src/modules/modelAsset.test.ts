import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from 'three'
import { describe, expect, it } from 'vitest'
import { seedVehicle } from '../content/seed'
import { vehicleSchema } from '../domain/schemas'
import { resolveVehicleAsset } from './modelAsset'

function syntheticAsset() {
  const scene = new Scene()
  const node = (name: string) => { const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial()); mesh.name = name; return mesh }
  scene.add(node('SyntheticVehicle'), node('AddonAlpha'), node('AddonBeta'), node('UnrelatedSceneNode'))
  return scene
}

function syntheticVehicle() {
  return vehicleSchema.parse({
    ...seedVehicle,
    id: 'synthetic-vehicle',
    modelUrl: '/test-assets/multi-addon.gltf',
    vehicleNode: 'SyntheticVehicle',
    addons: [
      { id: 'alpha', label: 'Alpha', nodeName: 'AddonAlpha', mountAnchor: 'fixture-a', available: true },
      { id: 'beta', label: 'Beta', nodeName: 'AddonBeta', mountAnchor: 'fixture-b', available: true },
    ],
  })
}

describe('runtime model-node contract', () => {
  it('extracts the configured vehicle and two real synthetic add-on nodes only', () => {
    const resolved = resolveVehicleAsset(syntheticAsset(), syntheticVehicle())
    expect(resolved.root.children.map(node => node.name)).toEqual(['SyntheticVehicle', 'AddonAlpha', 'AddonBeta'])
    expect(resolved.addons.map(addon => addon.node.name)).toEqual(['AddonAlpha', 'AddonBeta'])
    expect(resolved.root.getObjectByName('UnrelatedSceneNode')).toBeUndefined()
  })

  it('surfaces missing vehicle and add-on references as explicit asset errors', () => {
    expect(() => resolveVehicleAsset(syntheticAsset(), { ...syntheticVehicle(), vehicleNode: 'MissingVehicle' })).toThrow('missing vehicle node "MissingVehicle"')
    const broken = syntheticVehicle()
    broken.addons[1].nodeName = 'MissingAddon'
    expect(() => resolveVehicleAsset(syntheticAsset(), broken)).toThrow('missing add-on node "MissingAddon"')
  })
})

