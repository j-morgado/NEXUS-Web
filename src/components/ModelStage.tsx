import { visualPresets, type VisualSettings } from '../services/visualSettings'
/* eslint-disable react-hooks/immutability -- React Three Fiber requires imperative scene, renderer, and frame-state updates. */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, MeshReflectorMaterial, useGLTF, useProgress, useTexture } from '@react-three/drei'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { BackSide, Box3, Color, DoubleSide, FrontSide, Mesh, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking, Raycaster, NoColorSpace, RepeatWrapping, LinearFilter, LinearMipmapLinearFilter, Vector2, Vector3, type Material, type Object3D, type PerspectiveCamera } from 'three'
import type { Vehicle, HotspotMode } from '../domain/schemas'
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'
import { HotspotCamera } from './HotspotCamera'
import { sidebarWidth } from './hotspotCamera'
import { CameraMotionBlur } from './CameraMotionBlur'
import { SceneReadiness } from './SceneReadiness'
import { AddonTransition } from './AddonTransition'
import { applyAddonDissolve, createAddonUniforms } from './addonDissolve'

type Props = { vehicle: Vehicle; addonVisible: boolean; activeHotspot: string | null; hotspotMode?: HotspotMode; qualityTier?: 'standard' | 'high'; visual?: VisualSettings; showPerformanceStats?: boolean; onHotspot: (id: string | null) => void; onExit: () => void; onReadyChange: (ready: boolean) => void; onProgress: (progress: number) => void }
type MarkerRefs = RefObject<Map<string, HTMLDivElement>>
const STUDIO_HORIZON = '#9254b1'
const STUDIO_FOG_NEAR = 18
const STUDIO_FOG_FAR = 90
const DEFAULT_POSITION = new Vector3(7.1, 2.8, 9.2)
const DEFAULT_TARGET = new Vector3(-.6, 2.0, 0)


function StudioSky() {
  return <mesh renderOrder={-1}>
    <sphereGeometry args={[450, 32, 16]} />
    <shaderMaterial side={BackSide} depthWrite={false} toneMapped={false} uniforms={{ horizonColor: { value: new Color(STUDIO_HORIZON) }, zenithColor: { value: new Color('#401d73') }, fogNear: { value: STUDIO_FOG_NEAR }, fogFar: { value: STUDIO_FOG_FAR } }}
      vertexShader={`varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={`
        varying vec3 vDirection;
        uniform vec3 horizonColor, zenithColor;
        uniform float fogNear, fogFar;
        // Integer angular frequencies make the distant ridgelines seamless over 360°.
        float ridge(float angle, float phase){
          return .014 + .047 * (1.-abs(sin(angle*3.+phase)))
            + .018 * (1.-abs(sin(angle*7.-phase)))
            + .007 * (1.-abs(sin(angle*19.+phase)));
        }
        void main(){
          vec3 direction=normalize(vDirection);
          float height=direction.y;
          float angle=atan(direction.z,direction.x);
          vec3 sky=mix(horizonColor,zenithColor,smoothstep(0.,.22,height));
          float softness=max(fwidth(height)*1.5,.0012);
          float farRidge=ridge(angle+.45,1.7)*1.25+.008;
          float midRidge=ridge(angle, .6);
          float nearRidge=ridge(angle-.7,2.8)*.72;
          // Match the ground's fog color and distance curve for each ridge layer.
          vec3 farColor=mix(mix(horizonColor,zenithColor,.20),horizonColor,smoothstep(fogNear,fogFar,65.));
          vec3 midColor=mix(mix(horizonColor,zenithColor,.36),horizonColor,smoothstep(fogNear,fogFar,50.));
          vec3 nearColor=mix(mix(horizonColor,zenithColor,.50),horizonColor,smoothstep(fogNear,fogFar,38.));
          sky=mix(sky,farColor,1.-smoothstep(farRidge-softness*3.,farRidge+softness*3.,height));
          sky=mix(sky,midColor,1.-smoothstep(midRidge-softness*2.,midRidge+softness*2.,height));
          sky=mix(sky,nearColor,1.-smoothstep(nearRidge-softness,nearRidge+softness,height));
          // One continuous haze field covers sky AND mountains, rather than fading
          // mountains to the sky and leaving a separate bright strip under them.
          float lowHaze=1.-smoothstep(0.,.065,max(0.,height));
          sky=mix(sky,horizonColor,lowHaze);
          gl_FragColor=vec4(sky,1.);
          #include <colorspace_fragment>
        }
      `} />
  </mesh>
}

function StudioGround({ visual }: { visual: VisualSettings }) {
  const [roughnessSource, normalSource] = useTexture(['/assets/ground/roughness.jpg', '/assets/ground/normal.jpg'])
  const textures = useMemo(() => {
    const roughness = roughnessSource.clone(), normal = normalSource.clone()
    for (const texture of [roughness, normal]) {
      texture.colorSpace = NoColorSpace
      texture.wrapS = texture.wrapT = RepeatWrapping
      texture.repeat.set(160, 160)
      texture.generateMipmaps = true
      texture.minFilter = LinearMipmapLinearFilter
      texture.magFilter = LinearFilter
      texture.anisotropy = 8
      texture.needsUpdate = true
    }
    return { roughness, normal }
  }, [roughnessSource, normalSource])
  const configureGround = useCallback((material: Material | null) => {
    if (!material || material.userData.surfaceUvPatched) return
    material.userData.surfaceUvPatched = true
    const compile = material.onBeforeCompile.bind(material)
    material.onBeforeCompile = (shader, renderer) => {
      compile(shader, renderer)
      // Drei's reflection blend uses raw UVs; honor the repeating roughness UVs
      // just like the physical roughness and normal maps, so both stay aligned.
      shader.fragmentShader = shader.fragmentShader
        .replace('texture2D( roughnessMap, vUv )', 'texture2D( roughnessMap, vRoughnessMapUv )')
        .replace('texture2D(normalMap, vUv * normalScale)', 'texture2D(normalMap, vNormalMapUv)')
        .replace('vec3 coord = new_vUv.xyz / new_vUv.w;', 'my_normal.xz *= normalScale;\nvec3 coord = new_vUv.xyz / new_vUv.w;')
    }
    material.customProgramCacheKey = () => 'nexus-ground-surface-v2'
    material.needsUpdate = true
  }, [])
  useEffect(() => () => { textures.roughness.dispose(); textures.normal.dispose() }, [textures])
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.035, 0]} receiveShadow>
    <planeGeometry args={[2000, 2000]} />
    {visual.planarReflections ? <MeshReflectorMaterial key={visual.reflectionResolution} ref={configureGround} color="#3a234d" roughness={.5} roughnessMap={textures.roughness} normalMap={textures.normal} normalScale={new Vector2(.5, .5)} metalness={.12} blur={[140, 60]} resolution={visual.reflectionResolution} mixBlur={1.15} mixStrength={1.3} depthScale={.3} minDepthThreshold={.4} maxDepthThreshold={1.5} mirror={.3} /> : <meshStandardMaterial color="#3a234d" roughness={.5} roughnessMap={textures.roughness} normalMap={textures.normal} normalScale={new Vector2(.5, .5)} metalness={.12} />}
  </mesh>
}

function VehicleModel({ vehicle, addonVisible, activeHotspot, markers, stageRef, onHotspot, hotspotMode = 'in-place', modelOffsetRef, sidebarReady, reducedMotion }: Omit<Props, 'onExit'> & { markers: MarkerRefs; sidebarReady: boolean; modelOffsetRef: RefObject<Vector3>; stageRef: RefObject<HTMLDivElement | null>; reducedMotion: boolean }) {
  const faultMode = new URLSearchParams(window.location.search).get('fault')
  const gltf = useGLTF(faultMode === 'model' ? '/assets/corrupted-demo.glb' : vehicle.modelUrl)
  const [addonUniforms] = useState(() => createAddonUniforms(addonVisible))
  const scene = useMemo(() => {
    const owned = gltf.scene.clone(true)
    owned.traverse((object: Object3D) => {
      if (!(object instanceof Mesh)) return
      object.geometry = object.geometry.clone()
      object.geometry.boundsTree = new MeshBVH(object.geometry)
      object.raycast = acceleratedRaycast
      object.castShadow = true
      object.receiveShadow = true
      const prepare = (source: MeshStandardMaterial) => {
        const material = source.clone()
        const cutout = source.transparent || Boolean(source.alphaMap)
        // The details atlas contains opaque tires/bodywork plus small alpha cutouts.
        // BLEND sorted the entire mesh as transparent; depth-writing cutouts fix see-through wheels.
        material.transparent = false
        material.opacity = 1
        material.depthWrite = true
        material.depthTest = true
        material.alphaTest = cutout ? .45 : 0
        material.alphaToCoverage = cutout
        material.side = cutout ? DoubleSide : FrontSide
        material.metalness = 0
        material.roughness = 1
        material.envMapIntensity = .45
        if ('clearcoat' in material) material.clearcoat = 0
        if ('specularIntensity' in material) material.specularIntensity = .35
        // glTF defines G as roughness. Preserve authored channel direction and remap
        // its range to matte paint/rubber instead of blindly inverting a legacy filename.
        const floor = cutout ? .78 : .65
        material.onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = mix(${floor.toFixed(2)}, 1.0, roughnessFactor);`)
        }
        material.customProgramCacheKey = () => `nexus-matte-${floor}`
        return material
      }
      object.material = Array.isArray(object.material) ? object.material.map(prepare) : prepare(object.material)
      let node: Object3D | null = object
      let isAddon = false
      while (node) { if (/^Addon[_ ]1$/i.test(node.name)) isAddon = true; node = node.parent }
      if (isAddon) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach(material => applyAddonDissolve(material, addonUniforms))
        const source = materials[0] as MeshStandardMaterial
        object.customDepthMaterial = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map: source.map, alphaTest: source.alphaTest, side: source.side })
        applyAddonDissolve(object.customDepthMaterial, addonUniforms, false)
      }
    })
    return owned
  }, [gltf.scene, addonUniforms])
  const addon = useMemo(() => scene.getObjectByName(vehicle.addons[0].nodeName) ?? scene.getObjectByName(vehicle.addons[0].nodeName.replaceAll(' ', '_')), [scene, vehicle.addons])
  const box = useMemo(() => new Box3().setFromObject(scene), [scene])
  const modelOffset = useMemo(() => {
    const center = box.getCenter(new Vector3())
    return new Vector3(-center.x, -box.min.y, -center.z)
  }, [box])
  const selectedMode = vehicle.hotspots.find(hotspot => hotspot.id === activeHotspot)?.mode ?? hotspotMode
  const sidebarOpen = !!activeHotspot && selectedMode === 'zoom-sidebar'
  const scratch = useMemo(() => ({ world: new Vector3(), ndc: new Vector3(), pointer: new Vector2(), ray: new Raycaster(), elapsed: Infinity, heights: new Map<string, number>(), morphs: new Map<string, number>() }), [])
  const { camera, size, gl, invalidate } = useThree()
  const closedOccluded = useRef<string | null>(null)
  useEffect(() => {
    modelOffsetRef.current.copy(modelOffset)
    gl.shadowMap.needsUpdate = true
    invalidate()
    if (stageRef.current) {
      stageRef.current.dataset.modelBounds = JSON.stringify({ min: box.min.toArray(), max: box.max.toArray(), offset: modelOffset.toArray() })
      stageRef.current.dataset.modelReady = 'true'
      stageRef.current.dataset.modelNodes = JSON.stringify(scene.children.map(node => ({ name: node.name, type: node.type, visible: node.visible, children: node.children.map(child => ({ name: child.name, visible: child.visible })) })))
    }
  }, [addonVisible, box, gl, invalidate, modelOffset, modelOffsetRef, scene, stageRef, vehicle.addons])

  useFrame((_, delta) => {
    scratch.elapsed += delta
    const checkOcclusion = scratch.elapsed >= .05
    if (checkOcclusion) { scratch.elapsed = 0; scene.updateWorldMatrix(true, true) }
    if (!activeHotspot) closedOccluded.current = null
    // Batch layout reads before moving any marker to avoid a forced layout per hotspot.
    for (const hotspot of vehicle.hotspots) {
      const body = markers.current.get(hotspot.id)?.querySelector<HTMLElement>('.hotspot-description > div')
      scratch.heights.set(hotspot.id, 42 + (body?.scrollHeight ?? 0))
    }
    for (const hotspot of vehicle.hotspots) {
      const element = markers.current.get(hotspot.id)
      if (!element) continue
      scratch.world.set(...hotspot.position).add(modelOffset)
      scratch.ndc.copy(scratch.world).project(camera)
      const left = (scratch.ndc.x * .5 + .5) * size.width
      const top = (-scratch.ndc.y * .5 + .5) * size.height
      const selectedSidebar = sidebarOpen && activeHotspot === hotspot.id
      const sidebar = selectedSidebar && sidebarReady
      const panelWidth = selectedSidebar ? sidebarWidth(size.width) : Math.min(360, size.width - 32)
      const before = scratch.morphs.get(hotspot.id) ?? 0
      const destination = sidebar ? 1 : 0
      const step = reducedMotion ? 1 : Math.min(delta, .05) / .65
      const progress = destination > before ? Math.min(1, before + step) : Math.max(0, before - step)
      scratch.morphs.set(hotspot.id, progress)
      const ease = progress * progress * (3 - 2 * progress)
      if (before > 0 || progress > 0 || sidebar) {
        const width = sidebarWidth(size.width)
        const height = Math.max(160, size.height - (size.width < 700 ? 214 : 134))
        element.style.transition = 'opacity .5s linear'
        element.style.left = `${left + (size.width - width - 24 - left) * ease}px`
        element.style.top = `${top + (24 - top) * ease}px`
        element.style.width = `${42 + (width - 42) * ease}px`
        element.style.height = `${42 + (height - 42) * ease}px`
        element.style.transform = `translate(${-21 * (1 - ease)}px, ${-21 * (1 - ease)}px)`
        element.style.backgroundColor = '#fff'
      } else {
        element.style.left = `${left}px`; element.style.top = `${top}px`
        element.style.width = ''; element.style.height = ''; element.style.transform = ''
        element.style.transition = ''; element.style.backgroundColor = ''
      }
      element.dataset.morphProgress = String(progress)
      if (progress !== destination) invalidate()
      element.style.setProperty('--hotspot-width', `${panelWidth}px`)
      element.style.setProperty('--sidebar-height', `${Math.max(160, size.height - (size.width < 700 ? 214 : 134))}px`)
      element.style.setProperty('--hotspot-open-height', `${scratch.heights.get(hotspot.id)}px`)
      if (!checkOcclusion) continue
      scratch.pointer.set(scratch.ndc.x, scratch.ndc.y)
      scratch.ray.setFromCamera(scratch.pointer, camera)
      const distance = camera.position.distanceTo(scratch.world)
      const firstHit = scratch.ray.intersectObject(scene, true).find(hit => {
        let node: Object3D | null = hit.object
        while (node) { if (!node.visible) return false; node = node.parent }
        return true
      })
      const occluded = Boolean(firstHit && firstHit.distance < distance - .14)
      const inside = scratch.ndc.z > -1 && scratch.ndc.z < 1 && Math.abs(scratch.ndc.x) <= 1 && Math.abs(scratch.ndc.y) <= 1
      const transitioning = stageRef.current?.dataset.cameraTransitioning === 'true'
      const visible = selectedSidebar || (inside && !occluded && (!sidebarOpen || activeHotspot === hotspot.id))
      element.style.opacity = visible ? '1' : '0'
      element.style.pointerEvents = visible ? 'auto' : 'none'
      element.inert = !visible
      element.setAttribute('aria-hidden', String(!visible))
      element.dataset.occluded = String(occluded)
      element.dataset.visible = String(visible)
      if ((!inside || occluded) && !transitioning && activeHotspot === hotspot.id && closedOccluded.current !== hotspot.id) {
        closedOccluded.current = hotspot.id
        onHotspot(null)
      }
    }
  })
  useEffect(() => () => {
    scene.traverse(object => {
      if (!(object instanceof Mesh)) return
      object.customDepthMaterial?.dispose()
      object.geometry.boundsTree = undefined
      object.geometry.dispose()
      ;(Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose())
    })
  }, [scene])
  return <group position={modelOffset}><primitive object={scene} /><AddonTransition addon={addon} visible={addonVisible} uniforms={addonUniforms} offset={modelOffset} reducedMotion={reducedMotion} stageRef={stageRef} /></group>
}

function ShadowQuality({ resolution }: { resolution: number }) {
  const { scene, gl, invalidate } = useThree()
  useEffect(() => {
    scene.traverse(object => {
      const light = object as Object3D & { shadow?: { mapSize: Vector2; map: { dispose: () => void } | null } }
      if (!light.shadow) return
      light.shadow.map?.dispose(); light.shadow.map = null
      light.shadow.mapSize.set(resolution, resolution)
    })
    gl.shadowMap.needsUpdate = true
    invalidate()
  }, [resolution, scene, gl, invalidate])
  return null
}

export function ModelStage(props: Props) {
  const visual = props.visual ?? visualPresets[props.qualityTier ?? 'standard']
  const { active: loadingAssets, progress: assetProgress } = useProgress()
  useEffect(() => { props.onProgress(loadingAssets ? Math.min(90, assetProgress * .9) : 90) }, [loadingAssets, assetProgress, props.onProgress])
  const [contextLost, setContextLost] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const modelOffsetRef = useRef(new Vector3())
  const activeDefinition = props.vehicle.hotspots.find(hotspot => hotspot.id === props.activeHotspot)
  const activeMode = activeDefinition?.mode ?? props.hotspotMode ?? 'in-place'
  const sidebarOpen = !!activeDefinition && activeMode === 'zoom-sidebar'
  const [sidebarReadyId, setSidebarReadyId] = useState<string | null>(null)
  const sidebarReady = sidebarOpen && sidebarReadyId === props.activeHotspot
  const [sidebarTransitionId, setSidebarTransitionId] = useState<string | null>(null)
  useEffect(() => {
    if (sidebarReady) { setSidebarTransitionId(props.activeHotspot); return }
    const timer = window.setTimeout(() => setSidebarTransitionId(null), 650)
    return () => clearTimeout(timer)
  }, [sidebarReady, props.activeHotspot])
  const markers = useRef(new Map<string, HTMLDivElement>())
  const stageRef = useRef<HTMLDivElement>(null)
  const injectedWebglFault = useRef(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!props.activeHotspot) return
    const pointers = new Map<number, { x: number; y: number }>()
    let gestureMoved = false
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.vehicle-hotspot')) return
      if (pointers.size) gestureMoved = true
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    }
    const move = (event: PointerEvent) => {
      const start = pointers.get(event.pointerId)
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) gestureMoved = true
    }
    const release = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return
      const start = pointers.get(event.pointerId)!
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) gestureMoved = true
      pointers.delete(event.pointerId)
      if (!pointers.size) {
        if (!gestureMoved && event.type === 'pointerup') props.onHotspot(null)
        gestureMoved = false
      }
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') props.onHotspot(null) }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', release)
    document.addEventListener('pointercancel', release)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss); document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', release); document.removeEventListener('pointercancel', release)
      document.removeEventListener('keydown', escape)
    }
  }, [props.activeHotspot, props.onHotspot])

  if (contextLost) return <section className="model-failure" role="alert"><p className="eyebrow">3D MODULE INTERRUPTED</p><h2>The vehicle view needs to restart.</h2><p>Your selected configuration is preserved. Retry the renderer or return to the hub.</p><div><button className="primary-cta" onClick={() => { props.onReadyChange(false); props.onProgress(90); setContextLost(false) }}>Retry 3D view <span>↻</span></button><button className="recovery-back" onClick={props.onExit}>Return to hub</button></div></section>

  return <div className="model-stage" ref={stageRef} data-hotspot-open={String(Boolean(props.activeHotspot))}>
    <Canvas frameloop="demand" shadows dpr={[1, visual.maxDpr]} gl={{ antialias: true, powerPreference: 'high-performance' }} onCreated={({ gl, camera }) => {
      props.onReadyChange(false)
      const perspective = camera as PerspectiveCamera
      gl.shadowMap.autoUpdate = false; gl.shadowMap.needsUpdate = true
      camera.position.copy(DEFAULT_POSITION); camera.lookAt(DEFAULT_TARGET)
      perspective.fov = 38; perspective.near = .1; perspective.far = 1200; perspective.updateProjectionMatrix()
      gl.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); setContextLost(true); props.onReadyChange(true) })
      if (new URLSearchParams(window.location.search).get('fault') === 'webgl' && !injectedWebglFault.current) { injectedWebglFault.current = true; window.setTimeout(() => gl.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true })), 250) }
    }}>
      <color attach="background" args={['#64358d']} />
      <fog attach="fog" args={[STUDIO_HORIZON, STUDIO_FOG_NEAR, STUDIO_FOG_FAR]} />
      <StudioSky />
      <ambientLight intensity={.6} />
      <hemisphereLight args={['#edd5ff', '#49314d', 1.6]} />
      <directionalLight position={[7, 10, 9]} intensity={2.5} color="#fff4ed" castShadow shadow-mapSize-width={visual.shadowResolution} shadow-mapSize-height={visual.shadowResolution} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={9} shadow-camera-bottom={-8} shadow-bias={-.0004} />
      <directionalLight position={[-6, 6, 5]} intensity={1.2} color="#d7a4ef" />
      <directionalLight position={[-5, 8, -9]} intensity={1.8} color="#f4d8ff" />
      <pointLight position={[-1.05, 1.25, 3.15]} intensity={5} distance={4} decay={2} color="#ff36dc" />
      <pointLight position={[1.05, 1.25, 3.15]} intensity={5} distance={4} decay={2} color="#ff36dc" />
      <Suspense fallback={null}>
        <VehicleModel {...props} reducedMotion={reducedMotion} markers={markers} modelOffsetRef={modelOffsetRef} sidebarReady={sidebarReady} stageRef={stageRef} />
        <StudioGround visual={visual} />
        <ContactShadows key={String(props.addonVisible)} position={[0, .005, 0]} opacity={.48} scale={16} blur={2.8} far={7} color="#30143e" frames={1} resolution={256} />
        <SceneReadiness onReady={props.onReadyChange} onProgress={props.onProgress} />
      </Suspense>
      <HotspotCamera onFocusReady={setSidebarReadyId} vehicle={props.vehicle} activeHotspot={props.activeHotspot} mode={props.hotspotMode ?? 'in-place'} modelOffset={modelOffsetRef} statusRef={stageRef} reducedMotion={reducedMotion} />
      <ShadowQuality resolution={visual.shadowResolution} />
      <CameraMotionBlur visual={visual} showPerformanceStats={props.showPerformanceStats ?? false} reducedMotion={reducedMotion} statusRef={stageRef} />
    </Canvas>
    {props.vehicle.hotspots.map(hotspot => {
      const open = props.activeHotspot === hotspot.id
      const sidebar = open && sidebarReady
      const panelId = `hotspot-${hotspot.id}`
      return <div key={hotspot.id} ref={element => { if (element) markers.current.set(hotspot.id, element); else markers.current.delete(hotspot.id) }} className={`vehicle-hotspot ${open && (!sidebarOpen || sidebarReady) ? 'is-open' : ''} ${sidebar ? 'is-sidebar' : ''} ${sidebarTransitionId === hotspot.id ? 'is-morphing' : ''}`} data-hotspot-id={hotspot.id}>
        <button className="hotspot-header" aria-label={`${open ? 'Close' : 'Open'} hotspot ${hotspot.label}`} aria-expanded={open} aria-controls={panelId} onClick={() => props.onHotspot(open ? null : hotspot.id)}><span className="accordion-icon" aria-hidden="true" /><span className="hotspot-title-text">{hotspot.label}</span></button>
        <div id={panelId} role={sidebar ? 'region' : undefined} aria-label={sidebar ? `${hotspot.label} details` : undefined} className="hotspot-description" aria-hidden={!open || (sidebarOpen && !sidebarReady)} inert={!open || (sidebarOpen && !sidebarReady)}><div tabIndex={sidebar ? 0 : undefined}><p>{hotspot.description}</p>{sidebar && hotspot.details?.map(section => <section className="hotspot-detail-section" key={section.heading}><h3>{section.heading}</h3><p>{section.text}</p></section>)}<small>Demonstration content</small></div></div>
      </div>
    })}
  </div>
}

useGLTF.preload('/assets/jltv-runtime.glb')

useTexture.preload(['/assets/ground/roughness.jpg', '/assets/ground/normal.jpg'])
