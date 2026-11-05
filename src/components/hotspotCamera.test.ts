import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { closeupGestureResistance, closeupLimits, closeupResistanceZones, closeupView, directionalLimitResistance, normalLimits, sidebarWidth } from './hotspotCamera'
import { hotspotSchema } from '../domain/schemas'
import { seedVehicle } from '../content/seed'

describe('hotspot close-up framing', () => {
  it('approaches a visible anchor from the current side without mutating the original view', () => {
    const position = new Vector3(7, 3, 9), anchor = new Vector3(1, 2, 1)
    const view = closeupView(position, anchor)
    expect(view.position.distanceTo(anchor)).toBeCloseTo(2.8)
    expect(view.position.x).toBeGreaterThan(anchor.x)
    expect(view.position.z).toBeGreaterThan(anchor.z)
    expect(view.target.toArray()).toEqual([1, 2, 1])
    expect(position.toArray()).toEqual([7, 3, 9])
    expect(anchor.toArray()).toEqual([1, 2, 1])
  })
  it('allows a small orbit and zoom range around the close-up', () => {
    const view = closeupView(new Vector3(7, 3, 9), new Vector3(1, 2, 1))
    const limits = closeupLimits(view.theta, view.phi)
    expect(limits.maxAzimuthAngle - limits.minAzimuthAngle).toBeCloseTo(.44)
    expect(limits.maxPolarAngle - limits.minPolarAngle).toBeCloseTo(.32)
    expect(limits.minDistance).toBeLessThan(view.distance)
    expect(limits.maxDistance).toBeGreaterThan(view.distance)
    expect(normalLimits.maxAzimuthAngle).toBe(Infinity)
  })
  it('progressively resists motion toward every close-up bound without changing the hard limits', () => {
    const limits = closeupLimits(0, 1)
    const samples = [.15, .1, .06, .02].map(room => directionalLimitResistance(limits.minAzimuthAngle + room, limits.minAzimuthAngle, limits.maxAzimuthAngle, -.01, closeupResistanceZones.azimuth))
    expect(samples[0]).toBeCloseTo(1)
    expect(samples[1]).toBeGreaterThan(samples[2])
    expect(samples[2]).toBeGreaterThan(samples[3])
    expect(samples[3]).toBeGreaterThan(0)
    expect(limits).toEqual(closeupLimits(0, 1))
  })
  it('keeps input away from a nearby limit fully responsive for orbit and zoom', () => {
    const limits = closeupLimits(0, 1)
    const nearMinimum = { theta: limits.minAzimuthAngle + .005, phi: limits.minPolarAngle + .005, distance: limits.minDistance + .01, limits }
    expect(closeupGestureResistance({ ...nearMinimum, thetaDelta: -.01 })).toBeLessThan(.2)
    expect(closeupGestureResistance({ ...nearMinimum, thetaDelta: .01 })).toBe(1)
    expect(closeupGestureResistance({ ...nearMinimum, phiDelta: -.01 })).toBeLessThan(.2)
    expect(closeupGestureResistance({ ...nearMinimum, phiDelta: .01 })).toBe(1)
    expect(closeupGestureResistance({ ...nearMinimum, distanceDelta: -.02 })).toBeLessThan(.2)
    expect(closeupGestureResistance({ ...nearMinimum, distanceDelta: .02 })).toBe(1)
  })
  it('frames the selected area to the left of the sidebar at desktop and phone sizes', () => {
    for (const width of [960, 390]) {
      const camera = new PerspectiveCamera(38, width / 720, .1, 1200)
      camera.position.set(0, 0, 2.8); camera.lookAt(0, 0, 0); camera.updateMatrixWorld()
      camera.setViewOffset(width, 720, (sidebarWidth(width) + 24) / 2, 0, width, 720)
      const x = (new Vector3().project(camera).x * .5 + .5) * width
      expect(x).toBeGreaterThan(0)
      expect(x).toBeLessThan(width - sidebarWidth(width) - 24)
    }
  })
  it('preserves existing hotspot data and accepts all three configured modes and sidebar sections', () => {
    expect(hotspotSchema.parse(seedVehicle.hotspots[0]).mode).toBeUndefined()
    for (const mode of ['in-place', 'zoom-in-place', 'zoom-sidebar']) {
      expect(hotspotSchema.parse({ ...seedVehicle.hotspots[0], mode, details: [{ heading: 'Details', text: 'Content' }] }).mode).toBe(mode)
    }
  })
})
