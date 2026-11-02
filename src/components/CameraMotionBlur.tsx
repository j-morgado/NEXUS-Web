import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { DepthTexture, HalfFloatType, Matrix4, Mesh, NoBlending, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, UnsignedIntType, Vector2, WebGLRenderTarget } from 'three'

/** Consistent scene output; five depth-reprojected samples only during camera motion. */
export function CameraMotionBlur({ reducedMotion, statusRef }: { reducedMotion: boolean; statusRef: RefObject<HTMLDivElement | null> }) {
  const { gl, size, invalidate } = useThree()
  const firstFrame = useRef(true)
  const renderedFrames = useRef(0)
  const previous = useMemo(() => new Matrix4(), [])
  const current = useMemo(() => new Matrix4(), [])
  const inverse = useMemo(() => new Matrix4(), [])
  const pipeline = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 2 })
    target.depthTexture = new DepthTexture(1, 1, UnsignedIntType)
    const material = new ShaderMaterial({
      depthTest: false, depthWrite: false, blending: NoBlending, dithering: true,
      uniforms: { colorBuffer: { value: target.texture }, depthBuffer: { value: target.depthTexture }, inverseViewProjection: { value: new Matrix4() }, previousViewProjection: { value: new Matrix4() }, resolution: { value: new Vector2(1, 1) }, strength: { value: 0 }, glowStrength: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `
        #include <common>
        #include <dithering_pars_fragment>
        uniform sampler2D colorBuffer, depthBuffer;
        uniform mat4 inverseViewProjection, previousViewProjection;
        uniform vec2 resolution; uniform float strength, glowStrength; varying vec2 vUv;
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
            for(int i=0;i<5;i++) color+=texture2D(colorBuffer,clamp(vUv+velocity*(float(i)/4.-.5),vec2(0.),vec2(1.)));
            color/=5.;
          }
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
    return { target, material, scene, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), quad }
  }, [])
  useEffect(() => {
    const ratio = gl.getPixelRatio()
    pipeline.target.setSize(Math.round(size.width * ratio), Math.round(size.height * ratio))
    pipeline.material.uniforms.resolution.value.set(size.width * ratio, size.height * ratio)
    firstFrame.current = true
  }, [gl, pipeline, size])
  useEffect(() => () => { pipeline.target.depthTexture?.dispose(); pipeline.target.dispose(); pipeline.material.dispose(); pipeline.quad.geometry.dispose() }, [pipeline])
  useFrame(({ camera, scene }) => {
    camera.updateMatrixWorld()
    current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const moving = !firstFrame.current && current.elements.some((value, index) => Math.abs(value - previous.elements[index]) > .00001)
    const enabled = moving && !reducedMotion
    if (statusRef.current) {
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
    gl.setRenderTarget(pipeline.target)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    gl.render(pipeline.scene, pipeline.camera)
    if (enabled) invalidate()
    previous.copy(current)
    firstFrame.current = false
  }, 1)
  return null
}
