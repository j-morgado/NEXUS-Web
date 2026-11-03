import { MathUtils, Spherical, Vector3 } from 'three'

/** Keep the approach on the visible side of the selected anchor. */
export function closeupView(position: Vector3, anchor: Vector3) {
  const orbit = new Spherical().setFromVector3(position.clone().sub(anchor))
  orbit.radius = 2.8
  orbit.phi = MathUtils.clamp(orbit.phi, .55, 1.45)
  return { position: anchor.clone().add(new Vector3().setFromSpherical(orbit)), target: anchor.clone(), theta: orbit.theta, phi: orbit.phi, distance: orbit.radius }
}
export const closeupLimits = (theta: number, phi: number) => ({ minDistance: 2.35, maxDistance: 3.25, minAzimuthAngle: theta - .22, maxAzimuthAngle: theta + .22, minPolarAngle: Math.max(.1, phi - .16), maxPolarAngle: Math.min(Math.PI - .1, phi + .16) })
export const normalLimits = { minDistance: 5.5, maxDistance: 16, minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity, minPolarAngle: .55, maxPolarAngle: 1.535 }
export const sidebarWidth = (width: number) => width < 700 ? Math.min(320, width * .46) : 360
