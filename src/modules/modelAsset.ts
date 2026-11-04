import { Group, PropertyBinding, type Object3D } from 'three'
import type { Vehicle } from '../domain/schemas'

export type RuntimeAddon = {
  definition: Vehicle['addons'][number] & { nodeName: string; available: true }
  node: Object3D
}

export type ResolvedVehicleAsset = {
  root: Group
  vehicleNode: Object3D
  addons: RuntimeAddon[]
}

function configuredNode(source: Object3D, configuredName: string) {
  const runtimeNames = new Set([configuredName, PropertyBinding.sanitizeNodeName(configuredName)])
  const matches: Object3D[] = []
  source.traverse(node => { if (runtimeNames.has(node.name)) matches.push(node) })
  if (matches.length > 1) throw new Error(`Module asset node "${configuredName}" is ambiguous after glTF name normalization.`)
  return matches[0]
}

export function resolveVehicleAsset(source: Object3D, vehicle: Vehicle): ResolvedVehicleAsset {
  const vehicleNode = configuredNode(source, vehicle.vehicleNode)
  if (!vehicleNode) throw new Error(`Module asset is missing vehicle node "${vehicle.vehicleNode}" in ${vehicle.modelUrl}.`)

  const addons = vehicle.addons.filter((addon): addon is RuntimeAddon['definition'] => addon.available && addon.nodeName !== null).map(definition => {
    const node = configuredNode(source, definition.nodeName)
    if (!node) throw new Error(`Module asset is missing add-on node "${definition.nodeName}" for "${definition.label}" in ${vehicle.modelUrl}.`)
    return { definition, node }
  })

  const assigned = new Set<Object3D>([vehicleNode])
  for (const addon of addons) {
    if (assigned.has(addon.node)) throw new Error(`Module asset node "${addon.definition.nodeName}" is assigned more than once.`)
    assigned.add(addon.node)
  }

  source.updateWorldMatrix(true, true)
  const root = new Group()
  root.name = `${vehicle.id}-runtime-root`
  root.attach(vehicleNode)
  for (const addon of addons) root.attach(addon.node)
  root.updateWorldMatrix(true, true)
  return { root, vehicleNode, addons }
}

