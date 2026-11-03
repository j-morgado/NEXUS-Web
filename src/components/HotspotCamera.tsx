/* eslint-disable react-hooks/immutability -- Orbit controls and the camera are imperative Three.js objects. */
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ElementRef, type RefObject } from 'react'
import { Vector3, type PerspectiveCamera } from 'three'
import type { HotspotMode, Vehicle } from '../domain/schemas'
import { closeupLimits, closeupView, normalLimits, sidebarWidth } from './hotspotCamera'

const ORBIT_TARGET: [number, number, number] = [-.6, 2, 0]

type View = { position: Vector3; target: Vector3; offset: number }
type Transition = { from: View; to: View; elapsed: number; duration: number; focused: boolean; limits: typeof normalLimits }
export function HotspotCamera({ activeHotspot, vehicle, mode, statusRef, modelOffset, reducedMotion, onFocusReady }: { onFocusReady: (id: string | null) => void; activeHotspot: string | null; vehicle: Vehicle; mode: HotspotMode; statusRef: RefObject<HTMLDivElement | null>; modelOffset: RefObject<Vector3>; reducedMotion: boolean }) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null)
  const saved = useRef<View | null>(null)
  const tween = useRef<Transition | null>(null)
  const offset = useRef(0)
  const { camera, size, invalidate } = useThree()
  const hotspot = vehicle.hotspots.find(item => item.id === activeHotspot)
  const effectiveMode = hotspot?.mode ?? mode

  useEffect(() => {
    const orbit = controls.current
    if (!orbit) return
    const focused = !!hotspot && effectiveMode !== 'in-place'
    if (!focused && !saved.current) { invalidate(); return }
    onFocusReady(null)
    const from = { position: camera.position.clone(), target: orbit.target.clone(), offset: offset.current }
    let to: View, limits = normalLimits
    if (focused) {
      if (!saved.current) saved.current = { ...from, position: from.position.clone(), target: from.target.clone() }
      const view = closeupView(camera.position, new Vector3(...hotspot.position).add(modelOffset.current))
      to = { position: view.position, target: view.target, offset: effectiveMode === 'zoom-sidebar' ? (sidebarWidth(size.width) + 24) / 2 : 0 }
      limits = closeupLimits(view.theta, view.phi)
    } else {
      to = saved.current!
    }
    // Flush residual orbit damping without moving the captured view.
    const damping = orbit.enableDamping
    orbit.enableDamping = false
    orbit.update()
    camera.position.copy(from.position); orbit.target.copy(from.target)
    orbit.update(); orbit.enableDamping = damping
    // Lift limits during the tween so controls cannot clamp the animated path.
    Object.assign(orbit, normalLimits, { minDistance: 0, maxDistance: Infinity, minPolarAngle: 0, maxPolarAngle: Math.PI, enabled: false })
    tween.current = { from, to, elapsed: 0, duration: reducedMotion ? 0 : .65, focused, limits }
    if (statusRef.current) statusRef.current.dataset.cameraTransitioning = 'true'
    invalidate()
  }, [hotspot, effectiveMode, camera, modelOffset, reducedMotion, size.width, size.height, statusRef, invalidate, onFocusReady])

  useFrame((_, delta) => {
    const orbit = controls.current
    if (!orbit) return
    const transition = tween.current
    if (transition) {
      transition.elapsed += Math.min(delta, .05)
      const t = transition.duration === 0 ? 1 : Math.min(1, transition.elapsed / transition.duration)
      const ease = t * t * (3 - 2 * t)
      camera.position.lerpVectors(transition.from.position, transition.to.position, ease)
      orbit.target.lerpVectors(transition.from.target, transition.to.target, ease)
      offset.current = transition.from.offset + (transition.to.offset - transition.from.offset) * ease
      const perspective = camera as PerspectiveCamera
      if (offset.current) perspective.setViewOffset(size.width, size.height, offset.current, 0, size.width, size.height)
      else perspective.clearViewOffset()
      camera.lookAt(orbit.target)
      if (t === 1) {
        // Flush residual damping with unrestricted limits before enabling input.
        const damping = orbit.enableDamping
        orbit.enableDamping = false; orbit.update(); orbit.enableDamping = damping
        Object.assign(orbit, transition.limits, { enabled: true })
        tween.current = null
        if (!transition.focused) saved.current = null
        onFocusReady(transition.focused && effectiveMode === 'zoom-sidebar' ? hotspot?.id ?? null : null)
        if (statusRef.current) statusRef.current.dataset.cameraTransitioning = 'false'
      } else invalidate()
    }
    camera.updateMatrixWorld()
    if (statusRef.current) {
      statusRef.current.dataset.cameraPosition = camera.position.toArray().map(value => value.toFixed(4)).join(',')
      statusRef.current.dataset.cameraTarget = orbit.target.toArray().map(value => value.toFixed(4)).join(',')
      statusRef.current.dataset.cameraDistance = camera.position.distanceTo(orbit.target).toFixed(4)
      statusRef.current.dataset.hotspotMode = effectiveMode
      statusRef.current.dataset.cameraLocked = String(!!hotspot && effectiveMode !== 'in-place')
      statusRef.current.dataset.orbitLimits = JSON.stringify({ minDistance: orbit.minDistance, maxDistance: orbit.maxDistance, minAzimuth: orbit.minAzimuthAngle, maxAzimuth: orbit.maxAzimuthAngle, minPolar: orbit.minPolarAngle, maxPolar: orbit.maxPolarAngle })
    }
  }, -.5)
  return <OrbitControls ref={controls} enablePan={false} enableDamping={!reducedMotion} dampingFactor={.085} {...normalLimits} target={ORBIT_TARGET} />
}
