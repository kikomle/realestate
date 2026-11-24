"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AdaptiveDpr, Environment, OrbitControls, PerformanceMonitor, useGLTF } from "@react-three/drei"
import { useThree, type ThreeEvent } from "@react-three/fiber"
import * as THREE from "three"
import type { Bounds } from "@/lib/viewer/camera"
import { buildNodeMetadata, type NodeMetadata } from "@/lib/viewer/metadata"
import { CameraRig } from "./CameraRig"

export type Selection = {
  name: string
  bounds: Bounds
  metadata: NodeMetadata
}

export type ViewerTestApi = {
  ready: boolean
  getCameraPosition: () => [number, number, number]
  getTarget: () => [number, number, number] | null
  getSelected: () => string | null
  getNodeScreenPoint: (name: string) => { x: number; y: number } | null
  selectNode: (name: string) => boolean
}

declare global {
  interface Window {
    __viewer?: ViewerTestApi
  }
}

type Props = {
  url: string
  reducedMotion: boolean
  selectedName: string | null
  onSelect: (sel: Selection) => void
  onReady: () => void
}

const HIGHLIGHT = new THREE.Color("#b5651d")
const BLACK = new THREE.Color(0, 0, 0)

type ControlsHandle = { target: THREE.Vector3; update: () => void }

function boundsOf(obj: THREE.Object3D): Bounds {
  const box = new THREE.Box3().setFromObject(obj)
  return {
    min: box.min.toArray() as Bounds["min"],
    max: box.max.toArray() as Bounds["max"],
  }
}

export function ModelScene({ url, reducedMotion, selectedName, onSelect, onReady }: Props) {
  const { scene } = useGLTF(url)
  const controlsRef = useRef<ControlsHandle | null>(null)
  const [focus, setFocus] = useState<{ name: string; bounds: Bounds } | null>(null)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const originalEmissive = useRef(new WeakMap<THREE.Material, THREE.Color>())

  const meshes = useMemo(() => {
    const list: THREE.Mesh[] = []
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) list.push(o)
    })
    return list
  }, [scene])

  const findNode = useCallback(
    (name: string): THREE.Object3D | null => {
      let found: THREE.Object3D | null = null
      scene.traverse((o) => {
        if (!found && o.name === name) found = o
      })
      return found
    },
    [scene],
  )

  useEffect(() => {
    meshes.forEach((m) => {
      m.castShadow = true
      m.receiveShadow = true
    })
  }, [meshes])

  useEffect(() => {
    onReady()
  }, [onReady])

  useEffect(() => {
    meshes.forEach((m) => {
      const mat = m.material
      if (!(mat instanceof THREE.MeshStandardMaterial)) return
      if (!originalEmissive.current.has(mat)) originalEmissive.current.set(mat, mat.emissive.clone())
      const isSel = m.name === selectedName
      mat.emissive.copy(isSel ? HIGHLIGHT : (originalEmissive.current.get(mat) ?? BLACK))
      mat.emissiveIntensity = isSel ? 0.35 : 1
    })
  }, [selectedName, meshes])

  useEffect(() => {
    const api: ViewerTestApi = {
      ready: true,
      getCameraPosition: () => camera.position.toArray() as [number, number, number],
      getTarget: () => (controlsRef.current ? (controlsRef.current.target.toArray() as [number, number, number]) : null),
      getSelected: () => selectedName,
      getNodeScreenPoint: (name) => {
        const node = findNode(name)
        if (!node) return null
        const box = new THREE.Box3().setFromObject(node)
        const c = box.getCenter(new THREE.Vector3()).project(camera)
        const rect = gl.domElement.getBoundingClientRect()
        return {
          x: rect.left + ((c.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - c.y) / 2) * rect.height,
        }
      },
      selectNode: (name) => {
        const node = findNode(name)
        if (!node) return false
        const bounds = boundsOf(node)
        onSelect({ name, bounds, metadata: buildNodeMetadata(name, node.userData) })
        setFocus({ name, bounds })
        return true
      },
    }
    window.__viewer = api
    return () => {
      delete window.__viewer
    }
  }, [camera, gl, findNode, onSelect, selectedName])

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const obj = e.object
    const bounds = boundsOf(obj)
    onSelect({ name: obj.name, bounds, metadata: buildNodeMetadata(obj.name, obj.userData) })
    setFocus({ name: obj.name, bounds })
  }

  return (
    <>
      <PerformanceMonitor />
      <AdaptiveDpr pixelated={false} />
      <hemisphereLight args={["#f4efe6", "#6b655c", 0.6]} />
      <directionalLight
        position={[12, 20, 10]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-bias={-0.0005}
      />
      <Environment preset="city" environmentIntensity={0.4} />
      <primitive object={scene} onClick={handleClick} />
      <OrbitControls ref={controlsRef as never} makeDefault enableDamping dampingFactor={0.08} />
      <CameraRig focus={focus} reducedMotion={reducedMotion} controlsRef={controlsRef} />
    </>
  )
}

export function preloadModel(url: string) {
  useGLTF.preload(url)
}
