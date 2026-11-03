import type { VisualSettings } from '../services/visualSettings'
import { createAmbientOcclusionMaterial } from './ambientOcclusion'
/* eslint-disable react-hooks/immutability -- The post-processing pipeline is an imperative Three.js render target updated per frame. */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { DepthTexture, HalfFloatType, Matrix4, Mesh, NoBlending, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, UnsignedIntType, Vector2, WebGLRenderTarget } from 'three'

/** Consistent scene output; five depth-reprojected samples only during camera motion. */
export function CameraMotionBlur({ reducedMotion, statusRef, visual, showPerformanceStats }: { visual: VisualSettings; showPerformanceStats: boolean; reducedMotion: boolean; statusRef: RefObject<HTMLDivElement | null> }) {
  const { gl, size, invalidate } = useThree()
  const statsWindow = useRef({ start: performance.now(), frames: 0 })
  const firstFrame = useRef(true)
  const renderedFrames = useRef(0)
  const previous = useMemo(() => new Matrix4(), [])
  const current = useMemo(() => new Matrix4(), [])
  const inverse = useMemo(() => new Matrix4(), [])
  const pipeline = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 2 })
    target.depthTexture = new DepthTexture(1, 1, UnsignedIntType)
    const aoTarget = new WebGLRenderTarget(1, 1, { depthBuffer: false })
    const aoMaterial = createAmbientOcclusionMaterial()
    aoMaterial.uniforms.depthBuffer.value = target.depthTexture
    const material = new ShaderMaterial({
      depthTest: false, depthWrite: false, blending: NoBlending, dithering: true,
      uniforms: { ssaoEnabled: { value: true }, ssgiEnabled: { value: false }, ssrEnabled: { value: false }, ssgiSamples: { value: 16 }, ssrSteps: { value: 32 }, blurSamples: { value: 5 }, projection: { value: new Matrix4() }, inverseProjection: { value: new Matrix4() }, occlusionBuffer: { value: aoTarget.texture }, colorBuffer: { value: target.texture }, depthBuffer: { value: target.depthTexture }, inverseViewProjection: { value: new Matrix4() }, previousViewProjection: { value: new Matrix4() }, resolution: { value: new Vector2(1, 1) }, strength: { value: 0 }, glowStrength: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `
        #include <common>
        #include <dithering_pars_fragment>
        uniform sampler2D colorBuffer, depthBuffer, occlusionBuffer;
        uniform mat4 inverseViewProjection, previousViewProjection;
        uniform vec2 resolution; uniform float strength, glowStrength; varying vec2 vUv;
        uniform bool ssaoEnabled, ssgiEnabled, ssrEnabled;
        uniform int ssgiSamples, ssrSteps, blurSamples;
        uniform mat4 projection, inverseProjection;
        vec3 viewPosition(vec2 uv) {
          vec4 p=inverseProjection*vec4(uv*2.-1.,texture2D(depthBuffer,uv).r*2.-1.,1.);
          return p.xyz/p.w;
        }
        vec3 screenLighting(vec3 base) {
          vec3 p=viewPosition(vUv);
          if(p.z < -40. || p.z > -.1) return base;
          vec2 texel=1./resolution;
          vec3 l=p-viewPosition(vUv-vec2(texel.x,0.)), r=viewPosition(vUv+vec2(texel.x,0.))-p;
          vec3 d=p-viewPosition(vUv-vec2(0.,texel.y)), u=viewPosition(vUv+vec2(0.,texel.y))-p;
          vec3 n=normalize(cross(abs(l.z)<abs(r.z)?l:r,abs(d.z)<abs(u.z)?d:u));
          float fade=1.-smoothstep(20.,40.,-p.z);
          if(ssgiEnabled) {
            vec3 bounce=vec3(0.); float total=0.;
            for(int i=0;i<32;i++) {
              if(i>=ssgiSamples) break;
              float f=(float(i)+.5)/float(ssgiSamples), a=float(i)*2.399963;
              vec2 uv=vUv+vec2(cos(a),sin(a))*sqrt(f)*36./resolution;
              if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.)))) continue;
              vec3 diff=viewPosition(uv)-p;
              float distanceToSample=length(diff);
              float weight=max(dot(n,diff/max(distanceToSample,.0001)),0.)*(1.-smoothstep(.2,1.5,distanceToSample));
              bounce+=min(texture2D(colorBuffer,uv).rgb,vec3(2.))*weight;
              total+=weight;
            }
            base+=bounce/max(total,1.)*.12*fade;
          }
          if(ssrEnabled) {
            vec3 ray=reflect(normalize(p),n);
            vec3 origin=p+n*.06;
            for(int i=0;i<64;i++) {
              if(i>=ssrSteps) break;
              float travel=(float(i)+1.)*8./float(ssrSteps);
              vec3 probe=origin+ray*travel;
              vec4 clip=projection*vec4(probe,1.);
              if(clip.w<=0.) break;
              vec2 uv=clip.xy/clip.w*.5+.5;
              if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.)))) break;
              float difference=viewPosition(uv).z-probe.z;
              if(difference>.025 && difference<.25 && travel>.2) {
                float edge=smoothstep(0.,.1,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
                float fresnel=.04+.16*pow(1.-max(dot(n,normalize(-p)),0.),3.);
                base=mix(base,texture2D(colorBuffer,uv).rgb,fresnel*edge*fade*(1.-travel/8.));
                break;
              }
            }
          }
          return base;
        }
        void main(){
          float depth=texture2D(depthBuffer,vUv).r;
          vec4 world=inverseViewProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);
          world/=world.w;
          vec4 old=previousViewProjection*world;
          vec2 velocity=(vUv-(old.xy/old.w*.5+.5))*strength;
          vec2 pixels=velocity*resolution;
          velocity*=min(1.,2./max(length(pixels),.0001));
          vec4 color=texture2D(colorBuffer,vUv);
          if(strength>0.) {
            color=vec4(0.);
            for(int i=0;i<15;i++) { if(i>=blurSamples) break; color+=texture2D(colorBuffer,clamp(vUv+velocity*(float(i)/float(blurSamples-1)-.5),vec2(0.),vec2(1.))); }
            color/=float(blurSamples);
          }
          // Edge-aware AO filtering preserves silhouettes while softening the sample pattern.
          if(ssaoEnabled) {
          float ao=0., weight=0.;
          for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
            vec2 uv=clamp(vUv+vec2(float(x),float(y))*2./resolution,vec2(0.),vec2(1.));
            float neighborDepth=texture2D(depthBuffer,uv).r;
            float w=exp(-abs(neighborDepth-depth)*4000.);
            ao+=texture2D(occlusionBuffer,uv).r*w; weight+=w;
          }
          color.rgb*=mix(1.,ao/max(weight,.0001),.45);
          }
          if(ssgiEnabled || ssrEnabled) color.rgb=screenLighting(color.rgb);
          if(glowStrength>0.) {
            vec3 halo=vec3(0.);
            for(int i=0;i<8;i++) {
              float angle=float(i)*.78539816;
              vec2 offset=vec2(cos(angle),sin(angle))*6./resolution;
              halo+=clamp(texture2D(colorBuffer,clamp(vUv+offset,vec2(0.),vec2(1.))).rgb-vec3(1.),vec3(0.),vec3(4.));
            }
            color.rgb+=halo*(.22/8.)*glowStrength;
          }
          gl_FragColor=color;
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <dithering_fragment>
        }`,
    })
    const scene = new Scene()
    const quad = new Mesh(new PlaneGeometry(2, 2), material)
    scene.add(quad)
    return { target, aoTarget, aoMaterial, material, scene, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), quad }
  }, [])
  useEffect(() => {
    const ratio = gl.getPixelRatio() * visual.resolutionScale
    pipeline.target.setSize(Math.round(size.width * ratio), Math.round(size.height * ratio))
    pipeline.material.uniforms.resolution.value.set(size.width * ratio, size.height * ratio)
    pipeline.aoTarget.setSize(Math.max(1, Math.round(size.width * ratio / 2)), Math.max(1, Math.round(size.height * ratio / 2)))
    pipeline.aoMaterial.uniforms.resolution.value.set(size.width * ratio, size.height * ratio)
    firstFrame.current = true
    invalidate()
  }, [gl, pipeline, size, visual.resolutionScale, visual.maxDpr, invalidate])
  useEffect(() => {
    pipeline.material.uniforms.ssaoEnabled.value = visual.ssao
    pipeline.material.uniforms.ssgiEnabled.value = visual.ssgi
    pipeline.material.uniforms.ssrEnabled.value = visual.ssr
    pipeline.material.uniforms.ssgiSamples.value = visual.ssgiSamples
    pipeline.material.uniforms.ssrSteps.value = visual.ssrSteps
    pipeline.material.uniforms.blurSamples.value = visual.motionBlurSamples
    pipeline.aoMaterial.uniforms.samples.value = visual.ssaoSamples
    invalidate()
  }, [visual, pipeline, invalidate, showPerformanceStats])
  useEffect(() => () => { pipeline.target.depthTexture?.dispose(); pipeline.target.dispose(); pipeline.aoTarget.dispose(); pipeline.aoMaterial.dispose(); pipeline.material.dispose(); pipeline.quad.geometry.dispose() }, [pipeline])
  useFrame(({ camera, scene }) => {
    const started = performance.now()
    camera.updateMatrixWorld()
    current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const moving = !firstFrame.current && current.elements.some((value, index) => Math.abs(value - previous.elements[index]) > .00001)
    const enabled = moving && !reducedMotion && visual.motionBlur
    if (statusRef.current) {
      statusRef.current.dataset.ambientOcclusion = String(visual.ssao)
      statusRef.current.dataset.visualSettings = JSON.stringify(visual)
      statusRef.current.dataset.motionBlurActive = String(enabled)
      statusRef.current.dataset.renderedFrames = String(++renderedFrames.current)
    }
    // Keep tone mapping and fog output identical while moving and stationary.
    // Switching to direct canvas rendering here creates a visible horizon/color jump.
    inverse.copy(current).invert()
    pipeline.material.uniforms.inverseViewProjection.value.copy(inverse)
    pipeline.material.uniforms.previousViewProjection.value.copy(previous)
    pipeline.material.uniforms.strength.value = enabled ? .45 : 0
    pipeline.material.uniforms.glowStrength.value = !reducedMotion && statusRef.current?.dataset.addonTransitioning === 'true' ? 1 : 0
    const previousAutoReset = gl.info.autoReset
    gl.info.autoReset = false
    gl.info.reset()
    gl.setRenderTarget(pipeline.target)
    gl.clear()
    gl.render(scene, camera)
    pipeline.material.uniforms.projection.value.copy(camera.projectionMatrix)
    pipeline.material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse)
    if (visual.ssao) {
    pipeline.aoMaterial.uniforms.projection.value.copy(camera.projectionMatrix)
    pipeline.aoMaterial.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse)
    pipeline.quad.material = pipeline.aoMaterial
    gl.setRenderTarget(pipeline.aoTarget)
    gl.clear()
    gl.render(pipeline.scene, pipeline.camera)
    }
    pipeline.quad.material = pipeline.material
    gl.setRenderTarget(null)
    gl.render(pipeline.scene, pipeline.camera)
    if (showPerformanceStats) {
      const window = statsWindow.current
      window.frames++
      const now = performance.now(), elapsed = now - window.start
      if (elapsed >= 500 || firstFrame.current) {
        globalThis.window.dispatchEvent(new CustomEvent('nexus:render-stats', { detail: { fps: firstFrame.current || elapsed > 1500 ? 0 : window.frames * 1000 / elapsed, cpuMs: now - started, calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, timestamp: now } }))
        window.start = now; window.frames = 0
      }
    }
    gl.info.autoReset = previousAutoReset
    if (enabled) invalidate()
    previous.copy(current)
    firstFrame.current = false
  }, 1)
  return null
}
