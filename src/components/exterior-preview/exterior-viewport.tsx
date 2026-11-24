"use client"

import {
  forwardRef,
  useCallback,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { gsap } from "gsap"
import { CROSSFADE_DURATION, validExteriorBands, validFrame } from "@/lib/exterior-preview/camera"
import { createExteriorCamera, type ExteriorCamera } from "@/lib/exterior-preview/camera-controller"
import { EXTERIOR_IMAGE_SIZES } from "@/lib/exterior-preview/types"
import type {
  ExteriorImage,
  ExteriorPose,
  ExteriorView,
  ExteriorViewportHandle,
  ExteriorViewportProps,
} from "@/lib/exterior-preview/types"
import styles from "./exterior-viewport.module.css"

export type {
  ExteriorBand,
  ExteriorImage,
  ExteriorPose,
  ExteriorView,
  ExteriorViewportHandle,
  ExteriorViewportProps,
} from "@/lib/exterior-preview/types"

type AssetStatus = "loading" | "ready" | "error"
const VIEWS = ["arrival", "facade"] as const
const MOTION_QUERY = "(prefers-reduced-motion: reduce)"

/**
 * Private engineering primitive, NOT a selector or a registration approval.
 * The client orchestrator owns URL state, equivalent text links, source/version
 * validation and any subsequent Stage 4 transition. No route/data is fetched.
 * Supply only stage-authorized derivative URLs; never raw source-file URLs.
 * A changed image descriptor remounts the camera and its loading/fallback state.
 */
export const ExteriorViewport = forwardRef<ExteriorViewportHandle, ExteriorViewportProps>(
  function ExteriorViewport(props, ref) {
    const imageVersion = JSON.stringify(VIEWS.map(view => props.images[view]))
    return <ViewportEngine key={imageVersion} {...props} ref={ref} />
  },
)

const ViewportEngine = forwardRef<ExteriorViewportHandle, ExteriorViewportProps>(
  function ViewportEngine({
    images, bands, view, selectedFloorId, hoveredFloorId,
    onFloorSelect, onFloorHover, onSettled,
  }, ref) {
    // The outer keyed boundary makes image descriptors immutable for this mount.
    const [fixedImages] = useState(images)
    const [initialView] = useState(view)
    const [assets, setAssets] = useState<Record<ExteriorView, AssetStatus>>({
      arrival: "loading", facade: "loading",
    })
    const safeBands = useMemo(() => validExteriorBands(bands), [bands])
    const selected = safeBands.find(band => band.id === selectedFloorId)
    const focusX = selected?.focus[0]
    const focusY = selected?.focus[1]
    const focusZoom = selected?.zoom
    const rootRef = useRef<HTMLDivElement>(null)
    const overlayRef = useRef<SVGSVGElement>(null)
    const stages = useRef<Record<ExteriorView, HTMLDivElement | null>>({ arrival: null, facade: null })
    const layers = useRef<Record<ExteriorView, HTMLDivElement | null>>({ arrival: null, facade: null })
    const cameras = useRef<Partial<Record<ExteriorView, ExteriorCamera>>>({})
    const motion = useRef<MediaQueryList | null>(null)
    const fade = useRef<gsap.core.Tween | null>(null)
    const cancelGesture = useRef<(() => void) | null>(null)
    const presentation = useRef({ revealed: false, fading: false, shown: initialView })
    const latest = useRef({ view, assets, onFloorSelect, onFloorHover, onSettled })
    const instructionsId = useId()

    useLayoutEffect(() => {
      latest.current = { view, assets, onFloorSelect, onFloorHover, onSettled }
    })

    const getPose = useCallback((): ExteriorPose | null => {
      const current = latest.current
      if (current.assets[current.view] !== "ready") return null
      const pose = cameras.current[current.view]?.snapshot()
      return pose ? { ...pose, moving: pose.moving || presentation.current.fading } : null
    }, [])

    const paintMoving = useCallback(() => {
      const root = rootRef.current
      if (!root) return
      const pose = cameras.current[latest.current.view]?.snapshot()
      root.dataset.moving = String(Boolean(pose?.moving || presentation.current.fading))
    }, [])

    const publishSettlement = useCallback(() => {
      if (!presentation.current.revealed || presentation.current.shown !== latest.current.view) return
      const pose = getPose()
      if (pose && !pose.moving) latest.current.onSettled?.(pose)
    }, [getPose])

    // Kept imperative with the fade: no focusable/hit-testable map may precede
    // its own opaque still, including during a rapid interrupted view change.
    const syncOverlay = useCallback(() => {
      const overlay = overlayRef.current
      if (!overlay) return
      const current = latest.current
      const available = current.view === "facade" && current.assets.facade === "ready" &&
        presentation.current.revealed && presentation.current.shown === "facade" &&
        !presentation.current.fading && validFrame(fixedImages.facade)
      overlay.dataset.ready = String(available)
      overlay.setAttribute("aria-hidden", String(!available))
      overlay.querySelectorAll<SVGGElement>("[data-band-id]").forEach(node => {
        node.setAttribute("tabindex", available ? "0" : "-1")
      })
      if (!available && overlay.contains(document.activeElement)) {
        rootRef.current?.focus({ preventScroll: true })
      }
    }, [fixedImages])

    useLayoutEffect(() => {
      const root = rootRef.current
      if (!root) return
      motion.current = window.matchMedia(MOTION_QUERY)
      for (const name of VIEWS) {
        const stage = stages.current[name]
        if (stage) cameras.current[name] = createExteriorCamera(
          stage, fixedImages[name], name, () => motion.current?.matches ?? true,
          paintMoving, () => { if (latest.current.view === name) publishSettlement() },
        )
      }
      function resize() {
        const width = root!.clientWidth
        const height = root!.clientHeight
        cancelGesture.current?.()
        for (const name of VIEWS) cameras.current[name]?.resize(width, height)
        syncOverlay()
      }
      function motionChanged() {
        if (!motion.current?.matches) return
        for (const name of VIEWS) cameras.current[name]?.finish()
        fade.current?.progress(1)
      }
      resize()
      const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize)
      observer?.observe(root)
      window.addEventListener("resize", resize)
      motion.current.addEventListener("change", motionChanged)
      return () => {
        observer?.disconnect()
        window.removeEventListener("resize", resize)
        motion.current?.removeEventListener("change", motionChanged)
        fade.current?.kill()
        fade.current = null
        for (const name of VIEWS) cameras.current[name]?.destroy()
        cameras.current = {}
      }
    }, [fixedImages, paintMoving, publishSettlement, syncOverlay])

    // Only meaningful selection changes reframe the camera, not hover, loading,
    // callback identity or a newly allocated bands array from orchestration.
    useLayoutEffect(() => {
      cancelGesture.current?.()
      for (const name of VIEWS) cameras.current[name]?.stop()
      const focus: readonly [number, number] | undefined = view === "facade" &&
        focusX !== undefined && focusY !== undefined ? [focusX, focusY] : undefined
      cameras.current[view]?.frame(focus, view === "facade" ? focusZoom : 1)
    }, [view, selectedFloorId, focusX, focusY, focusZoom])

    useLayoutEffect(() => {
      let cancelled = false
      const state = presentation.current
      fade.current?.kill()
      fade.current = null
      state.revealed = false
      state.fading = false
      syncOverlay()
      paintMoving()
      const facade = layers.current.facade
      const arrival = layers.current.arrival
      if (!facade || !arrival) return
      // The lower still remains opaque; only actual stills are crossfaded.
      // Each has its OWN 2D camera: no interpolated perspective or fake 3D.
      arrival.style.opacity = "1"
      if (assets[view] !== "ready") return
      const opacity = view === "facade" ? 1 : 0
      function complete() {
        if (cancelled) return
        fade.current = null
        state.shown = view
        state.revealed = true
        state.fading = false
        if (rootRef.current) rootRef.current.dataset.displayedView = view
        syncOverlay()
        paintMoving()
        publishSettlement()
      }
      if (motion.current?.matches || Math.abs(Number(gsap.getProperty(facade, "opacity")) - opacity) < 0.001) {
        gsap.set(facade, { opacity })
        complete()
      } else {
        state.fading = true
        paintMoving()
        fade.current = gsap.to(facade, {
          opacity, duration: CROSSFADE_DURATION, ease: "power2.inOut", onComplete: complete,
        })
      }
      return () => {
        cancelled = true
        fade.current?.kill()
        fade.current = null
      }
    }, [view, assets, syncOverlay, paintMoving, publishSettlement])

    useLayoutEffect(syncOverlay)

    useImperativeHandle(ref, () => ({
      reset() {
        cancelGesture.current?.()
        cameras.current[latest.current.view]?.frame()
      },
      zoom(direction) {
        cancelGesture.current?.()
        cameras.current[latest.current.view]?.zoom(direction)
      },
      getPose,
    }), [getPose])

    useLayoutEffect(() => {
      const root = rootRef.current
      if (!root) return
      let drag: { id: number; x: number; y: number; pose: ExteriorPose | null; moved: boolean } | null = null
      const pointers = new Set<number>()
      let suppressUntil = 0

      function endDrag(cancelled: boolean) {
        if (drag?.moved || cancelled) suppressUntil = performance.now() + 700
        const id = drag?.id
        const moved = drag?.moved
        drag = null
        root!.dataset.dragging = "false"
        if (id !== undefined && root!.hasPointerCapture(id)) root!.releasePointerCapture(id)
        if (moved) cameras.current[latest.current.view]?.settle()
      }
      const cancel = () => {
        pointers.clear()
        endDrag(true)
      }
      cancelGesture.current = cancel
      function down(event: PointerEvent) {
        pointers.add(event.pointerId)
        if (pointers.size > 1) { endDrag(true); return }
        if (!event.isPrimary || event.button !== 0 || !getPose() || presentation.current.fading) return
        suppressUntil = 0
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, pose: null }
      }
      function move(event: PointerEvent) {
        if (!drag || drag.id !== event.pointerId || pointers.size !== 1) return
        const dx = event.clientX - drag.x
        const dy = event.clientY - drag.y
        if (!drag.moved && Math.hypot(dx, dy) < 8) return
        if (!drag.moved) {
          // Vertical touch is the page's, and multi-touch is the browser's.
          if (event.pointerType === "touch" && Math.abs(dy) >= Math.abs(dx)) {
            endDrag(true)
            return
          }
          cameras.current[latest.current.view]?.stop()
          drag.pose = getPose()
          if (!drag.pose) { endDrag(true); return }
          drag.moved = true
          root!.setPointerCapture(event.pointerId)
          root!.dataset.dragging = "true"
          latest.current.onFloorHover(null)
        }
        if (drag.pose) cameras.current[latest.current.view]?.pan(drag.pose.x + dx, drag.pose.y + dy)
      }
      function up(event: PointerEvent) {
        pointers.delete(event.pointerId)
        if (drag?.id === event.pointerId) endDrag(event.type !== "pointerup")
      }
      function leave(event: PointerEvent) {
        if (!root!.hasPointerCapture(event.pointerId)) up(event)
      }
      function click(event: MouseEvent) {
        if (event.detail === 0 || performance.now() >= suppressUntil) return
        event.preventDefault()
        event.stopPropagation()
      }
      root.addEventListener("pointerdown", down)
      root.addEventListener("pointermove", move)
      root.addEventListener("pointerleave", leave)
      root.addEventListener("lostpointercapture", up)
      root.addEventListener("click", click, true)
      window.addEventListener("pointerup", up)
      window.addEventListener("pointercancel", up)
      window.addEventListener("blur", cancel)
      return () => {
        if (cancelGesture.current === cancel) cancelGesture.current = null
        root.removeEventListener("pointerdown", down)
        root.removeEventListener("pointermove", move)
        root.removeEventListener("pointerleave", leave)
        root.removeEventListener("lostpointercapture", up)
        root.removeEventListener("click", click, true)
        window.removeEventListener("pointerup", up)
        window.removeEventListener("pointercancel", up)
        window.removeEventListener("blur", cancel)
        endDrag(false)
      }
    }, [getPose])

    const imageStatus = useCallback((name: ExteriorView, status: AssetStatus) => {
      setAssets(current => current[name] === status ? current : { ...current, [name]: status })
    }, [])

    function keyboardCamera(event: KeyboardEvent<HTMLDivElement>) {
      if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return
      const camera = cameras.current[view]
      const pose = getPose()
      if (!camera || !pose) return
      if (event.key === "Home") camera.frame()
      else if (event.key === "+" || event.key === "=") camera.zoom(1)
      else if (event.key === "-" || event.key === "−") camera.zoom(-1)
      else {
        const delta: Record<string, readonly [number, number]> = {
          ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40],
        }
        const change = delta[event.key]
        if (!change) return
        camera.pan(pose.x + change[0], pose.y + change[1])
        camera.settle()
      }
      event.preventDefault()
    }

    function selectBand(id: string) {
      if (overlayRef.current?.dataset.ready === "true") onFloorSelect(id)
    }

    return (
      <div
        ref={rootRef}
        className={styles.viewport}
        data-exterior-viewport=""
        data-view={view}
        data-moving="false"
        data-dragging="false"
        data-asset-state={assets[view]}
        data-band-count={safeBands.length}
        role="group"
        aria-label="Privatni pregled vanjskog prikaza"
        aria-describedby={instructionsId}
        tabIndex={0}
        onKeyDown={keyboardCamera}
      >
        {VIEWS.map(name => (
          <div
            key={name}
            ref={node => { layers.current[name] = node }}
            className={styles.layer}
            data-exterior-layer={name}
            style={{ opacity: initialView === name ? 1 : 0 }}
            aria-hidden={view !== name}
          >
            <div
              ref={node => { stages.current[name] = node }}
              className={styles.stage}
              data-camera-stage={name}
              data-image-id={fixedImages[name].id}
              data-camera-ready="false"
              data-moving="false"
            >
              <StillImage
                image={fixedImages[name]}
                view={name}
                status={assets[name]}
                primary={initialView === name}
                onStatus={imageStatus}
              />
              {name === "facade" ? (
                <svg
                  ref={overlayRef}
                  className={styles.overlay}
                  viewBox={`0 0 ${fixedImages.facade.width} ${fixedImages.facade.height}`}
                  preserveAspectRatio="none"
                  data-overlay-group="exterior-floors"
                  data-image-id={fixedImages.facade.id}
                  data-ready="false"
                  aria-hidden="true"
                  aria-label="Etaže na pročelju"
                >
                  {safeBands.map(band => (
                    <g
                      key={band.id}
                      className={styles.band}
                      role="button"
                      tabIndex={-1}
                      aria-label={band.label}
                      aria-pressed={selectedFloorId === band.id}
                      data-band-id={band.id}
                      data-selected={selectedFloorId === band.id}
                      data-hovered={hoveredFloorId === band.id}
                      onClick={() => selectBand(band.id)}
                      onKeyDown={event => {
                        if (event.key !== "Enter" && event.key !== " ") return
                        event.preventDefault()
                        if (!event.repeat) selectBand(band.id)
                      }}
                      onPointerEnter={event => { if (event.pointerType === "mouse") onFloorHover(band.id) }}
                      onPointerLeave={() => onFloorHover(null)}
                      onFocus={event => {
                        onFloorHover(band.id)
                        // A cover crop can leave a valid band offscreen. Keyboard
                        // focus must reveal that target, not just a clipped ring.
                        const root = rootRef.current
                        if (!root || overlayRef.current?.dataset.ready !== "true") return
                        const target = event.currentTarget.getBoundingClientRect()
                        const viewport = root.getBoundingClientRect()
                        if (target.right <= viewport.left || target.left >= viewport.right ||
                          target.bottom <= viewport.top || target.top >= viewport.bottom) {
                          cameras.current.facade?.frame(band.focus, band.zoom)
                        }
                      }}
                      onBlur={() => onFloorHover(null)}
                    >
                      <title>{band.label}</title>
                      {band.polygons.map((polygon, index) => (
                        <polygon
                          key={index}
                          className={styles.polygon}
                          points={polygon.map(([x, y]) => `${x * fixedImages.facade.width},${y * fixedImages.facade.height}`).join(" ")}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                    </g>
                  ))}
                </svg>
              ) : null}
            </div>
          </div>
        ))}
        <p id={instructionsId} className={styles.srOnly}>
          Strelice pomiču prikaz; plus i minus mijenjaju povećanje; Home vraća kadar.
          Na dodirnom zaslonu povucite vodoravno za pomak. Povećanje preglednika ostaje dostupno.
          Etaže možete odabrati i s popisa izvan prikaza.
        </p>
        <p className={styles.message} role="status" hidden={assets[view] === "ready"} data-image-message="">
          {assets[view] === "error" ? "Traženi prikaz nije dostupan. Koristite tekstualni popis etaža." : "Učitavanje prikaza…"}
        </p>
      </div>
    )
  },
)

function StillImage({ image, view, status, primary, onStatus }: {
  image: ExteriorImage
  view: ExteriorView
  status: AssetStatus
  primary: boolean
  onStatus: (view: ExteriorView, status: AssetStatus) => void
}) {
  const [format, setFormat] = useState<"preferred" | "webp" | "base" | "error">("preferred")
  const imgRef = useRef<HTMLImageElement>(null)

  const fail = useCallback(() => {
    if (format === "error") return
    const next = format === "preferred" && image.webpSrcSet ? "webp" :
      format === "preferred" || format === "webp" ? "base" : "error"
    onStatus(view, next === "error" ? "error" : "loading")
    setFormat(next)
  }, [format, image.webpSrcSet, onStatus, view])

  const loaded = useCallback((img: HTMLImageElement) => {
    if (format === "error") return
    // Responsive naturalWidth is density-corrected and may round by a pixel.
    const valid = validFrame(image) && img.naturalWidth > 0 && img.naturalHeight > 0 &&
      Math.abs(img.naturalHeight - img.naturalWidth * image.height / image.width) <= 2
    if (valid) onStatus(view, "ready")
    else fail()
  }, [image, format, fail, onStatus, view])

  useLayoutEffect(() => {
    let cancelled = false
    // Catch an image that finished before hydration without synchronous state
    // updates during the commit, and ignore old work after remount/Strict Mode.
    queueMicrotask(() => {
      const img = imgRef.current
      if (cancelled || format === "error" || !img?.complete) return
      loaded(img)
    })
    return () => { cancelled = true }
  }, [format, loaded])

  return (
    <picture
      className={styles.picture}
      data-exterior-image={view}
      data-image-id={image.id}
      data-image-state={status}
      data-image-format={format}
      data-image-fallback={format !== "preferred"}
    >
      {format === "preferred" && image.avifSrcSet ? (
        <source type="image/avif" srcSet={image.avifSrcSet} sizes={EXTERIOR_IMAGE_SIZES} />
      ) : null}
      {(format === "preferred" || format === "webp") && image.webpSrcSet ? (
        <source type="image/webp" srcSet={image.webpSrcSet} sizes={EXTERIOR_IMAGE_SIZES} />
      ) : null}
      {/* Authorized derivatives must bypass Next image optimization/proxying. */}
      <img
        key={format === "error" ? "base" : format}
        ref={imgRef}
        className={styles.image}
        src={image.src}
        width={image.width}
        height={image.height}
        alt={image.alt}
        draggable={false}
        decoding="async"
        fetchPriority={primary ? "high" : "low"}
        onLoad={event => loaded(event.currentTarget)}
        onError={fail}
      />
    </picture>
  )
}
