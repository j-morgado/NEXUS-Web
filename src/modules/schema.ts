import { z } from 'zod'
import { vehicleSchema } from '../domain/schemas'

const vector3Schema = z.tuple([z.number(), z.number(), z.number()])
const colorSchema = z.string().min(1)

export const moduleSceneSchema = z.object({
  camera: z.object({
    position: vector3Schema,
    target: vector3Schema,
    fov: z.number().min(15).max(90),
    near: z.number().positive(),
    far: z.number().positive(),
  }).refine(camera => camera.far > camera.near, { message: 'Camera far plane must exceed the near plane.' }),
  environment: z.object({
    background: colorSchema,
    horizon: colorSchema,
    zenith: colorSchema,
    fog: z.object({ color: colorSchema, near: z.number().nonnegative(), far: z.number().positive() })
      .refine(fog => fog.far > fog.near, { message: 'Fog far distance must exceed its near distance.' }),
    ground: z.object({
      color: colorSchema,
      roughness: z.number().min(0).max(1),
      metalness: z.number().min(0).max(1),
      textureScale: z.number().positive(),
      roughnessMapUrl: z.string().min(1),
      normalMapUrl: z.string().min(1),
    }),
  }),
  lighting: z.object({
    ambientIntensity: z.number().nonnegative(),
    hemisphere: z.object({ skyColor: colorSchema, groundColor: colorSchema, intensity: z.number().nonnegative() }),
    directional: z.array(z.object({
      position: vector3Schema,
      intensity: z.number().nonnegative(),
      color: colorSchema,
      castsShadow: z.boolean().default(false),
    })).min(1).max(6),
    accentPoints: z.array(z.object({
      position: vector3Schema,
      intensity: z.number().nonnegative(),
      distance: z.number().positive(),
      decay: z.number().positive(),
      color: colorSchema,
    })).max(8),
  }),
})

export const experienceModuleDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  engineRange: z.literal('^0.1.0'),
  presentation: z.object({
    title: z.string().min(1),
    eyebrow: z.string().min(1),
    description: z.string().min(1).optional(),
    configurationLabel: z.string().min(1),
  }),
  vehicle: vehicleSchema,
  scene: moduleSceneSchema,
})

export type ModuleScene = z.infer<typeof moduleSceneSchema>
export type ExperienceModuleDefinition = z.infer<typeof experienceModuleDefinitionSchema>

