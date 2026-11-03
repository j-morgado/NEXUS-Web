import { z } from 'zod'

export const visualSettingsSchema = z.object({
  ssgi: z.boolean(), ssgiSamples: z.number().int().min(8).max(32),
  ssao: z.boolean(), ssaoSamples: z.number().int().min(8).max(32),
  ssr: z.boolean(), ssrSteps: z.number().int().min(16).max(64),
  motionBlur: z.boolean(), motionBlurSamples: z.number().int().min(3).max(15),
  resolutionScale: z.number().min(.5).max(1), maxDpr: z.number().min(1).max(2),
  planarReflections: z.boolean(), reflectionResolution: z.union([z.literal(256), z.literal(512), z.literal(1024)]),
  shadowResolution: z.union([z.literal(512), z.literal(1024), z.literal(2048)]),
})
export type VisualSettings = z.infer<typeof visualSettingsSchema>
export type QualityTier = 'low' | 'standard' | 'high' | 'custom'
export const visualPresets: Record<Exclude<QualityTier, 'custom'>, VisualSettings> = {
  low: { ssgi: false, ssgiSamples: 8, ssao: true, ssaoSamples: 8, ssr: false, ssrSteps: 16, motionBlur: false, motionBlurSamples: 3, resolutionScale: .75, maxDpr: 1, planarReflections: true, reflectionResolution: 256, shadowResolution: 512 },
  standard: { ssgi: false, ssgiSamples: 16, ssao: true, ssaoSamples: 16, ssr: false, ssrSteps: 32, motionBlur: true, motionBlurSamples: 5, resolutionScale: 1, maxDpr: 1.25, planarReflections: true, reflectionResolution: 512, shadowResolution: 1024 },
  high: { ssgi: true, ssgiSamples: 24, ssao: true, ssaoSamples: 32, ssr: true, ssrSteps: 48, motionBlur: true, motionBlurSamples: 9, resolutionScale: 1, maxDpr: 1.75, planarReflections: true, reflectionResolution: 1024, shadowResolution: 2048 },
}
