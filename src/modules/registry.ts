import { experienceModuleDefinitionSchema, type ExperienceModuleDefinition } from './schema'
import { packagedModuleDefinitions } from './configs'

export type ModuleRegistry = ReturnType<typeof createModuleRegistry>

export function createModuleRegistry(input: readonly unknown[]) {
  const definitions = input.map(definition => experienceModuleDefinitionSchema.parse(definition))
  const byId = new Map<string, ExperienceModuleDefinition>()
  const bySlug = new Map<string, ExperienceModuleDefinition>()

  for (const definition of definitions) {
    if (byId.has(definition.id)) throw new Error(`Duplicate module id: ${definition.id}`)
    if (bySlug.has(definition.slug)) throw new Error(`Duplicate module slug: ${definition.slug}`)
    byId.set(definition.id, definition)
    bySlug.set(definition.slug, definition)
  }

  return Object.freeze({
    definitions: Object.freeze(definitions),
    getById: (id: string) => byId.get(id),
    getBySlug: (slug: string) => bySlug.get(slug),
  })
}

export const moduleRegistry = createModuleRegistry(packagedModuleDefinitions)

