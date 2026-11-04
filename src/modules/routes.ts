import type { ExperienceModuleDefinition } from './schema'
import { moduleRegistry, type ModuleRegistry } from './registry'

export type ModuleRoute =
  | { kind: 'hub' }
  | { kind: 'module'; definition: ExperienceModuleDefinition }
  | { kind: 'not-found'; slug: string }

export function resolveModuleRoute(pathname: string, registry: ModuleRegistry = moduleRegistry): ModuleRoute {
  const match = pathname.match(/^\/modules\/([^/]+)\/?$/)
  if (!match) return { kind: 'hub' }
  let slug: string
  try { slug = decodeURIComponent(match[1]) } catch { slug = match[1] }
  const definition = registry.getBySlug(slug)
  return definition ? { kind: 'module', definition } : { kind: 'not-found', slug }
}

