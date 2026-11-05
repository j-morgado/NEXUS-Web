import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, MeshReflectorMaterial, OrbitControls, useGLTF, useTexture } from '@react-three/drei'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { BackSide, Box3, Color, DoubleSide, FrontSide, Group, LinearFilter, LinearMipmapLinearFilter, type Material, Mesh, MeshStandardMaterial, NoColorSpace, RepeatWrapping, ShaderMaterial, Shape, Vector2, Vector3 } from 'three'
import { cloneEnvironmentPresets, environmentOrder, environmentPresets, serializeEnvironmentConfig, type EnvironmentConfig, type EnvironmentKind } from '../environment/environmentConfig'

const cameraPositions: Record<EnvironmentKind, [number, number, number]> = {
  land: [7.1, 2.8, 9.2],
  sea: [9.5, 5.3, 10.5],
  air: [9.2, 4.8, 11.5],
}

const vesselFootprint: [number, number, number][] = [
  [-3.65, 0, -1.65],
  [-3.65, 0, 1.65],
  [3.65, 0, -1.65],
  [3.65, 0, 1.65],
]

const STUDIO_FOG_NEAR = 18
const STUDIO_FOG_FAR = 90

function ProductionLandSky({ config }: { config: EnvironmentConfig }) {
  const fogNear = STUDIO_FOG_NEAR - (config.fog - .42) * 12
  const fogFar = STUDIO_FOG_FAR - (config.fog - .42) * 50
  return <mesh renderOrder={-1}>
    <sphereGeometry args={[450, 32, 16]} />
    <shaderMaterial side={BackSide} depthWrite={false} toneMapped={false} uniforms={{ horizonColor: { value: new Color(config.horizon) }, zenithColor: { value: new Color(config.zenith) }, fogNear: { value: fogNear }, fogFar: { value: fogFar }, detail: { value: config.detail } }}
      vertexShader={`varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={`
        varying vec3 vDirection;
        uniform vec3 horizonColor, zenithColor;
        uniform float fogNear, fogFar, detail;
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
          float midRidge=ridge(angle,.6);
          float nearRidge=ridge(angle-.7,2.8)*.72;
          vec3 farColor=mix(mix(horizonColor,zenithColor,.20),horizonColor,smoothstep(fogNear,fogFar,65.));
          vec3 midColor=mix(mix(horizonColor,zenithColor,.36),horizonColor,smoothstep(fogNear,fogFar,50.));
          vec3 nearColor=mix(mix(horizonColor,zenithColor,.50),horizonColor,smoothstep(fogNear,fogFar,38.));
          sky=mix(sky,farColor,1.-smoothstep(farRidge-softness*3.,farRidge+softness*3.,height));
          sky=mix(sky,midColor,1.-smoothstep(midRidge-softness*2.,midRidge+softness*2.,height));
          sky=mix(sky,nearColor,1.-smoothstep(nearRidge-softness,nearRidge+softness,height));
          float hazeScale=1.+(detail-.72)*.8;
          float lowHaze=1.-smoothstep(0.,.065*hazeScale,max(0.,height));
          sky=mix(sky,horizonColor,lowHaze);
          gl_FragColor=vec4(sky,1.);
          #include <colorspace_fragment>
        }
      `} />
  </mesh>
}

function ProductionLandGround() {
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
      shader.fragmentShader = shader.fragmentShader
        .replace('texture2D( roughnessMap, vUv )', 'texture2D( roughnessMap, vRoughnessMapUv )')
        .replace('texture2D(normalMap, vUv * normalScale)', 'texture2D(normalMap, vNormalMapUv)')
        .replace('vec3 coord = new_vUv.xyz / new_vUv.w;', 'my_normal.xz *= normalScale;\nvec3 coord = new_vUv.xyz / new_vUv.w;')
    }
    material.customProgramCacheKey = () => 'nexus-environment-land-ground-v2'
    material.needsUpdate = true
  }, [])
  useEffect(() => () => { textures.roughness.dispose(); textures.normal.dispose() }, [textures])
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.035, 0]} receiveShadow>
    <planeGeometry args={[2000, 2000]} />
    <MeshReflectorMaterial ref={configureGround} color="#3a234d" roughness={.5} roughnessMap={textures.roughness} normalMap={textures.normal} normalScale={new Vector2(.5, .5)} metalness={.12} blur={[140, 60]} resolution={512} mixBlur={1.15} mixStrength={1.3} depthScale={.3} minDepthThreshold={.4} maxDepthThreshold={1.5} mirror={.3} />
  </mesh>
}

function GradientSky({ config }: { config: EnvironmentConfig }) {
  return <mesh renderOrder={-10}>
    <sphereGeometry args={[250, 24, 12]} />
    <shaderMaterial key={`${config.horizon}-${config.zenith}`} side={BackSide} depthWrite={false} toneMapped={false} uniforms={{ horizon: { value: new Color(config.horizon) }, zenith: { value: new Color(config.zenith) } }} vertexShader={`varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`varying vec3 vDirection; uniform vec3 horizon; uniform vec3 zenith; void main(){float h=normalize(vDirection).y; vec3 c=mix(horizon,zenith,smoothstep(-.08,.58,h)); gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
}`} />
  </mesh>
}

function SceneLights({ config, kind }: { config: EnvironmentConfig; kind: EnvironmentKind }) {
  if (kind === 'land') return <>
    <ambientLight intensity={.6} />
    <hemisphereLight args={['#edd5ff', '#49314d', config.fillLight + .45]} />
    <directionalLight position={[7, 10, 9]} intensity={config.keyLight} color="#fff4ed" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={9} shadow-camera-bottom={-8} shadow-bias={-.0004} />
    <directionalLight position={[-6, 6, 5]} intensity={config.fillLight} color="#d7a4ef" />
    <directionalLight position={[-5, 8, -9]} intensity={1.8} color="#f4d8ff" />
    <pointLight position={[-1.05, 1.25, 3.15]} intensity={5} distance={4} decay={2} color={config.accent} />
    <pointLight position={[1.05, 1.25, 3.15]} intensity={5} distance={4} decay={2} color={config.accent} />
  </>
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
      const prepare = (source: Material) => {
        if (!(source instanceof MeshStandardMaterial)) return source.clone()
        const material = source.clone()
        const cutout = source.transparent || Boolean(source.alphaMap)
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
        material.onBeforeCompile = shader => { shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.65, 1.0, roughnessFactor);') }
        material.customProgramCacheKey = () => 'nexus-environment-land-matte'
        return material
      }
      object.material = Array.isArray(object.material) ? object.material.map(prepare) : prepare(object.material)
    })
    const bounds = new Box3().setFromObject(owned)
    const center = bounds.getCenter(new Vector3())
    return { scene: owned, offset: new Vector3(-center.x, -bounds.min.y, -center.z) }
  }, [gltf.scene])
  return <group position={offset}><primitive object={scene} /></group>
}

function LandScene() {
  return <>
    <ProductionLandGround />
    <LandVehicle />
    <ContactShadows position={[0, .005, 0]} opacity={.48} scale={16} blur={2.8} far={7} color="#30143e" frames={1} resolution={256} />
  </>
}

const seaWaveGLSL = `
  vec3 seaWaveData(vec2 p,float time,float motion,float detail){
    float energy=.45+motion*.75;
    float fine=.65+detail*.55;
    vec3 data=vec3(0.);
    vec2 d1=normalize(vec2(.94,.342)); float k1=.34; float a1=.25*energy; float q1=dot(p,d1)*k1+time*1.05;
    vec2 d2=normalize(vec2(-.26,.966)); float k2=.52; float a2=.14*energy; float q2=dot(p,d2)*k2+time*.82;
    vec2 d3=normalize(vec2(.68,.733)); float k3=.88; float a3=.075*energy*fine; float q3=dot(p,d3)*k3+time*1.33;
    vec2 d4=normalize(vec2(-.83,.557)); float k4=1.34; float a4=.038*energy*fine; float q4=dot(p,d4)*k4+time*1.72;
    data.x=sin(q1)*a1+sin(q2)*a2+sin(q3)*a3+sin(q4)*a4;
    data.y=cos(q1)*a1*k1*d1.x+cos(q2)*a2*k2*d2.x+cos(q3)*a3*k3*d3.x+cos(q4)*a4*k4*d4.x;
    data.z=cos(q1)*a1*k1*d1.y+cos(q2)*a2*k2*d2.y+cos(q3)*a3*k3*d3.y+cos(q4)*a4*k4*d4.y;
    return data;
  }
`

function OceanSurface({ config, reducedMotion }: { config: EnvironmentConfig; reducedMotion: boolean }) {
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    motion: { value: config.motion },
    detail: { value: config.detail },
    deep: { value: new Color('#07152e') },
    mid: { value: new Color('#174a68') },
    shallow: { value: new Color('#4c7fa0') },
    horizon: { value: new Color('#8f78b6') },
    zenith: { value: new Color('#202c59') },
    sunColor: { value: new Color('#f6e5ff') },
  }), [config.detail, config.motion])
  useFrame(state => {
    const time = reducedMotion ? 0 : state.clock.elapsedTime
    if (material.current) material.current.uniforms.time.value = time
    state.gl.domElement.dataset.wavePhase = time.toFixed(3)
  })
  return <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[240, 240, 128, 128]} />
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={`
      uniform float time,motion,detail;
      varying vec3 vWorldPosition,vWorldNormal;
      varying float vHeight,vSlope;
      ${seaWaveGLSL}
      void main(){
        vec3 p=position;
        vec3 wave=seaWaveData(p.xy,time,motion,detail);
        p.z+=wave.x;
        vec3 localNormal=normalize(vec3(-wave.y,-wave.z,1.));
        vec4 world=modelMatrix*vec4(p,1.);
        vWorldPosition=world.xyz;
        vWorldNormal=normalize(normalMatrix*localNormal);
        vHeight=wave.x;
        vSlope=length(wave.yz);
        gl_Position=projectionMatrix*viewMatrix*world;
      }
    `} fragmentShader={`
      uniform vec3 deep,mid,shallow,horizon,zenith,sunColor;
      uniform float detail;
      varying vec3 vWorldPosition,vWorldNormal;
      varying float vHeight,vSlope;
      void main(){
        float microX=sin(vWorldPosition.x*2.7+vWorldPosition.z*1.8)*.035*detail;
        float microZ=cos(vWorldPosition.z*3.1-vWorldPosition.x*1.4)*.03*detail;
        vec3 normal=normalize(vWorldNormal+vec3(microX,0.,microZ));
        vec3 viewDir=normalize(cameraPosition-vWorldPosition);
        vec3 sunDir=normalize(vec3(-.34,.82,.46));
        float facing=clamp(dot(normal,viewDir),0.,1.);
        float fresnel=.045+.955*pow(1.-facing,5.);
        vec3 reflected=reflect(-viewDir,normal);
        float skyHeight=smoothstep(-.18,.72,reflected.y);
        vec3 sky=mix(horizon,zenith,skyHeight);
        float trough=smoothstep(-.5,.5,vHeight);
        vec3 body=mix(deep,mid,.42+trough*.3);
        body=mix(body,shallow,clamp(vSlope*1.45,0.,.46));
        float specular=pow(max(dot(reflect(-sunDir,normal),viewDir),0.),150.);
        float broadSpec=pow(max(dot(reflect(-sunDir,normal),viewDir),0.),24.)*.2;
        float crest=smoothstep(.25,.48,vHeight+vSlope*.22)*smoothstep(.08,.34,vSlope)*detail;
        vec3 color=mix(body,sky,.2+fresnel*.68);
        color+=sunColor*(specular*1.55+broadSpec);
        color=mix(color,vec3(.73,.9,1.),crest*.24);
        float haze=smoothstep(48.,150.,distance(cameraPosition,vWorldPosition));
        color=mix(color,horizon,haze*.72);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `} />
  </mesh>
}

function waveSample(x: number, y: number, time: number, motion: number, detail: number) {
  const energy = .45 + motion * .75
  const fine = .65 + detail * .55
  const waves = [
    { x: .94, y: .342, k: .34, a: .25 * energy, speed: 1.05 },
    { x: -.26, y: .966, k: .52, a: .14 * energy, speed: .82 },
    { x: .68, y: .733, k: .88, a: .075 * energy * fine, speed: 1.33 },
    { x: -.83, y: .557, k: 1.34, a: .038 * energy * fine, speed: 1.72 },
  ]
  return waves.reduce((height, wave) => {
    const length = Math.hypot(wave.x, wave.y)
    return height + Math.sin((x * wave.x / length + y * wave.y / length) * wave.k + time * wave.speed) * wave.a
  }, 0)
}

function ContactFoam({ config, reducedMotion }: { config: EnvironmentConfig; reducedMotion: boolean }) {
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    motion: { value: config.motion },
    detail: { value: config.detail },
  }), [config.detail, config.motion])
  useFrame(state => {
    const time = reducedMotion ? 0 : state.clock.elapsedTime
    if (material.current) material.current.uniforms.time.value = time
    state.gl.domElement.dataset.contactFoamPhase = time.toFixed(3)
  })
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .075, 0]} renderOrder={3}>
    <planeGeometry args={[14, 7, 96, 48]} />
    <shaderMaterial ref={material} uniforms={uniforms} transparent depthWrite={false} vertexShader={`
      uniform float time,motion,detail;
      varying vec2 vPosition;
      ${seaWaveGLSL}
      void main(){
        vec3 p=position;
        vPosition=p.xy;
        p.z+=seaWaveData(p.xy,time,motion,detail).x;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }
    `} fragmentShader={`
      uniform float time,detail;
      varying vec2 vPosition;
      float capsule(vec2 p,vec2 a,vec2 b,float radius){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-radius;}
      void main(){
        float hull=capsule(vPosition,vec2(-2.25,0.),vec2(2.15,0.),.78);
        float breakup=.5+.28*sin(vPosition.x*5.7-vPosition.y*3.4+time*2.2)+.22*sin(vPosition.y*11.3+time*1.4);
        float contact=(1.-smoothstep(.04,.3,abs(hull)))*smoothstep(.28,.74,breakup);
        float behind=1.-smoothstep(-3.6,-1.75,vPosition.x);
        float wakeWidth=(-vPosition.x-1.4)*.19;
        float wakeArms=1.-smoothstep(.035,.16,abs(abs(vPosition.y)-wakeWidth));
        float turbulence=(1.-smoothstep(.18,.72,abs(vPosition.y)))*smoothstep(.3,.82,.5+.5*sin(vPosition.x*4.2+vPosition.y*13.-time*3.));
        float farFade=smoothstep(-6.8,-2.1,vPosition.x);
        float wake=(wakeArms*.7+turbulence*.28)*behind*farFade;
        float alpha=clamp(contact*.78+wake*.52,0.,.82)*(.7+detail*.3);
        vec3 foam=mix(vec3(.54,.75,.88),vec3(.93,.98,1.),contact);
        gl_FragColor=vec4(foam,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `} />
  </mesh>
}

function VesselStandIn({ config, reducedMotion }: { config: EnvironmentConfig; reducedMotion: boolean }) {
  const vessel = useRef<Group>(null)
  const footprintPoints = useMemo(() => vesselFootprint.map(point => new Vector3(...point)), [])
  useFrame(state => {
    const time = reducedMotion ? 0 : state.clock.elapsedTime
    const center = waveSample(0, 0, time, config.motion, config.detail)
    const bow = waveSample(2.1, 0, time, config.motion, config.detail)
    const stern = waveSample(-2.1, 0, time, config.motion, config.detail)
    const port = waveSample(0, .7, time, config.motion, config.detail)
    const starboard = waveSample(0, -.7, time, config.motion, config.detail)
    const activeVessel = vessel.current
    if (activeVessel) {
      activeVessel.position.y = .43 + center
      activeVessel.rotation.z = Math.atan2(stern - bow, 4.2)
      activeVessel.rotation.x = Math.atan2(port - starboard, 1.4)
      activeVessel.updateWorldMatrix(true, false)
      const footprint = footprintPoints.map((point, index) => point.set(...vesselFootprint[index]).applyMatrix4(activeVessel.matrixWorld).project(state.camera).x)
      state.gl.domElement.dataset.vesselMinX = Math.min(...footprint).toFixed(4)
      state.gl.domElement.dataset.vesselMaxX = Math.max(...footprint).toFixed(4)
    }
    state.gl.domElement.dataset.buoyancyHeight = center.toFixed(4)
  })
  return <>
    <ContactFoam config={config} reducedMotion={reducedMotion} />
    <group ref={vessel}>
      <mesh position={[0, .18, 0]} rotation={[0, 0, Math.PI / 2]} scale={[.72, 1.35, 1.05]} castShadow><capsuleGeometry args={[.62, 3.5, 5, 12]} /><meshStandardMaterial color="#272136" roughness={.42} metalness={.45} /></mesh>
      <mesh position={[-.35, .8, 0]} scale={[1.42, .42, .72]} castShadow><boxGeometry /><meshStandardMaterial color="#d8d0df" roughness={.55} /></mesh>
      <mesh position={[.1, 1.2, 0]} scale={[.74, .32, .58]} castShadow><boxGeometry /><meshStandardMaterial color="#4b3b69" roughness={.45} /></mesh>
      <mesh position={[.25, 1.82, 0]} scale={[.06, .7, .06]} castShadow><cylinderGeometry args={[1, 1, 1, 8]} /><meshStandardMaterial color={config.accent} /></mesh>
      <mesh position={[0, .83, -.73]} scale={[1.55, .08, .08]}><boxGeometry /><meshStandardMaterial color={config.accent} emissive={config.accent} emissiveIntensity={.5} /></mesh>
    </group>
  </>
}

function SeaScene({ config, reducedMotion }: { config: EnvironmentConfig; reducedMotion: boolean }) {
  return <><OceanSurface config={config} reducedMotion={reducedMotion} /><VesselStandIn config={config} reducedMotion={reducedMotion} /></>
}

const cloudNoiseGLSL = `
  float cloudHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
  float cloudNoise(vec2 p){
    vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(cloudHash(i),cloudHash(i+vec2(1.,0.)),f.x),mix(cloudHash(i+vec2(0.,1.)),cloudHash(i+vec2(1.,1.)),f.x),f.y);
  }
  float cloudFbm(vec2 p){
    float value=0.,weight=.52;
    mat2 rotation=mat2(.8,.6,-.6,.8);
    for(int octave=0;octave<5;octave++){value+=cloudNoise(p)*weight;p=rotation*p*2.03+vec2(3.7,1.9);weight*=.5;}
    return value;
  }
`

function AirAtmosphere({ config, reducedMotion }: { config: EnvironmentConfig; reducedMotion: boolean }) {
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    motion: { value: config.motion },
    detail: { value: config.detail },
    horizon: { value: new Color(config.horizon) },
    zenith: { value: new Color(config.zenith) },
  }), [config.detail, config.horizon, config.motion, config.zenith])
  useFrame(state => {
    const time = reducedMotion ? 0 : state.clock.elapsedTime
    if (material.current) material.current.uniforms.time.value = time
    state.gl.domElement.dataset.airPhase = time.toFixed(3)
  })
  return <mesh renderOrder={-8}>
    <sphereGeometry args={[300, 48, 24]} />
    <shaderMaterial ref={material} side={BackSide} depthWrite={false} toneMapped={false} uniforms={uniforms} vertexShader={`
      varying vec3 vDirection;
      void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `} fragmentShader={`
      varying vec3 vDirection;
      uniform float time,motion,detail;
      uniform vec3 horizon,zenith;
      ${cloudNoiseGLSL}
      void main(){
        vec3 direction=normalize(vDirection);
        float height=direction.y;
        float angle=atan(direction.z,direction.x);
        vec3 sky=mix(horizon,zenith,smoothstep(-.08,.68,height));
        vec3 sunDirection=normalize(vec3(-.38,.42,.82));
        float sun=pow(max(dot(direction,sunDirection),0.),72.);
        float sunBloom=pow(max(dot(direction,sunDirection),0.),9.);
        sky+=vec3(1.,.72,.74)*sun*.7+vec3(.72,.46,.83)*sunBloom*.16;
        vec2 farUv=vec2(angle*3.25+time*(.012+.026*motion),height*9.4);
        vec2 nearUv=vec2(angle*5.1-time*(.02+.035*motion),height*13.2+4.7);
        float farNoise=cloudFbm(farUv);
        float nearNoise=cloudFbm(nearUv);
        float coverage=.59-(detail-.5)*.18;
        float farBand=smoothstep(-.08,.08,height)*(1.-smoothstep(.42,.7,height));
        float nearBand=smoothstep(.015,.12,height)*(1.-smoothstep(.6,.82,height));
        float farDensity=smoothstep(coverage-.08,coverage+.1,farNoise)*farBand;
        float nearDensity=smoothstep(coverage-.13,coverage+.09,nearNoise)*nearBand;
        float litFar=cloudFbm(farUv+vec2(-.11,.08));
        float litNear=cloudFbm(nearUv+vec2(-.09,.07));
        vec3 shadowColor=mix(vec3(.35,.32,.5),horizon,.42);
        vec3 farCloud=mix(shadowColor,vec3(.84,.8,.9),smoothstep(-.05,.16,litFar-farNoise+.08));
        vec3 nearCloud=mix(shadowColor*.88,vec3(.98,.92,1.),smoothstep(-.06,.18,litNear-nearNoise+.09));
        sky=mix(sky,farCloud,farDensity*.62);
        sky=mix(sky,nearCloud,nearDensity*.8);
        float horizonGlow=(1.-smoothstep(0.,.22,abs(height)))*.26;
        sky=mix(sky,vec3(.76,.56,.82),horizonGlow);
        gl_FragColor=vec4(sky,1.);
        #include <colorspace_fragment>
      }
    `} />
  </mesh>
}

function CloudDeckLayer({ config, reducedMotion, depth, scale, opacity, drift }: { config: EnvironmentConfig; reducedMotion: boolean; depth: number; scale: number; opacity: number; drift: number }) {
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    motion: { value: config.motion },
    detail: { value: config.detail },
    opacity: { value: opacity },
    scale: { value: scale },
    drift: { value: drift },
  }), [config.detail, config.motion, drift, opacity, scale])
  useFrame(state => {
    if (material.current) material.current.uniforms.time.value = reducedMotion ? 0 : state.clock.elapsedTime
  })
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, depth, -18]} renderOrder={-2}>
    <planeGeometry args={[160, 145, 1, 1]} />
    <shaderMaterial ref={material} transparent depthWrite={false} uniforms={uniforms} vertexShader={`
      varying vec2 vUv; varying vec3 vWorldPosition;
      void main(){vUv=uv;vec4 world=modelMatrix*vec4(position,1.);vWorldPosition=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}
    `} fragmentShader={`
      varying vec2 vUv; varying vec3 vWorldPosition;
      uniform float time,motion,detail,opacity,scale,drift;
      ${cloudNoiseGLSL}
      void main(){
        vec2 p=vWorldPosition.xz*scale+vec2(time*(.018+.038*motion)*drift,time*.011*drift);
        float broad=cloudFbm(p);
        float fine=cloudFbm(p*2.35+vec2(5.2,-3.4));
        float coverage=.66-(detail-.5)*.12;
        float density=smoothstep(coverage-.1,coverage+.12,broad+fine*.16);
        float edge=smoothstep(0.,.15,vUv.x)*smoothstep(0.,.15,vUv.y)*smoothstep(0.,.15,1.-vUv.x)*smoothstep(0.,.15,1.-vUv.y);
        float light=cloudFbm(p+vec2(-.13,.1));
        vec3 shadow=vec3(.34,.31,.48),highlight=vec3(.96,.92,1.);
        vec3 color=mix(shadow,highlight,smoothstep(-.08,.2,light-broad+.1));
        gl_FragColor=vec4(color,density*edge*opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `} />
  </mesh>
}

function AircraftStandIn({ config, reducedMotion }: { config: EnvironmentConfig; reducedMotion: boolean }) {
  const aircraft = useRef<Group>(null)
  const wingShape = useMemo(() => {
    const shape = new Shape()
    shape.moveTo(1.25, 0)
    shape.lineTo(-1.05, 3.15)
    shape.lineTo(-.78, .42)
    shape.lineTo(-1.05, -3.15)
    shape.closePath()
    return shape
  }, [])
  useFrame(state => {
    if (!aircraft.current) return
    const time = reducedMotion ? 0 : state.clock.elapsedTime
    aircraft.current.position.y = 1.25 + Math.sin(time * (.35 + config.motion)) * .16
    aircraft.current.rotation.z = -.05 + Math.sin(time * .3) * .018
  })
  return <group ref={aircraft} rotation={[0, -.28, 0]}>
    <mesh rotation={[0, 0, Math.PI / 2]} castShadow><capsuleGeometry args={[.42, 3.6, 8, 20]} /><meshStandardMaterial color="#ded8e7" metalness={.5} roughness={.28} /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[-.12, .05, 0]} castShadow><extrudeGeometry args={[wingShape, { depth: .12, bevelEnabled: true, bevelSize: .035, bevelThickness: .025, bevelSegments: 2 }]} /><meshStandardMaterial color="#44345f" metalness={.34} roughness={.4} /></mesh>
    <mesh position={[1.2, .34, 0]} rotation={[0, 0, Math.PI / 2]} scale={[.65, .2, .34]}><capsuleGeometry args={[.5, 1.2, 6, 16]} /><meshStandardMaterial color="#231c3c" metalness={.22} roughness={.2} transparent opacity={.84} /></mesh>
    <mesh scale={[.72, .7, .08]} position={[-2.05, .45, 0]} rotation={[0, 0, -.2]}><boxGeometry /><meshStandardMaterial color={config.accent} /></mesh>
    <mesh scale={[.75, .07, 1.0]} position={[-1.85, .06, 0]}><boxGeometry /><meshStandardMaterial color="#5d477e" /></mesh>
    <mesh position={[2.36, 0, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[.58, .58, .58]}><coneGeometry args={[.72, 1.45, 24]} /><meshStandardMaterial color="#e7dfed" metalness={.5} roughness={.25} /></mesh>
  </group>
}

function AirScene({ config, reducedMotion }: { config: EnvironmentConfig; reducedMotion: boolean }) {
  return <>
    <AirAtmosphere config={config} reducedMotion={reducedMotion} />
    <CloudDeckLayer config={config} reducedMotion={reducedMotion} depth={-2.8} scale={.085} opacity={.68} drift={1} />
    <CloudDeckLayer config={config} reducedMotion={reducedMotion} depth={-5.8} scale={.046} opacity={.42} drift={-.55} />
    <AircraftStandIn config={config} reducedMotion={reducedMotion} />
  </>
}

function SceneCamera({ kind }: { kind: EnvironmentKind }) {
  const { camera, invalidate, size } = useThree()
  useEffect(() => {
    const target = kind === 'land' ? new Vector3(-.6, 2, 0) : new Vector3(0, kind === 'air' ? .7 : 1.2, 0)
    const portrait = size.height > size.width
    const portraitScale = kind === 'sea' ? 1.75 : kind === 'air' ? 1.55 : 1.45
    const scale = portrait ? portraitScale : 1
    const [x, y, z] = cameraPositions[kind]
    camera.position.set(target.x + (x - target.x) * scale, target.y + (y - target.y) * scale, target.z + (z - target.z) * scale)
    camera.lookAt(target)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, kind, size.height, size.width])
  return null
}

function SceneControls({ kind }: { kind: EnvironmentKind }) {
  const { size } = useThree()
  const portrait = size.height > size.width
  const target: [number, number, number] = kind === 'land' ? [-.6, 2, 0] : [0, kind === 'air' ? .7 : 1.2, 0]
  return <OrbitControls key={`${kind}-${portrait ? 'portrait' : 'landscape'}`} makeDefault enablePan={false} minDistance={6} maxDistance={portrait ? 32 : 18} minPolarAngle={Math.PI * .2} maxPolarAngle={Math.PI * .48} target={target} />
}

function SceneReady({ kind, onReady }: { kind: EnvironmentKind; onReady: () => void }) {
  const reported = useRef<EnvironmentKind | null>(null)
  useFrame(() => {
    if (reported.current === kind) return
    reported.current = kind
    onReady()
  })
  return null
}

function SceneTelemetry({ kind }: { kind: EnvironmentKind }) {
  const recordedKind = useRef(kind)
  const maxima = useRef({ drawCalls: 0, triangles: 0, programs: 0, textures: 0, geometries: 0 })
  useFrame(state => {
    const canvas = state.gl.domElement
    if (recordedKind.current !== kind) {
      recordedKind.current = kind
      maxima.current = { drawCalls: 0, triangles: 0, programs: 0, textures: 0, geometries: 0 }
    }
    requestAnimationFrame(() => {
      if (!canvas.isConnected) return
      const { render, memory, programs } = state.gl.info
      const keepMaximum = (key: keyof typeof maxima.current, value: number) => {
        maxima.current[key] = Math.max(maxima.current[key], value)
        canvas.dataset[key] = String(maxima.current[key])
      }
      keepMaximum('drawCalls', render.calls)
      keepMaximum('triangles', render.triangles)
      keepMaximum('programs', programs?.length ?? 0)
      keepMaximum('textures', memory.textures)
      keepMaximum('geometries', memory.geometries)
    })
  })
  return null
}

function EnvironmentCanvas({ kind, config, onReady, reducedMotion }: { kind: EnvironmentKind; config: EnvironmentConfig; onReady: () => void; reducedMotion: boolean }) {
  const fogNear = kind === 'land' ? STUDIO_FOG_NEAR - (config.fog - .42) * 12 : 18 + config.fog * 20
  const fogFar = kind === 'land' ? STUDIO_FOG_FAR - (config.fog - .42) * 50 : 62 + config.fog * 80
  return <Canvas shadows={kind !== 'air'} frameloop={reducedMotion || kind === 'land' ? 'demand' : 'always'} dpr={[1, 1.25]} camera={{ position: cameraPositions.land, fov: 38, near: .1, far: 600 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
    <color attach="background" args={[kind === 'land' ? '#64358d' : config.horizon]} />
    <fog attach="fog" args={[config.horizon, fogNear, fogFar]} />
    <SceneCamera kind={kind} />
    {kind === 'land' ? <ProductionLandSky config={config} /> : kind === 'sea' ? <GradientSky config={config} /> : null}
    <SceneLights config={config} kind={kind} />
    <Suspense fallback={null}>
      {kind === 'land' && <LandScene />}
      {kind === 'sea' && <SeaScene config={config} reducedMotion={reducedMotion} />}
      {kind === 'air' && <AirScene config={config} reducedMotion={reducedMotion} />}
      <SceneReady kind={kind} onReady={onReady} />
    </Suspense>
    <SceneTelemetry kind={kind} />
    <SceneControls kind={kind} />
  </Canvas>
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
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
  const reducedMotion = useReducedMotion()
  const markSceneReady = useCallback(() => setSceneReady(true), [])
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

  return <main id="main-content" className={`environment-lab environment-${kind}`} data-environment={kind} data-scene-ready={sceneReady} data-motion={reducedMotion ? 'reduced' : 'full'} style={{ '--environment-accent': config.accent } as CSSProperties}>
    <div className="environment-canvas" data-frameloop={reducedMotion || kind === 'land' ? 'demand' : 'always'} aria-hidden="true"><EnvironmentCanvas kind={kind} config={config} onReady={markSceneReady} reducedMotion={reducedMotion} /></div>
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
    <button className={`creator-toggle ${creatorOpen ? 'is-open' : ''}`} aria-label={creatorOpen ? 'Close creator tools' : 'Open creator tools'} aria-expanded={creatorOpen} aria-controls="environment-creator-tools" onClick={() => setCreatorOpen(value => !value)}><span className="creator-toggle-label">Creator tools</span><span aria-hidden="true">{creatorOpen ? '×' : '+'}</span></button>
    <aside id="environment-creator-tools" className={`environment-creator ${creatorOpen ? 'is-open' : ''}`} aria-hidden={!creatorOpen} inert={!creatorOpen}>
      <header><p>AUTHORING ONLY</p><h2>Scene direction</h2><small>Not included in the visitor experience</small></header>
      <RangeControl id="creator-key" label="Key light" value={config.keyLight} onChange={value => patch({ keyLight: value })} />
      <RangeControl id="creator-fill" label="Fill light" value={config.fillLight} onChange={value => patch({ fillLight: value })} />
      <RangeControl id="creator-fog" label="Atmospheric depth" value={config.fog} max={1} step={.01} onChange={value => patch({ fog: value })} />
      <label htmlFor="creator-accent">Accent color<input id="creator-accent" type="color" value={config.accent} onChange={event => patch({ accent: event.target.value })} /></label>
      {kind !== 'land' && <RangeControl id="creator-motion" label={kind === 'sea' ? 'Wave energy' : 'Cloud drift'} value={config.motion} max={1} step={.01} onChange={value => patch({ motion: value })} />}
      <RangeControl id="creator-detail" label={kind === 'land' ? 'Haze density' : kind === 'sea' ? 'Surface detail' : 'Cloud density'} value={config.detail} max={1} step={.01} onChange={value => patch({ detail: value })} />
      <div className="creator-actions"><button onClick={() => patch(environmentPresets[kind])}>Reset {config.label}</button><button onClick={() => void copy()}>Copy JSON</button></div>
      {copyStatus && <p className="creator-copy-status" role="status">{copyStatus}</p>}
      {copyStatus.startsWith('Clipboard unavailable') && <pre>{serializeEnvironmentConfig(kind, config)}</pre>}
    </aside>
  </main>
}

useGLTF.preload('/assets/jltv-runtime.glb')
