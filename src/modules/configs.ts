import { seedVehicle } from '../content/seed'
import { experienceModuleDefinitionSchema, type ExperienceModuleDefinition } from './schema'

const studioScene = {
  camera: { position: [7.1, 2.8, 9.2], target: [-.6, 2, 0], fov: 38, near: .1, far: 1200 },
  environment: {
    background: '#64358d',
    horizon: '#9254b1',
    zenith: '#401d73',
    fog: { color: '#9254b1', near: 18, far: 90 },
    ground: {
      color: '#3a234d', roughness: .5, metalness: .12, textureScale: 160,
      roughnessMapUrl: '/assets/ground/roughness.jpg', normalMapUrl: '/assets/ground/normal.jpg',
    },
  },
  lighting: {
    ambientIntensity: .6,
    hemisphere: { skyColor: '#edd5ff', groundColor: '#49314d', intensity: 1.6 },
    directional: [
      { position: [7, 10, 9], intensity: 2.5, color: '#fff4ed', castsShadow: true },
      { position: [-6, 6, 5], intensity: 1.2, color: '#d7a4ef', castsShadow: false },
      { position: [-5, 8, -9], intensity: 1.8, color: '#f4d8ff', castsShadow: false },
    ],
    accentPoints: [
      { position: [-1.05, 1.25, 3.15], intensity: 5, distance: 4, decay: 2, color: '#ff36dc' },
      { position: [1.05, 1.25, 3.15], intensity: 5, distance: 4, decay: 2, color: '#ff36dc' },
    ],
  },
} as const

const vehicleWithControlSlots = {
  ...seedVehicle,
  addons: [
    { ...seedVehicle.addons[0], label: 'Add-on 1' },
    { id: 'addon-2', label: 'Add-on 2', nodeName: null, mountAnchor: 'reserved-integration-point', available: false },
    { id: 'addon-3', label: 'Add-on 3', nodeName: null, mountAnchor: 'reserved-integration-point', available: false },
  ],
}

export const jltvModule = experienceModuleDefinitionSchema.parse({
  schemaVersion: 1,
  id: 'jltv',
  slug: 'jltv',
  version: '0.1.0',
  engineRange: '^0.1.0',
  presentation: {
    title: 'JLTV',
    eyebrow: 'TACTICAL VEHICLE · INTERACTIVE MODEL',
    configurationLabel: 'Configuration',
  },
  vehicle: vehicleWithControlSlots,
  scene: studioScene,
})

/**
 * A deliberately claim-free authoring fixture. It reuses the only packaged model
 * so the complete runtime can be tested without implying a second real product.
 */
export const trainingRigModule = experienceModuleDefinitionSchema.parse({
  schemaVersion: 1,
  id: 'training-rig',
  slug: 'training-rig',
  version: '0.1.0',
  engineRange: '^0.1.0',
  presentation: {
    title: 'Training Rig',
    eyebrow: 'TEMPLATE VALIDATION · DEMONSTRATION ASSET',
    description: 'Claim-free sample configuration for validating the module authoring workflow.',
    configurationLabel: 'Training configuration',
  },
  vehicle: {
    ...vehicleWithControlSlots,
    id: 'training-rig-asset',
    name: 'Training Rig (demonstration asset)',
    modelUrl: '/assets/training-rig.gltf',
    vehicleNode: 'TrainingVehicle',
    addons: [
      { id: 'training-alpha', label: 'Training add-on A', nodeName: 'TrainingAddonAlpha', mountAnchor: 'synthetic-fixture-a', available: true },
      { id: 'training-beta', label: 'Training add-on B', nodeName: 'TrainingAddonBeta', mountAnchor: 'synthetic-fixture-b', available: true },
    ],
    hotspots: vehicleWithControlSlots.hotspots.map((hotspot, index) => ({
      ...hotspot,
      id: `training-point-${index + 1}`,
      label: `Training point ${index + 1}`,
      description: 'Placeholder training content. Replace with reviewed module copy before publication.',
      details: undefined,
    })),
  },
  scene: {
    ...studioScene,
    camera: { ...studioScene.camera, position: [8.2, 3.4, 8.4] },
    environment: {
      ...studioScene.environment,
      background: '#334765',
      horizon: '#617896',
      zenith: '#17243a',
      fog: { color: '#617896', near: 18, far: 90 },
      ground: { ...studioScene.environment.ground, color: '#283646', metalness: .08 },
    },
    lighting: {
      ...studioScene.lighting,
      hemisphere: { skyColor: '#d9e8ff', groundColor: '#263447', intensity: 1.35 },
      directional: studioScene.lighting.directional.map(light => ({ ...light, color: light.castsShadow ? '#f1f6ff' : '#a9c7ee' })),
      accentPoints: [],
    },
  },
})

export const packagedModuleDefinitions: readonly ExperienceModuleDefinition[] = [jltvModule, trainingRigModule]

