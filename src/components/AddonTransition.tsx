import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { AdditiveBlending, Box3, BufferAttribute, BufferGeometry, Mesh, Points, ShaderMaterial, Vector3, type Object3D } from 'three'
import type { AddonUniforms } from './addonDissolve'

type Props = { addon: Object3D | undefined; visible: boolean; uniforms: AddonUniforms; offset: Vector3; reducedMotion: boolean; stageRef: RefObject<HTMLDivElement | null> }

export function AddonTransition({ addon, visible, uniforms, offset, reducedMotion, stageRef }: Props) {
  const { gl, invalidate } = useThree()
  const initialized = useRef(false)
  const animation = useRef({ target: visible ? 1 : 0, age: 10, running: false })
  const particles = useMemo(() => {
    const count = 112
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
    geometry.setAttribute('aSeed', new BufferAttribute(Float32Array.from({ length: count * 3 }, (_, index) => { const n = Math.sin(index * 127.1 + 4.7) * 43758.5453; return n - Math.floor(n) }), 3))
    const material = new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: { uTime: { value: 10 } },
      vertexShader: `
        attribute vec3 aSeed; uniform float uTime; varying float vLife;
        void main(){
          float age=uTime-aSeed.x*.75;
          vLife=step(0.,age)*(1.-smoothstep(.2,1.35,age));
          vec3 p=position+vec3((aSeed.y-.5)*age*.35,max(0.,age)*(.55+aSeed.z*.7),(aSeed.z-.5)*age*.35);
          vec4 view=modelViewMatrix*vec4(p,1.);
          gl_Position=projectionMatrix*view;
          gl_PointSize=clamp((70./max(.1,-view.z))*(.45+aSeed.y*.65),2.,10.);
        }`,
      fragmentShader: `
        varying float vLife;
        void main(){
          vec2 p=gl_PointCoord-.5;
          float core=1.-smoothstep(.12,.26,max(abs(p.x),abs(p.y)));
          float halo=exp(-dot(p,p)*14.);
          gl_FragColor=vec4(vec3(.65,.16,1.)*(core*3.+halo*.8),(core+halo*.45)*vLife);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
    const points = new Points(geometry, material)
    points.visible = false
    points.frustumCulled = false
    return { geometry, material, points, count }
  }, [])
  useEffect(() => () => { particles.geometry.dispose(); particles.material.dispose() }, [particles])

  useEffect(() => {
    if (!addon) return
    addon.updateWorldMatrix(true, true)
    const box = new Box3().setFromObject(addon)
    uniforms.uAddonMinY.value = box.min.y
    uniforms.uAddonHeight.value = Math.max(.1, box.max.y - box.min.y)
    const target = visible ? 1 : 0
    if (!initialized.current || reducedMotion) {
      initialized.current = true
      uniforms.uAddonProgress.value = target
      uniforms.uAddonGlow.value = 0
      addon.visible = visible
      animation.current = { target, age: 10, running: false }
      particles.points.visible = false
      if (stageRef.current) {
        stageRef.current.dataset.addonVisible = String(visible)
        stageRef.current.dataset.addonTransitioning = 'false'
        stageRef.current.dataset.addonProgress = String(target)
        stageRef.current.dataset.addonParticles = '0'
      }
    } else {
      animation.current = { target, age: 0, running: true }
      addon.visible = true
      uniforms.uAddonGlow.value = 1
      const meshes: Mesh[] = []
      addon.traverse(object => { if (object instanceof Mesh) meshes.push(object) })
      const positions = particles.geometry.getAttribute('position') as BufferAttribute
      const point = new Vector3()
      for (let index = 0; index < particles.count; index++) {
        const mesh = meshes[index % meshes.length]
        if (!mesh) break
        const vertices = mesh.geometry.getAttribute('position')
        point.fromBufferAttribute(vertices, (index * 127 + 37) % vertices.count).applyMatrix4(mesh.matrixWorld).sub(offset)
        positions.setXYZ(index, point.x, point.y, point.z)
      }
      positions.needsUpdate = true
      particles.material.uniforms.uTime.value = 0
      particles.points.visible = true
    }
    gl.shadowMap.needsUpdate = true
    invalidate()
  }, [addon, visible, reducedMotion, uniforms, offset, particles, gl, invalidate, stageRef])

  useFrame((_, delta) => {
    if (!addon || !animation.current.running) return
    const state = animation.current
    // Ignore the long idle delta on the first demand-driven frame.
    const step = state.age === 0 ? 1 / 60 : Math.min(delta, .1)
    state.age += step
    const before = uniforms.uAddonProgress.value
    const direction = Math.sign(state.target - before)
    const progress = direction > 0 ? Math.min(state.target, before + step / 1.05) : Math.max(state.target, before - step / 1.05)
    uniforms.uAddonProgress.value = progress
    const dissolving = Math.abs(progress - state.target) > .0001
    uniforms.uAddonGlow.value = dissolving ? 1 : 0
    addon.visible = progress > .0001 || state.target === 1
    particles.material.uniforms.uTime.value = state.age
    particles.points.visible = state.age < 2.15
    const running = dissolving || particles.points.visible
    state.running = running
    if (stageRef.current) {
      stageRef.current.dataset.addonVisible = String(addon.visible)
      stageRef.current.dataset.addonTransitioning = String(running)
      stageRef.current.dataset.addonProgress = progress.toFixed(3)
      stageRef.current.dataset.addonParticles = particles.points.visible ? String(particles.count) : '0'
    }
    if (dissolving || before !== progress) gl.shadowMap.needsUpdate = true
    if (running) invalidate()
  })
  return <primitive object={particles.points} />
}
