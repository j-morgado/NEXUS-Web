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
  learnMoreUrl: z.string().url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol), 'Learn-more links must use HTTP or HTTPS').optional(),
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
    id: z.string(),
    label: z.string(),
    nodeName: z.string(),
    mountAnchor: z.string(),
    thumbnailUrl: z.string(),
    description: z.string(),
    specs: z.array(z.object({ label: z.string(), value: z.string() })),
  })),
  hotspots: z.array(hotspotSchema),
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
  z.object({ type: z.literal('activity'), source: z.enum(['shell', 'module', 'explorer', 'media']) }),
])

export type Product = z.infer<typeof productSchema>
export type Vehicle = z.infer<typeof vehicleSchema>
export type EventConfig = z.infer<typeof eventConfigSchema>
