import { visualSettingsSchema, visualPresets } from './visualSettings'
import { openDB } from 'idb'
import { z } from 'zod'
import { eventConfigSchema, hotspotModeSchema, type EventConfig } from '../domain/schemas'
import { seedEventConfig } from '../content/seed'

const operatorSettingsSchema = z.object({
  inactivitySeconds: z.number().int().min(30).max(900),
  qualityTier: z.enum(['low', 'standard', 'high', 'custom']),
  visual: visualSettingsSchema.optional(),
  hotspotMode: hotspotModeSchema.default('in-place'),
  showPerformanceStats: z.boolean().default(false),
  updateChecksEnabled: z.boolean(),
  locallyDisabledModuleIds: z.array(z.string()),
}).transform(settings => ({ ...settings, visual: settings.visual ?? visualPresets[settings.qualityTier === 'custom' ? 'standard' : settings.qualityTier] }))

const bundleSchema = z.object({
  key: z.string(),
  config: eventConfigSchema,
  checksum: z.string().length(64),
  installedAt: z.string().datetime(),
})

type ConfigBundle = z.infer<typeof bundleSchema>
export type OperatorSettings = z.infer<typeof operatorSettingsSchema>
export type ConfigState = { active: ConfigBundle; previous: ConfigBundle | null; recoveredFrom: 'active' | 'previous' | 'seed' }

const DB_NAME = 'nexus-configuration-v1'
const CONFIGS = 'configs'
const SETTINGS = 'settings'
const ACTIVE_KEY = 'activeConfigKey'
const PREVIOUS_KEY = 'previousConfigKey'
const OPERATOR_KEY = 'operatorSettings'
const OPERATOR_LOCAL_KEY = 'nexus-operator-settings-v1'

const database = () => openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(CONFIGS, { keyPath: 'key' })
    db.createObjectStore(SETTINGS)
  },
})

export const defaultSettings: OperatorSettings = {
  inactivitySeconds: 60,
  qualityTier: 'standard',
  visual: visualPresets.standard,
  hotspotMode: 'in-place',
  showPerformanceStats: false,
  updateChecksEnabled: true,
  locallyDisabledModuleIds: [],
}

async function checksum(config: EventConfig) {
  const bytes = new TextEncoder().encode(JSON.stringify(config))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function makeBundle(config: EventConfig): Promise<ConfigBundle> {
  return bundleSchema.parse({
    key: `${config.id}@${config.version}`,
    config,
    checksum: await checksum(config),
    installedAt: new Date().toISOString(),
  })
}

async function readValidBundle(key: unknown): Promise<ConfigBundle | null> {
  if (typeof key !== 'string') return null
  const record = await (await database()).get(CONFIGS, key)
  const parsed = bundleSchema.safeParse(record)
  if (!parsed.success) return null
  if (parsed.data.checksum !== await checksum(parsed.data.config)) return null
  return parsed.data
}

export async function stageAndActivateEventConfig(input: unknown) {
  const config = eventConfigSchema.parse(input)
  const bundle = await makeBundle(config)
  const db = await database()
  const currentKey = await db.get(SETTINGS, ACTIVE_KEY)
  const transaction = db.transaction([CONFIGS, SETTINGS], 'readwrite')
  await transaction.objectStore(CONFIGS).put(bundle)
  if (typeof currentKey === 'string' && currentKey !== bundle.key) await transaction.objectStore(SETTINGS).put(currentKey, PREVIOUS_KEY)
  await transaction.objectStore(SETTINGS).put(bundle.key, ACTIVE_KEY)
  await transaction.done
  return bundle
}

export async function getConfigState(): Promise<ConfigState> {
  const db = await database()
  const activeKey = await db.get(SETTINGS, ACTIVE_KEY)
  const previousKey = await db.get(SETTINGS, PREVIOUS_KEY)
  const active = await readValidBundle(activeKey)
  const previous = await readValidBundle(previousKey)
  if (active) return { active, previous, recoveredFrom: 'active' }
  if (previous) {
    const transaction = db.transaction(SETTINGS, 'readwrite')
    await transaction.store.put(previous.key, ACTIVE_KEY)
    await transaction.store.delete(PREVIOUS_KEY)
    await transaction.done
    return { active: previous, previous: null, recoveredFrom: 'previous' }
  }
  const seeded = await stageAndActivateEventConfig(seedEventConfig)
  return { active: seeded, previous: null, recoveredFrom: 'seed' }
}

export async function rollbackEventConfig() {
  const state = await getConfigState()
  if (!state.previous) return state
  const db = await database()
  const transaction = db.transaction(SETTINGS, 'readwrite')
  await transaction.store.put(state.previous.key, ACTIVE_KEY)
  await transaction.store.put(state.active.key, PREVIOUS_KEY)
  await transaction.done
  return getConfigState()
}

export async function getOperatorSettings(): Promise<OperatorSettings> {
  try {
    const immediate = localStorage.getItem(OPERATOR_LOCAL_KEY)
    if (immediate) {
      const parsed = operatorSettingsSchema.safeParse(JSON.parse(immediate))
      if (parsed.success) return parsed.data
    }
  } catch { /* IndexedDB remains the durable fallback. */ }
  const stored = await (await database()).get(SETTINGS, OPERATOR_KEY)
  return operatorSettingsSchema.catch(defaultSettings).parse(stored)
}

export async function saveOperatorSettings(input: unknown): Promise<OperatorSettings> {
  const settings = operatorSettingsSchema.parse(input)
  localStorage.setItem(OPERATOR_LOCAL_KEY, JSON.stringify(settings))
  await (await database()).put(SETTINGS, settings, OPERATOR_KEY)
  return settings
}

export async function injectConfigRecordForTest(key: string, record: unknown, pointers?: { active?: string; previous?: string }) {
  const db = await database()
  const value = record && typeof record === 'object' ? { ...record, key } : { key, value: record }
  await db.put(CONFIGS, value)
  if (pointers?.active) await db.put(SETTINGS, pointers.active, ACTIVE_KEY)
  if (pointers?.previous) await db.put(SETTINGS, pointers.previous, PREVIOUS_KEY)
}
