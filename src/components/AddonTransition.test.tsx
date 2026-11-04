import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { AddonTransition, type AddonTransitionSnapshot } from './AddonTransition'
import { createAddonUniforms } from './addonDissolve'

const invalidate = vi.hoisted(() => vi.fn())
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ gl: { shadowMap: { needsUpdate: false } }, invalidate }),
  useFrame: vi.fn(),
}))

function syntheticAddon(name: string) {
  const root = new Group()
  root.name = name
  root.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()))
  return root
}

describe('independent add-on transitions', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('switches two real synthetic nodes without leaving the previous node visible', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const alpha = syntheticAddon('AddonAlpha')
    const beta = syntheticAddon('AddonBeta')
    const alphaUniforms = createAddonUniforms(false)
    const betaUniforms = createAddonUniforms(false)
    const states = new Map<string, AddonTransitionSnapshot>()
    const onState = (id: string, state: AddonTransitionSnapshot) => states.set(id, state)
    const view = (active: string | null) => <>
      <AddonTransition addonId="alpha" addon={alpha} visible={active === 'alpha'} uniforms={alphaUniforms} offset={new Vector3()} reducedMotion onState={onState} />
      <AddonTransition addonId="beta" addon={beta} visible={active === 'beta'} uniforms={betaUniforms} offset={new Vector3()} reducedMotion onState={onState} />
    </>

    const rendered = render(view('alpha'))
    await waitFor(() => expect([alpha.visible, beta.visible]).toEqual([true, false]))
    expect([alphaUniforms.uAddonProgress.value, betaUniforms.uAddonProgress.value]).toEqual([1, 0])

    rendered.rerender(view('beta'))
    await waitFor(() => expect([alpha.visible, beta.visible]).toEqual([false, true]))
    expect([alphaUniforms.uAddonProgress.value, betaUniforms.uAddonProgress.value]).toEqual([0, 1])
    expect(states.get('alpha')?.visible).toBe(false)
    expect(states.get('beta')?.visible).toBe(true)

    rendered.rerender(view(null))
    await waitFor(() => expect([alpha.visible, beta.visible]).toEqual([false, false]))
  })
})

