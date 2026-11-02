import type { Material } from 'three'

export const createAddonUniforms = (visible: boolean) => ({
  uAddonProgress: { value: visible ? 1 : 0 },
  uAddonGlow: { value: 0 },
  uAddonMinY: { value: 0 },
  uAddonHeight: { value: 1 },
})
export type AddonUniforms = ReturnType<typeof createAddonUniforms>

/** The same world-space voxel mask drives color and shadow geometry. */
export function applyAddonDissolve(material: Material, uniforms: AddonUniforms, glow = true) {
  const compile = material.onBeforeCompile.bind(material)
  const key = material.customProgramCacheKey()
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = `varying vec3 vAddonSurface;\n${shader.vertexShader}`.replace('#include <project_vertex>', '#include <project_vertex>\nvAddonSurface = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = `varying vec3 vAddonSurface; uniform float uAddonProgress, uAddonGlow, uAddonMinY, uAddonHeight;\n${shader.fragmentShader}`
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
      vec3 addonCell = floor(vAddonSurface / .065);
      float addonNoise = fract(sin(dot(addonCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float addonHeight = clamp((vAddonSurface.y - uAddonMinY) / uAddonHeight, 0., 1.);
      float addonRank = mix(addonNoise, addonHeight, .65);
      if (uAddonProgress < .0001 || (uAddonProgress < .9999 && addonRank > uAddonProgress)) discard;
      float addonEdge = (1. - smoothstep(0., .09, uAddonProgress - addonRank)) * uAddonGlow;
    `)
    if (glow) shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(.6, .12, 1.) * addonEdge * 5.;')
  }
  material.customProgramCacheKey = () => `${key}-addon-voxel-${glow}`
}
