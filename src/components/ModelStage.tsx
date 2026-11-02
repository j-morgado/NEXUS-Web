import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, useState, type ElementRef, type RefObject } from 'react'
import type { Group, Object3D, PerspectiveCamera } from 'three'
import { Box3, Raycaster, Vector2, Vector3 } from 'three'
import type { Vehicle } from '../domain/schemas'

type Props = { vehicle: Vehicle; addonVisible: boolean; hotspotOpen: boolean; qualityTier?: 'standard' | 'high'; onHotspot: () => void; onExit: () => void }
type MarkerRef = RefObject<HTMLButtonElement | null>
type OrbitHandle = ElementRef<typeof OrbitControls>

const DEFAULT_POSITION = new Vector3(7.8, 5.4, 8.8)
const DEFAULT_TARGET = new Vector3(0, 2, 0)

function CameraController({ vehicle, hotspotOpen, statusRef, reducedMotion }: { vehicle: Vehicle; hotspotOpen: boolean; statusRef: RefObject<HTMLDivElement | null>; reducedMotion: boolean }) {
  const { camera } = useThree()
  const controls = useRef<OrbitHandle>(null)
  const previousOpen = useRef(false)
  const savedPosition = useRef(DEFAULT_POSITION.clone())
  const savedTarget = useRef(DEFAULT_TARGET.clone())
  const goalPosition = useRef(DEFAULT_POSITION.clone())
  const goalTarget = useRef(DEFAULT_TARGET.clone())
  const lastPosition = useRef(DEFAULT_POSITION.clone())
  const lastTarget = useRef(DEFAULT_TARGET.clone())
  const transitioning = useRef(false)

  useEffect(() => {
    if (hotspotOpen && !previousOpen.current) {
      savedPosition.current.copy(camera.position)
      if (controls.current) savedTarget.current.copy(controls.current.target)
      goalPosition.current.set(...vehicle.hotspots[0].camera.position)
      goalTarget.current.set(...vehicle.hotspots[0].camera.target)
      transitioning.current = !reducedMotion
      if (reducedMotion) {
        camera.position.copy(goalPosition.current)
        controls.current?.target.copy(goalTarget.current)
        controls.current?.update()
      }
    } else if (!hotspotOpen && previousOpen.current) {
      camera.position.copy(lastPosition.current)
      if (controls.current) controls.current.target.copy(lastTarget.current)
      goalPosition.current.copy(savedPosition.current)
      goalTarget.current.copy(savedTarget.current)
      transitioning.current = !reducedMotion
      if (reducedMotion) {
        camera.position.copy(goalPosition.current)
        controls.current?.target.copy(goalTarget.current)
        controls.current?.update()
      }
    }
    previousOpen.current = hotspotOpen
  }, [camera, hotspotOpen, reducedMotion, vehicle.hotspots])

  useFrame((_, delta) => {
    if (statusRef.current && controls.current) {
      statusRef.current.dataset.cameraPosition = camera.position.toArray().map((value) => value.toFixed(3)).join(',')
      statusRef.current.dataset.cameraTarget = controls.current.target.toArray().map((value) => value.toFixed(3)).join(',')
      statusRef.current.dataset.cameraTransitioning = transitioning.current ? 'true' : 'false'
      statusRef.current.dataset.cameraPreviousOpen = previousOpen.current ? 'true' : 'false'
    }
    if (transitioning.current && controls.current) {
      const blend = 1 - Math.exp(-delta * 5.2)
      camera.position.lerp(goalPosition.current, blend)
      controls.current.target.lerp(goalTarget.current, blend)
      controls.current.update()
      if (camera.position.distanceTo(goalPosition.current) < 0.012 && controls.current.target.distanceTo(goalTarget.current) < 0.012) {
        camera.position.copy(goalPosition.current)
        controls.current.target.copy(goalTarget.current)
        controls.current.update()
        transitioning.current = false
      }
    }
    if (controls.current) {
      lastPosition.current.copy(camera.position)
      lastTarget.current.copy(controls.current.target)
    }
  })

  return <OrbitControls
    ref={controls}
    enablePan={false}
    minDistance={5.5}
    maxDistance={16}
    minPolarAngle={0.55}
    maxPolarAngle={1.45}
    target={[0, 2, 0]}
    onStart={() => { transitioning.current = false }}
  />
}

function VehicleModel({ vehicle, addonVisible, hotspotOpen, markerRef }: Omit<Props, 'onExit' | 'onHotspot'> & { markerRef: MarkerRef }) {
  const faultMode = new URLSearchParams(window.location.search).get('fault')
  const modelUrl = faultMode === 'model' ? '/assets/corrupted-demo.glb' : vehicle.modelUrl
  const gltf = useGLTF(modelUrl)
  const scene = useMemo(() => {
    const owned = gltf.scene.clone(true)
    owned.traverse((object: Object3D) => {
      if ('geometry' in object) {
        const mesh = object as Object3D & { geometry?: { clone: () => unknown } }
        if (mesh.geometry) mesh.geometry = mesh.geometry.clone() as typeof mesh.geometry
      }
      if ('material' in object) {
        const mesh = object as Object3D & { material?: { clone: () => unknown } | { clone: () => unknown }[] }
        if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((item) => item.clone()) as typeof mesh.material
        else if (mesh.material) mesh.material = mesh.material.clone() as typeof mesh.material
      }
    })
    return owned
  }, [gltf.scene])
  const box = useMemo(() => new Box3().setFromObject(scene), [scene])
  const center = useMemo(() => box.getCenter(new Vector3()), [box])
  const modelOffset = useMemo(() => new Vector3(-center.x, -box.min.y, -center.z), [box.min.y, center])
  const markerWorld = useMemo(() => new Vector3(), [])
  const markerNdc = useMemo(() => new Vector3(), [])
  const raycaster = useMemo(() => new Raycaster(), [])
  const pointer = useMemo(() => new Vector2(), [])
  const { camera, scene: rootScene, size } = useThree()

  useEffect(() => {
    const addon = scene.getObjectByName(vehicle.addons[0].nodeName) ?? scene.children.find((item) => item.name.toLowerCase().includes('addon'))
    if (addon) addon.visible = addonVisible
  }, [addonVisible, scene, vehicle.addons])

  useFrame(() => {
    const element = markerRef.current
    if (!element) return
    markerWorld.set(...vehicle.hotspots[0].position).add(modelOffset)
    markerNdc.copy(markerWorld).project(camera)
    pointer.set(markerNdc.x, markerNdc.y)
    raycaster.setFromCamera(pointer, camera)
    const markerDistance = camera.position.distanceTo(markerWorld)
    const firstHit = raycaster.intersectObject(rootScene, true)[0]
    const occluded = Boolean(firstHit && firstHit.distance < markerDistance - 0.32)
    const inside = markerNdc.z > -1 && markerNdc.z < 1 && Math.abs(markerNdc.x) <= 1.03 && Math.abs(markerNdc.y) <= 1.03
    const visible = inside && !occluded && !hotspotOpen
    element.style.left = `${(markerNdc.x * 0.5 + 0.5) * size.width}px`
    element.style.top = `${(-markerNdc.y * 0.5 + 0.5) * size.height}px`
    element.style.opacity = visible ? '1' : '0'
    element.style.pointerEvents = visible ? 'auto' : 'none'
  })

  useEffect(() => () => {
    scene.traverse((object: Object3D) => {
      if ('geometry' in object) (object as Object3D & { geometry?: { dispose: () => void } }).geometry?.dispose()
      if ('material' in object) {
        const material = (object as Object3D & { material?: { dispose: () => void } | { dispose: () => void }[] }).material
        ;(Array.isArray(material) ? material : material ? [material] : []).forEach((item) => item.dispose())
      }
    })
  }, [scene])

  return <group position={modelOffset}>
    <primitive object={scene as Group} />
  </group>
}

export function ModelStage(props: Props) {
  const [contextLost, setContextLost] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const pointerStart = useRef<[number, number] | null>(null)
  const markerRef = useRef<HTMLButtonElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const injectedWebglFault = useRef(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  if (contextLost) return <section className="model-failure" role="alert">
    <p className="eyebrow">3D MODULE INTERRUPTED</p>
    <h2>The vehicle view needs to restart.</h2>
    <p>Your selected configuration is preserved. Retry the renderer or return to the platform selector.</p>
    <div><button className="primary-cta" onClick={() => setContextLost(false)}>Retry 3D view <span>↻</span></button><button className="recovery-back" onClick={props.onExit}>Return to platforms</button></div>
  </section>

  return <div className="model-stage" ref={stageRef} data-hotspot-open={props.hotspotOpen ? 'true' : 'false'}>
    <Canvas
      dpr={props.qualityTier === 'high' ? [1.25, 2] : [1, 1.6]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, camera }) => {
        const perspective = camera as PerspectiveCamera
        camera.position.copy(DEFAULT_POSITION)
        camera.lookAt(DEFAULT_TARGET)
        perspective.fov = 38
        perspective.near = 0.1
        perspective.far = 100
        perspective.updateProjectionMatrix()
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault()
          setContextLost(true)
        })
        if (new URLSearchParams(window.location.search).get('fault') === 'webgl' && !injectedWebglFault.current) {
          injectedWebglFault.current = true
          window.setTimeout(() => gl.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true })), 250)
        }
      }}
    >
      <color attach="background" args={['#0b0d14']} />
      <fog attach="fog" args={['#0b0d14', 14, 28]} />
      <ambientLight intensity={0.62} />
      <hemisphereLight args={['#c7bdff', '#17101f', 1.2]} />
      <directionalLight position={[7, 10, 9]} intensity={3.1} castShadow />
      <directionalLight position={[-6, 6, 5]} intensity={1.65} color="#b9aaff" />
      <directionalLight position={[-5, 8, -9]} intensity={2.25} color="#f2dcff" />
      <Suspense fallback={null}>
        <VehicleModel vehicle={props.vehicle} addonVisible={props.addonVisible} hotspotOpen={props.hotspotOpen} markerRef={markerRef} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.04]} receiveShadow>
          <circleGeometry args={[12, 96]} />
          <meshStandardMaterial color="#10141d" roughness={0.75} metalness={0.2} />
        </mesh>
      </Suspense>
      <CameraController vehicle={props.vehicle} hotspotOpen={props.hotspotOpen} statusRef={stageRef} reducedMotion={reducedMotion} />
    </Canvas>
    <button
      ref={markerRef}
      className="hotspot-marker model-marker"
      aria-label={`Open ${props.vehicle.hotspots[0].label}`}
      onPointerDown={(event) => { pointerStart.current = [event.clientX, event.clientY] }}
      onPointerUp={(event) => {
        if (!pointerStart.current) return
        const moved = Math.hypot(event.clientX - pointerStart.current[0], event.clientY - pointerStart.current[1])
        pointerStart.current = null
        if (moved < 8) props.onHotspot()
      }}
    ><span>01</span></button>
  </div>
}

useGLTF.preload('/assets/jltv-runtime.glb')
