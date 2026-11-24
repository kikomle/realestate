"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { Canvas } from "@react-three/fiber"
import * as THREE from "three"
import { Skeleton } from "@/components/ui/skeleton"
import { ModelScene, type Selection } from "./ModelScene"
import { Picker } from "./Picker"
import { ModelSelector } from "./ModelSelector"
import { ViewerErrorBoundary } from "./ViewerErrorBoundary"
import { readReducedMotion } from "@/lib/viewer/reduced-motion"
import { resolveModelUrl } from "@/lib/viewer/model-url"

type Props = {
  requestedModel?: string | null
}

type LoadState = "loading" | "ready-to-mount" | "ready" | "error"
type Capability = "unknown" | "webgl" | "no-webgl"

function detectWebGL(): Capability {
  try {
    const canvas = document.createElement("canvas")
    return canvas.getContext("webgl2") || canvas.getContext("webgl") ? "webgl" : "no-webgl"
  } catch {
    return "no-webgl"
  }
}

export function SceneViewer({ requestedModel }: Props) {
  const url = resolveModelUrl(requestedModel)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [state, setState] = useState<LoadState>("loading")
  const [capability] = useState<Capability>(() => (typeof window === "undefined" ? "unknown" : detectWebGL()))
  const [reducedMotion] = useState(() => (typeof window === "undefined" ? false : readReducedMotion(window)))

  const onReady = useCallback(() => setState("ready"), [])
  const onSelect = useCallback((sel: Selection) => setSelection(sel), [])

  useEffect(() => {
    const probe = new AbortController()
    fetch(url, { method: "HEAD", signal: probe.signal })
      .then((r) => setState(r.ok ? "ready-to-mount" : "error"))
      .catch(() => {
        if (!probe.signal.aborted) setState("error")
      })
    return () => probe.abort()
  }, [url])


  if (capability === "no-webgl") {
    return (
      <div className="flex flex-col gap-4" data-testid="webgl-fallback">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-card">
          <Image src="/viewer/poster.svg" alt="Static poster of the placeholder building" fill sizes="100vw" className="object-cover" priority />
        </div>
        <p className="text-sm text-muted-foreground">
          Interactive 3D is not available on this device. The static poster is shown instead.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4" data-testid="scene-viewer" data-state={state}>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-card md:aspect-[16/10]">
        {state === "loading" && (
          <div className="absolute inset-0 z-10" data-testid="viewer-loading">
            <Skeleton className="h-full w-full rounded-none" />
          </div>
        )}
        {state === "error" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center text-sm" role="alert" data-testid="viewer-error">
            Could not load the model at {url}.
          </div>
        )}
        {capability === "webgl" && (state === "ready-to-mount" || state === "ready") && (
          <ViewerErrorBoundary
            fallback={<div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center text-sm" role="alert" data-testid="viewer-error">Could not render the 3D scene.</div>}
          >
          <Canvas
            className="h-full w-full"
            shadows
            dpr={[1, 2]}
            camera={{ position: [28, 22, 28], fov: 35, near: 0.1, far: 500 }}
            onPointerMissed={() => setSelection(null)}
            gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
          >
            <ModelScene
              url={url}
              reducedMotion={reducedMotion}
              selectedName={selection?.name ?? null}
              onSelect={onSelect}
              onReady={onReady}
            />
          </Canvas>
          </ViewerErrorBoundary>
        )}
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <Picker selection={selection} onClear={() => setSelection(null)} />
        <ModelSelector current={url} />
      </div>
    </div>
  )
}
