import { useEffect, useState } from 'react'
export type RenderStats = { fps: number; cpuMs: number; calls: number; triangles: number; geometries: number; textures: number; timestamp: number }
export function PerformanceStats({ sceneActive }: { sceneActive: boolean }) {
  const [stats, setStats] = useState<RenderStats | null>(null)
  const [now, setNow] = useState(0)
  useEffect(() => {
    const receive = (event: Event) => setStats((event as CustomEvent<RenderStats>).detail)
    window.addEventListener('nexus:render-stats', receive)
    const timer = window.setInterval(() => setNow(performance.now()), 500)
    return () => { clearInterval(timer); window.removeEventListener('nexus:render-stats', receive) }
  }, [])
  const idle = !sceneActive || !stats || now - stats.timestamp > 1000
  return <aside className="performance-stats" aria-label="Performance stats"><strong>{!sceneActive ? '3D scene inactive' : idle ? 'Idle · demand rendering' : `${stats.fps.toFixed(0)} FPS`}</strong>{sceneActive && stats && <><span>CPU submit {stats.cpuMs.toFixed(1)} ms</span><span>{stats.calls} draw calls · {stats.triangles.toLocaleString()} triangles</span><span>{stats.geometries} geometries · {stats.textures} textures</span></>}</aside>
}
