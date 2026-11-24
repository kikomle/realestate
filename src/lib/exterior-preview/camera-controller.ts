import { gsap } from "gsap"
import {
  CAMERA_DURATION,
  VIEW_TRANSITION_DURATION,
  cameraLimits,
  cameraTarget,
  clamp,
  constrainCamera,
  defaultCameraTarget,
  validFrame,
  type CameraFrame,
  type CameraPosition,
} from "./camera"
import type { ExteriorImage, ExteriorPose, ExteriorView } from "./types"

export type ExteriorCamera = ReturnType<typeof createExteriorCamera>

/** DOM-only 2D camera. Each still has its own intrinsic frame; no image morph. */
export function createExteriorCamera(
  stage: HTMLDivElement,
  image: ExteriorImage,
  view: ExteriorView,
  reducedMotion: () => boolean,
  onChange: () => void,
  onSettled: () => void,
) {
  let viewport: CameraFrame = { width: 0, height: 0 }
  const position: CameraPosition = { x: 0, y: 0, scale: 1 }
  let tween: gsap.core.Tween | null = null
  let destination: CameraPosition | null = null
  let panning = false
  let destroyed = false
  let rememberedCenter: readonly [number, number] = [0.5, 0.5]
  let rememberedZoom = 1
  let framing: "default" | "focus" | "manual" = "default"

  function snapshot(): ExteriorPose | null {
    if (destroyed || !validFrame(image) || !validFrame(viewport)) return null
    return {
      ...position,
      view,
      viewId: image.id,
      imageWidth: image.width,
      imageHeight: image.height,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      zoom: position.scale / cameraLimits(image, viewport).cover,
      moving: tween !== null || panning,
    }
  }

  function paint() {
    stage.style.width = `${image.width}px`
    stage.style.height = `${image.height}px`
    stage.style.transform = `translate(${position.x}px, ${position.y}px) scale(${position.scale})`
    stage.dataset.cameraReady = "true"
    stage.dataset.moving = String(tween !== null || panning)
    stage.dataset.scale = String(position.scale)
    stage.dataset.panX = String(position.x)
    stage.dataset.panY = String(position.y)
  }

  function stop() {
    tween?.kill()
    tween = null
    destination = null
    panning = false
    stage.dataset.moving = "false"
    onChange()
  }

  function transition(next: CameraPosition, duration = CAMERA_DURATION) {
    stop()
    if (destroyed || !validFrame(image) || !validFrame(viewport)) return
    const target = constrainCamera(next, image, viewport)
    if (reducedMotion() || duration <= 0 || (
      Math.abs(target.scale - position.scale) < 0.00001 &&
      Math.hypot(target.x - position.x, target.y - position.y) < 0.05
    )) {
      Object.assign(position, target)
      paint()
      onChange()
      onSettled()
      return
    }
    destination = target
    tween = gsap.to(position, {
      ...target,
      duration,
      ease: "power2.inOut",
      onUpdate: paint,
      onComplete() {
        tween = null
        destination = null
        paint()
        onChange()
        onSettled()
      },
    })
    paint()
    onChange()
  }

  return {
    snapshot,
    stop,
    frame(focus?: readonly [number, number], zoom = 1, duration = VIEW_TRANSITION_DURATION) {
      framing = focus ? "focus" : "default"
      rememberedCenter = focus ?? [0.5, 0.5]
      rememberedZoom = zoom
      if (!validFrame(image) || !validFrame(viewport)) return
      transition(focus ? cameraTarget(image, viewport, focus, zoom) :
        defaultCameraTarget(image, viewport, view), duration)
    },
    resize(width: number, height: number) {
      const previous = snapshot()
      // Preserve the intended endpoint when resizing an interrupted focus tween.
      const basis = destination ?? position
      const focus: readonly [number, number] = previous ? [
        (viewport.width / 2 - basis.x) / (basis.scale * image.width),
        (viewport.height / 2 - basis.y) / (basis.scale * image.height),
      ] : rememberedCenter
      const zoom = previous ? basis.scale / cameraLimits(image, viewport).cover : rememberedZoom
      if (framing === "manual") {
        rememberedCenter = focus
        rememberedZoom = zoom
      }
      stop()
      viewport = { width, height }
      if (!validFrame(image) || !validFrame(viewport)) {
        onChange()
        return
      }
      const target = framing === "default" ? defaultCameraTarget(image, viewport, view) :
        framing === "focus" ? cameraTarget(image, viewport, rememberedCenter, rememberedZoom) :
          cameraTarget(image, viewport, focus, zoom)
      Object.assign(position, target)
      paint()
      onChange()
      if (previous) onSettled()
    },
    pan(x: number, y: number) {
      framing = "manual"
      stop()
      if (!validFrame(image) || !validFrame(viewport)) return
      panning = true
      Object.assign(position, constrainCamera({ x, y, scale: position.scale }, image, viewport))
      paint()
      onChange()
    },
    settle() {
      panning = false
      if (!snapshot()) return
      paint()
      onChange()
      onSettled()
    },
    zoom(direction: 1 | -1) {
      if (!snapshot()) return
      framing = "manual"
      const { cover, max } = cameraLimits(image, viewport)
      const scale = clamp(position.scale * Math.pow(1.19, direction), cover, max)
      const ratio = scale / position.scale
      transition({
        scale,
        x: viewport.width / 2 - (viewport.width / 2 - position.x) * ratio,
        y: viewport.height / 2 - (viewport.height / 2 - position.y) * ratio,
      })
    },
    finish() {
      if (destination) transition(destination, 0)
    },
    destroy() {
      destroyed = true
      stop()
      stage.style.removeProperty("width")
      stage.style.removeProperty("height")
      stage.style.removeProperty("transform")
      stage.dataset.cameraReady = "false"
    },
  }
}
