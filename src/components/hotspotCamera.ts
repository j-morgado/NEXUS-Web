import { MathUtils, Spherical, Vector3 } from 'three'

/** Keep the approach on the visible side of the selected anchor. */
export function closeupView(position: Vector3, anchor: Vector3) {
  const orbit = new Spherical().setFromVector3(position.clone().sub(anchor))
  orbit.radius = 2.8
  orbit.phi = MathUtils.clamp(orbit.phi, .55, 1.45)
  return { position: anchor.clone().add(new Vector3().setFromSpherical(orbit)), target: anchor.clone(), theta: orbit.theta, phi: orbit.phi, distance: orbit.radius }
}
export const closeupLimits = (theta: number, phi: number) => ({ minDistance: 2.35, maxDistance: 3.25, minAzimuthAngle: theta - .22, maxAzimuthAngle: theta + .22, minPolarAngle: Math.max(.1, phi - .16), maxPolarAngle: Math.min(Math.PI - .1, phi + .16) })
export const closeupResistanceZones = { distance: .3, azimuth: .14, polar: .1 }
const MIN_LIMIT_SPEED = .12

/** Smoothly reduce input toward a bound while leaving motion away from it unmodified. */
export function directionalLimitResistance(value: number, min: number, max: number, delta: number, zone: number) {
  if (!delta || !Number.isFinite(delta)) return 1
  const bound = delta < 0 ? min : max
  if (!Number.isFinite(bound)) return 1
  const room = Math.max(0, delta < 0 ? value - bound : bound - value)
  const anticipatedRoom = Math.max(0, room - Math.abs(delta))
  if (anticipatedRoom >= zone) return 1
  const t = Math.min(1, anticipatedRoom / zone)
  const smooth = t * t * (3 - 2 * t)
  return MIN_LIMIT_SPEED + (1 - MIN_LIMIT_SPEED) * smooth
}

export function unwrapAngleNear(value: number, reference: number) {
  return reference + MathUtils.euclideanModulo(value - reference + Math.PI, Math.PI * 2) - Math.PI
}

export function angularLimitResistance(value: number, min: number, max: number, delta: number, zone: number) {
  return directionalLimitResistance(unwrapAngleNear(value, (min + max) / 2), min, max, delta, zone)
}

export function closeupGestureResistance({ theta, phi, distance, thetaDelta = 0, phiDelta = 0, distanceDelta = 0, limits }: { theta: number; phi: number; distance: number; thetaDelta?: number; phiDelta?: number; distanceDelta?: number; limits: ReturnType<typeof closeupLimits> }) {
  return Math.min(
    angularLimitResistance(theta, limits.minAzimuthAngle, limits.maxAzimuthAngle, thetaDelta, closeupResistanceZones.azimuth),
    directionalLimitResistance(phi, limits.minPolarAngle, limits.maxPolarAngle, phiDelta, closeupResistanceZones.polar),
    directionalLimitResistance(distance, limits.minDistance, limits.maxDistance, distanceDelta, closeupResistanceZones.distance),
  )
}
export const normalLimits = { minDistance: 5.5, maxDistance: 16, minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity, minPolarAngle: .55, maxPolarAngle: 1.535 }
export const sidebarWidth = (width: number) => width < 700 ? Math.min(320, width * .46) : 360
