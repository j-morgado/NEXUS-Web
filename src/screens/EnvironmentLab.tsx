import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { BackSide, Box3, Color, Group, Mesh, ShaderMaterial, Vector3 } from 'three'
import { cloneEnvironmentPresets, environmentOrder, environmentPresets, serializeEnvironmentConfig, type EnvironmentConfig, type EnvironmentKind } from '../environment/environmentConfig'

const cameraPositions: Record<EnvironmentKind, [number, number, number]> = {
  land: [7.1, 2.8, 9.2],
  sea: [9.5, 5.3, 10.5],
  air: [9.2, 4.8, 11.5],
}

function GradientSky({ config }: { config: EnvironmentConfig }) {
  return <mesh renderOrder={-10}>
    <sphereGeometry args={[250, 24, 12]} />
    <shaderMaterial key={`${config.horizon}-${config.zenith}`} side={BackSide} depthWrite={false} toneMapped={false} uniforms={{ horizon: { value: new Color(config.horizon) }, zenith: { value: new Color(config.zenith) } }} vertexShader={`varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`varying vec3 vDirection; uniform vec3 horizon; uniform vec3 zenith; void main(){float h=normalize(vDirection).y; vec3 c=mix(horizon,zenith,smoothstep(-.08,.58,h)); gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
}`} />
  </mesh>
}

function SceneLights({ config }: { config: EnvironmentConfig }) {
  return <>
    <ambientLight intensity={0.34 + config.fillLight * 0.17} />
    <hemisphereLight args={['#f3dcff', '#281638', config.fillLight]} />
    <directionalLight position={[7, 11, 8]} intensity={config.keyLight} color="#fff3ed" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-bias={-.0004} />
    <directionalLight position={[-7, 5, -6]} intensity={config.fillLight * .72} color={config.accent} />
  </>
}

function LandVehicle() {
  const gltf = useGLTF('/assets/jltv-runtime.glb')
  const { scene, offset } = useMemo(() => {
    const owned = gltf.scene.clone(true)
    owned.traverse(object => {
      if (!(object instanceof Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
    })
    const bounds = new Box3().setFromObject(owned)
    const center = bounds.getCenter(new Vector3())
    return { scene: owned, offset: new Vector3(-center.x, -bounds.min.y, -center.z) }
  }, [gltf.scene])
  return <group position={offset}><primitive object={scene} /></group>
}

function LandScene({ config }: { config: EnvironmentConfig }) {
  const ridges = useMemo(() => Array.from({ length: 17 }, (_, index) => ({
    x: -48 + index * 6,
    z: -26 - (index % 3) * 4,
    height: 7 + ((index * 7) % 9) * config.detail,
    width: 8 + ((index * 11) % 7),
  })), [config.detail])
  return <>
    <group position={[0, 0, -2]}>{ridges.map((ridge, index) => <mesh key={index} position={[ridge.x, ridge.height * .32 - .15, ridge.z]} scale={[ridge.width, ridge.height, 5]} rotation={[0, 0, index % 2 ? -.09 : .08]}>
      <coneGeometry args={[1, 1, 4]} />
      <meshStandardMaterial color={index % 3 === 0 ? '#5a327e' : '#704496'} roughness={1} />
    </mesh>)}</group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[180, 180, 1, 1]} />
      <meshStandardMaterial color="#3a234d" roughness={.7} metalness={.08} />
    </mesh>
    <LandVehicle />
  </>
}

function OceanSurface({ config }: { config: EnvironmentConfig }) {
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    motion: { value: config.motion },
    detail: { value: config.detail },
    deep: { value: new Color('#101943') },
    crest: { value: new Color(config.accent) },
  }), [config.accent, config.detail, config.motion])
  useFrame(state => { if (material.current) material.current.uniforms.time.value = state.clock.elapsedTime })
  return <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[180, 180, 96, 96]} />
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={`uniform float time,motion,detail; varying float vWave; varying vec2 vUv; void main(){vUv=uv; vec3 p=position; float speed=.45+motion*1.25; float amp=.12+motion*.38; float w=sin(p.x*.22+time*speed)*.52+sin(p.y*.31-time*speed*.73)*.31+sin((p.x+p.y)*.13+time*.43)*.17; p.z+=w*amp*(.7+detail*.3); vWave=w; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`} fragmentShader={`uniform vec3 deep,crest; uniform float time,detail; varying float vWave; varying vec2 vUv; void main(){float shimmer=.5+.5*sin((vUv.x+vUv.y)*210.+time*1.7); float foam=smoothstep(.48,.9,vWave)*(.4+.6*shimmer)*detail; float depth=.16+smoothstep(-.75,.85,vWave)*.32; vec3 color=mix(deep,crest,depth+foam*.42); gl_FragColor=vec4(color,1.);
#include <colorspace_fragment>
}`} />
  </mesh>
}

function waveSample(time: number, motion: number) {
  const speed = .45 + motion * 1.25
  return (Math.sin(time * speed) * .52 + Math.sin(-time * speed * .73) * .31 + Math.sin(time * .43) * .17) * (.12 + motion * .38)
}

function ContactFoam({ config }: { config: EnvironmentConfig }) {
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ time: { value: 0 }, accent: { value: new Color('#f5ecff') }, detail: { value: config.detail } }), [config.detail])
  useFrame(state => { if (material.current) material.current.uniforms.time.value = state.clock.elapsedTime })
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .055, .12]} renderOrder={3}>
    <planeGeometry args={[6.8, 3.1]} />
    <shaderMaterial ref={material} uniforms={uniforms} transparent depthWrite={false} vertexShader={`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`varying vec2 vUv; uniform float time,detail; uniform vec3 accent; void main(){vec2 p=(vUv-.5)*vec2(2.,3.6); float d=abs(length(p)-1.); float pulse=.68+.32*sin(atan(p.y,p.x)*12.-time*2.4); float broken=smoothstep(.58,.92,pulse+sin((p.x+p.y)*18.+time)*.16); float alpha=(1.-smoothstep(.035,.16,d))*broken*(.45+detail*.5); gl_FragColor=vec4(accent,alpha);}`} />
  </mesh>
}

function VesselStandIn({ config }: { config: EnvironmentConfig }) {
  const vessel = useRef<Group>(null)
  const foam = useRef<Group>(null)
  useFrame(state => {
    const time = state.clock.elapsedTime
    const sample = waveSample(time, config.motion)
    if (vessel.current) {
      vessel.current.position.y = .43 + sample
      vessel.current.rotation.z = Math.sin(time * (.42 + config.motion)) * (.025 + config.motion * .055)
      vessel.current.rotation.x = Math.sin(time * (.31 + config.motion * .45) + .7) * (.018 + config.motion * .035)
    }
    if (foam.current) foam.current.position.y = sample * .16
  })
  return <>
    <group ref={foam}><ContactFoam config={config} /></group>
    <group ref={vessel}>
      <mesh position={[0, .18, 0]} rotation={[0, 0, Math.PI / 2]} scale={[.72, 1.35, 1.05]} castShadow><capsuleGeometry args={[.62, 3.5, 5, 12]} /><meshStandardMaterial color="#272136" roughness={.42} metalness={.45} /></mesh>
      <mesh position={[-.35, .8, 0]} scale={[1.42, .42, .72]} castShadow><boxGeometry /><meshStandardMaterial color="#d8d0df" roughness={.55} /></mesh>
      <mesh position={[.1, 1.2, 0]} scale={[.74, .32, .58]} castShadow><boxGeometry /><meshStandardMaterial color="#4b3b69" roughness={.45} /></mesh>
      <mesh position={[.25, 1.82, 0]} scale={[.06, .7, .06]} castShadow><cylinderGeometry args={[1, 1, 1, 8]} /><meshStandardMaterial color={config.accent} /></mesh>
      <mesh position={[0, .83, -.73]} scale={[1.55, .08, .08]}><boxGeometry /><meshStandardMaterial color={config.accent} emissive={config.accent} emissiveIntensity={.5} /></mesh>
    </group>
  </>
}

function SeaScene({ config }: { config: EnvironmentConfig }) {
  return <><OceanSurface config={config} /><VesselStandIn config={config} /></>
}

function CloudField({ config }: { config: EnvironmentConfig }) {
  const group = useRef<Group>(null)
  const clouds = useMemo(() => Array.from({ length: 12 }, (_, index) => ({
    x: -20 + (index * 7.7) % 42,
    y: -.5 + (index % 4) * 1.8,
    z: -29 + (index % 4) * 3.5,
    scale: .7 + (index % 3) * .26,
  })), [])
  const visible = Math.max(5, Math.round(5 + config.detail * 7))
  useFrame((_, delta) => {
    if (!group.current) return
    group.current.position.x += delta * (.16 + config.motion * .55)
    if (group.current.position.x > 7) group.current.position.x = -7
  })
  return <group ref={group}>{clouds.slice(0, visible).map((cloud, index) => <group key={index} position={[cloud.x, cloud.y, cloud.z]} scale={cloud.scale}>
    {[[0, 0, 0], [1.05, .14, .12], [-1.05, .08, .2], [.3, .45, -.05], [-.45, .4, 0]].map((position, puff) => <mesh key={puff} position={position as [number, number, number]} scale={[1.5, .56 + puff * .035, .78]}>
      <sphereGeometry args={[1, 10, 7]} />
      <meshStandardMaterial color={index % 2 ? '#e8dcf4' : '#f6effb'} transparent opacity={.78 - index * .018} roughness={1} depthWrite={false} />
    </mesh>)}
  </group>)}</group>
}

function AircraftStandIn({ config }: { config: EnvironmentConfig }) {
  const aircraft = useRef<Group>(null)
  useFrame(state => {
    if (!aircraft.current) return
    const time = state.clock.elapsedTime
    aircraft.current.position.y = 1.25 + Math.sin(time * (.35 + config.motion)) * .16
    aircraft.current.rotation.z = -.05 + Math.sin(time * .3) * .018
  })
  return <group ref={aircraft} rotation={[0, -.28, 0]}>
    <mesh rotation={[0, 0, Math.PI / 2]} castShadow><capsuleGeometry args={[.42, 4.2, 6, 16]} /><meshStandardMaterial color="#ded8e7" metalness={.58} roughness={.32} /></mesh>
    <mesh scale={[.9, .1, 3.0]} position={[-.15, 0, .1]} castShadow><boxGeometry /><meshStandardMaterial color="#44345f" metalness={.34} roughness={.4} /></mesh>
    <mesh scale={[.72, .7, .08]} position={[-2.05, .45, 0]} rotation={[0, 0, -.2]}><boxGeometry /><meshStandardMaterial color={config.accent} /></mesh>
    <mesh scale={[.75, .07, 1.0]} position={[-1.85, .06, 0]}><boxGeometry /><meshStandardMaterial color="#5d477e" /></mesh>
    <mesh scale={[.36, .14, .36]} position={[1.85, .08, 0]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color={config.accent} emissive={config.accent} emissiveIntensity={.7} /></mesh>
  </group>
}

function AirScene({ config }: { config: EnvironmentConfig }) {
  return <><CloudField config={config} /><AircraftStandIn config={config} /></>
}

function EnvironmentCanvas({ kind, config, onReady }: { kind: EnvironmentKind; config: EnvironmentConfig; onReady: () => void }) {
  const fogNear = 18 + config.fog * 20
  const fogFar = 62 + config.fog * 80
  return <Canvas key={kind} shadows={kind !== 'air'} dpr={[1, 1.25]} camera={{ position: cameraPositions[kind], fov: 38, near: .1, far: 600 }} gl={{ antialias: true, powerPreference: 'high-performance' }} onCreated={onReady}>
    <color attach="background" args={[config.horizon]} />
    <fog attach="fog" args={[config.horizon, fogNear, fogFar]} />
    <GradientSky config={config} />
    <SceneLights config={config} />
    <Suspense fallback={null}>
      {kind === 'land' && <LandScene config={config} />}
      {kind === 'sea' && <SeaScene config={config} />}
      {kind === 'air' && <AirScene config={config} />}
    </Suspense>
    <OrbitControls makeDefault enablePan={false} minDistance={6} maxDistance={18} minPolarAngle={Math.PI * .2} maxPolarAngle={Math.PI * .48} target={[0, kind === 'air' ? .7 : 1.2, 0]} />
  </Canvas>
}

function RangeControl({ id, label, value, min = 0, max = 4, step = .05, onChange }: { id: string; label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }) {
  return <label htmlFor={id}>{label}<output>{value.toFixed(2)}</output><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></label>
}

export function EnvironmentLab() {
  const [kind, setKind] = useState<EnvironmentKind>('land')
  const [configs, setConfigs] = useState(cloneEnvironmentPresets)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const config = configs[kind]
  const patch = (values: Partial<EnvironmentConfig>) => setConfigs(current => ({ ...current, [kind]: { ...current[kind], ...values } }))
  const select = (next: EnvironmentKind) => {
    if (next === kind) return
    setSceneReady(false)
    setCopyStatus('')
    setKind(next)
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(serializeEnvironmentConfig(kind, config)); setCopyStatus('Configuration copied') }
    catch { setCopyStatus('Clipboard unavailable — configuration is shown below'); setCreatorOpen(true) }
  }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'e') { event.preventDefault(); setCreatorOpen(value => !value) }
      if (event.key === 'Escape') setCreatorOpen(false)
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])

  return <main id="main-content" className={`environment-lab environment-${kind}`} data-environment={kind} data-scene-ready={sceneReady} style={{ '--environment-accent': config.accent } as CSSProperties}>
    <div className="environment-canvas" aria-hidden="true"><EnvironmentCanvas kind={kind} config={config} onReady={() => setSceneReady(true)} /></div>
    <header className="environment-lab-header">
      <p className="eyebrow">NEXUS · ENVIRONMENT EXPLORATION</p>
      <h1>{config.label}</h1>
      <p>{config.description}</p>
    </header>
    <img className="environment-logo" src="/assets/reference/leidos-logo-light.svg" alt="Leidos" />
    <nav className="environment-switcher" aria-label="Environment preview">
      {environmentOrder.map(item => <button key={item} aria-pressed={kind === item} onClick={() => select(item)}><small>0{environmentOrder.indexOf(item) + 1}</small>{environmentPresets[item].label}</button>)}
    </nav>
    <aside className="environment-status" aria-live="polite">
      <span>{config.eyebrow}</span>
      <span>{sceneReady ? 'SCENE READY' : 'PREPARING SCENE'}</span>
      <span>STANDARD · DPR 1.25</span>
      {kind !== 'land' && <strong>CONCEPT STAND-IN · FINAL ART PENDING</strong>}
    </aside>
    <button className="creator-toggle" aria-expanded={creatorOpen} aria-controls="environment-creator-tools" onClick={() => setCreatorOpen(value => !value)}>Creator tools <span>{creatorOpen ? '×' : '+'}</span></button>
    <aside id="environment-creator-tools" className={`environment-creator ${creatorOpen ? 'is-open' : ''}`} aria-hidden={!creatorOpen} inert={!creatorOpen}>
      <header><p>AUTHORING ONLY</p><h2>Scene direction</h2><small>Not included in the visitor experience</small></header>
      <RangeControl id="creator-key" label="Key light" value={config.keyLight} onChange={value => patch({ keyLight: value })} />
      <RangeControl id="creator-fill" label="Fill light" value={config.fillLight} onChange={value => patch({ fillLight: value })} />
      <RangeControl id="creator-fog" label="Atmospheric depth" value={config.fog} max={1} step={.01} onChange={value => patch({ fog: value })} />
      <label htmlFor="creator-accent">Accent color<input id="creator-accent" type="color" value={config.accent} onChange={event => patch({ accent: event.target.value })} /></label>
      <RangeControl id="creator-motion" label={kind === 'land' ? 'Ambient motion' : kind === 'sea' ? 'Wave energy' : 'Cloud drift'} value={config.motion} max={1} step={.01} onChange={value => patch({ motion: value })} />
      <RangeControl id="creator-detail" label={kind === 'land' ? 'Ridge variation' : kind === 'sea' ? 'Surface detail' : 'Cloud density'} value={config.detail} max={1} step={.01} onChange={value => patch({ detail: value })} />
      <div className="creator-actions"><button onClick={() => patch(environmentPresets[kind])}>Reset {config.label}</button><button onClick={() => void copy()}>Copy JSON</button></div>
      {copyStatus && <p className="creator-copy-status" role="status">{copyStatus}</p>}
      {copyStatus.startsWith('Clipboard unavailable') && <pre>{serializeEnvironmentConfig(kind, config)}</pre>}
    </aside>
  </main>
}

useGLTF.preload('/assets/jltv-runtime.glb')
