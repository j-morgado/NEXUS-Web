import { z } from 'zod'

export const SCHEMA_VERSION = 1 as const
const orderedText = z.object({ order: z.number().int().nonnegative(), text: z.string().min(1) })

export const productSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  marketId: z.string().min(1),
  name: z.string().min(1),
  designation: z.string().min(1),
  description: z.string().min(1),
  heroLabel: z.string().min(1),
  highlights: z.array(orderedText).min(3).max(6),
  features: z.array(orderedText).min(3).max(10),
  learnMoreUrl: z.string().url().optional(),
  isFiller: z.boolean(),
})

export const hotspotModeSchema = z.enum(['in-place', 'zoom-in-place', 'zoom-sidebar'])
export type HotspotMode = z.infer<typeof hotspotModeSchema>

export const hotspotSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  mode: hotspotModeSchema.optional(),
  details: z.array(z.object({ heading: z.string(), text: z.string() })).optional(),
  position: z.tuple([z.number(), z.number(), z.number()]),
  camera: z.object({ position: z.tuple([z.number(), z.number(), z.number()]), target: z.tuple([z.number(), z.number(), z.number()]) }),
})

export const vehicleSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  name: z.string(),
  modelUrl: z.string(),
  vehicleNode: z.string(),
  addons: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    nodeName: z.string().min(1).nullable(),
    mountAnchor: z.string().min(1),
    available: z.boolean().default(true),
  }).superRefine((addon, context) => {
    if (addon.available && !addon.nodeName) context.addIssue({ code: 'custom', message: 'Available add-ons require a model node name.', path: ['nodeName'] })
    if (!addon.available && addon.nodeName) context.addIssue({ code: 'custom', message: 'Unavailable add-on slots must not reference a model node.', path: ['nodeName'] })
  })),
  hotspots: z.array(hotspotSchema),
}).superRefine((vehicle, context) => {
  const addonIds = new Set<string>()
  const nodeNames = new Set<string>()
  vehicle.addons.forEach((addon, index) => {
    if (addonIds.has(addon.id)) context.addIssue({ code: 'custom', message: `Duplicate add-on id: ${addon.id}`, path: ['addons', index, 'id'] })
    addonIds.add(addon.id)
    if (!addon.available || !addon.nodeName) return
    if (nodeNames.has(addon.nodeName)) context.addIssue({ code: 'custom', message: `Duplicate add-on node: ${addon.nodeName}`, path: ['addons', index, 'nodeName'] })
    nodeNames.add(addon.nodeName)
    if (addon.nodeName === vehicle.vehicleNode) context.addIssue({ code: 'custom', message: 'An add-on cannot reference the base vehicle node.', path: ['addons', index, 'nodeName'] })
  })
})

export const eventConfigSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  version: z.string(),
  inactivitySeconds: z.number().min(10),
  warningSeconds: z.literal(10),
  enabledModuleIds: z.array(z.string()).min(1),
  activeBundleVersion: z.string(),
  previousBundleVersion: z.string().nullable(),
})

export const bridgeMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('module:ready'), moduleId: z.string() }),
  z.object({ type: z.literal('module:exit'), moduleId: z.string() }),
  z.object({ type: z.literal('module:error'), moduleId: z.string(), message: z.string() }),
  z.object({ type: z.literal('activity'), source: z.enum(['shell', 'module', 'explorer', 'media']), moduleId: z.string().optional() }),
])

export type Product = z.infer<typeof productSchema>
export type Vehicle = z.infer<typeof vehicleSchema>
export type EventConfig = z.infer<typeof eventConfigSchema>
