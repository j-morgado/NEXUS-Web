export type EnvironmentKind = 'land' | 'sea' | 'air'

export type EnvironmentConfig = {
  label: string
  eyebrow: string
  description: string
  horizon: string
  zenith: string
  accent: string
  keyLight: number
  fillLight: number
  fog: number
  motion: number
  detail: number
}

export const environmentOrder: EnvironmentKind[] = ['land', 'sea', 'air']

export const environmentPresets: Record<EnvironmentKind, EnvironmentConfig> = {
  land: {
    label: 'Land',
    eyebrow: 'GROUND SYSTEMS · ESTABLISHED DIRECTION',
    description: 'The current JLTV scene, retained as the visual anchor: ultraviolet terrain, low haze, and layered mountain silhouettes.',
    horizon: '#9254b1',
    zenith: '#401d73',
    accent: '#f441f3',
    keyLight: 2.5,
    fillLight: 1.15,
    fog: 0.42,
    motion: 0.18,
    detail: 0.72,
  },
  sea: {
    label: 'Sea',
    eyebrow: 'MARITIME SYSTEMS · MOTION STUDY',
    description: 'A performant ocean study with multi-frequency waves, sampled buoyancy, and animated waterline contact foam.',
    horizon: '#6d55a7',
    zenith: '#171d50',
    accent: '#b78cff',
    keyLight: 2.2,
    fillLight: 1.35,
    fog: 0.28,
    motion: 0.56,
    detail: 0.68,
  },
  air: {
    label: 'Air',
    eyebrow: 'AIR SYSTEMS · ATMOSPHERE STUDY',
    description: 'A high-altitude direction with layered cloud banks, distant haze, and slow atmospheric drift.',
    horizon: '#9d78c8',
    zenith: '#291958',
    accent: '#e1b3ff',
    keyLight: 2.65,
    fillLight: 1.5,
    fog: 0.2,
    motion: 0.34,
    detail: 0.62,
  },
}

export function cloneEnvironmentPresets() {
  return Object.fromEntries(environmentOrder.map(kind => [kind, { ...environmentPresets[kind] }])) as Record<EnvironmentKind, EnvironmentConfig>
}

export function serializeEnvironmentConfig(kind: EnvironmentKind, config: EnvironmentConfig) {
  return JSON.stringify({ schemaVersion: 1, environment: kind, scene: config }, null, 2)
}
