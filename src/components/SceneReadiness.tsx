import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

/** Mounts inside the asset Suspense boundary; reveal only after completed GPU frames. */
export function SceneReadiness({ onReady, onProgress }: { onReady: (ready: boolean) => void; onProgress: (progress: number) => void }) {
  const { gl, invalidate } = useThree()
  const frames = useRef(0)
  const completing = useRef(false)
  const cancelled = useRef(false)
  const animationFrame = useRef(0)
  useEffect(() => {
    cancelled.current = false
    return () => { cancelled.current = true; cancelAnimationFrame(animationFrame.current) }
  }, [])
  useFrame(() => {
    if (completing.current) return
    frames.current++
    onProgress(90 + Math.min(frames.current, 3) * 3)
    if (frames.current < 3) { invalidate(); return }
    completing.current = true
    // Synchronize once on startup so texture upload, shadows, reflection and output
    // shaders have finished, rather than revealing a progressively drawn scene.
    gl.getContext().finish()
    void document.fonts.ready.then(() => {
      if (cancelled.current) return
      animationFrame.current = requestAnimationFrame(() => {
        animationFrame.current = requestAnimationFrame(() => {
          if (cancelled.current) return
          onProgress(100)
          onReady(true)
        })
      })
    })
  }, 2)
  return null
}
