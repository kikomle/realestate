"use client"

import { useEffect, useRef } from "react"
import { useThree } from "@react-three/fiber"
import { gsap } from "gsap"
import * as THREE from "three"
import { computeFlyTarget, FLY_EASE, transitionDuration, type Bounds } from "@/lib/viewer/camera"

type Props = {
  focus: { name: string; bounds: Bounds } | null
  reducedMotion: boolean
  controlsRef: React.RefObject<{ target: THREE.Vector3; update: () => void } | null>
}

export function CameraRig({ focus, reducedMotion, controlsRef }: Props) {
  const camera = useThree((s) => s.camera)
  const tweenRef = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    if (!focus) return
    const controls = controlsRef.current
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45
    const { position, target } = computeFlyTarget(focus.bounds, fov)
    tweenRef.current?.kill()
    const duration = transitionDuration(reducedMotion)
    const end = { px: position[0], py: position[1], pz: position[2], tx: target[0], ty: target[1], tz: target[2] }
    const start = {
      px: camera.position.x,
      py: camera.position.y,
      pz: camera.position.z,
      tx: controls?.target.x ?? target[0],
      ty: controls?.target.y ?? target[1],
      tz: controls?.target.z ?? target[2],
    }
    const apply = (v: typeof start) => {
      camera.position.set(v.px, v.py, v.pz)
      controls?.target.set(v.tx, v.ty, v.tz)
      controls?.update()
    }
    if (duration === 0) {
      apply(end)
      return
    }
    const state = { ...start }
    tweenRef.current = gsap.to(state, {
      ...end,
      duration,
      ease: FLY_EASE,
      onUpdate: () => apply(state),
    })
    return () => {
      tweenRef.current?.kill()
    }
  }, [focus, camera, controlsRef, reducedMotion])

  return null
}
