import { describe, expect, it } from 'vitest'
import { jltvModule, packagedModuleDefinitions } from './configs'
import { createModuleRegistry } from './registry'
import { resolveModuleRoute } from './routes'
import { experienceModuleDefinitionSchema } from './schema'
import staticModuleRoutes from './routes.json'

describe('experience module definitions', () => {
  it('validates the packaged definition and configurable scene contract', () => {
    expect(experienceModuleDefinitionSchema.parse(jltvModule).scene.camera.fov).toBe(38)
  })

  it('rejects incompatible versions and invalid camera ranges', () => {
    expect(experienceModuleDefinitionSchema.safeParse({ ...jltvModule, engineRange: '^2.0.0' }).success).toBe(false)
    expect(experienceModuleDefinitionSchema.safeParse({
      ...jltvModule,
      scene: { ...jltvModule.scene, camera: { ...jltvModule.scene.camera, near: 10, far: 2 } },
    }).success).toBe(false)
  })

  it('rejects duplicate ids and slugs', () => {
    expect(() => createModuleRegistry([jltvModule, { ...jltvModule, slug: 'copy' }])).toThrow('Duplicate module id')
    expect(() => createModuleRegistry([jltvModule, { ...jltvModule, id: 'copy' }])).toThrow('Duplicate module slug')
  })

  it('resolves direct module paths without treating ordinary hub paths as missing modules', () => {
    const registry = createModuleRegistry([jltvModule])
    expect(resolveModuleRoute('/', registry)).toEqual({ kind: 'hub' })
    expect(resolveModuleRoute('/modules/jltv', registry)).toMatchObject({ kind: 'module', definition: { id: 'jltv' } })
    expect(resolveModuleRoute('/modules/unknown', registry)).toEqual({ kind: 'not-found', slug: 'unknown' })
    expect(resolveModuleRoute('/modules/%E0%A4%A', registry)).toEqual({ kind: 'not-found', slug: '%E0%A4%A' })
  })

  it('keeps generated static route shells aligned with packaged modules', () => {
    expect(packagedModuleDefinitions.map(definition => definition.slug)).toEqual(staticModuleRoutes)
  })
})

