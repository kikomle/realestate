"use client";

import gsap from "gsap";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { keepPlanInFrame, PLAN_HOME, PLAN_MAX_ZOOM, zoomPlanAt } from "@/lib/exterior-preview/apartment-plan-camera";
import type { ApartmentPlanMedia } from "@/lib/exterior-preview/apartment-detail";
import type { CameraPosition } from "@/lib/exterior-preview/camera";
import styles from "./apartment-detail.module.css";
import accessibility from "./apartment-a11y.module.css";

type Point = { x: number; y: number };
const ZOOM_STEP = Math.SQRT2;
const PLAN_INSET = 12;
const motionPreference = "(prefers-reduced-motion: reduce)";
const zoomPercent = (scale: number) => Math.round(scale * 100);
const distance = (a: Point, b: Point) => Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const pointAt = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY });

export function ApartmentPlanView({ unitId, plan }: { unitId: string; plan: ApartmentPlanMedia }) {
  const view = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const tween = useRef<gsap.core.Tween | null>(null);
  const pose = useRef<CameraPosition>({ ...PLAN_HOME });
  const target = useRef<CameraPosition>({ ...PLAN_HOME });
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ pose: CameraPosition; centre: Point; span: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [announcedZoom, setAnnouncedZoom] = useState(100);
  const [dragging, setDragging] = useState(false);
  const [imageState, setImageState] = useState<"pending" | "ready" | "error">("pending");
  const ready = imageState === "ready";

  const apply = useCallback((next: CameraPosition) => {
    pose.current = next;
    if (art.current) art.current.style.transform = `translate3d(${next.x}px, ${next.y}px, 0) scale(${next.scale})`;
  }, []);

  const stopTween = useCallback(() => {
    tween.current?.kill();
    tween.current = null;
  }, []);

  const moveTo = useCallback((next: CameraPosition, smooth: boolean) => {
    const el = view.current;
    if (!el || el.clientWidth === 0 || el.clientHeight === 0) return;
    const nextPose = keepPlanInFrame(next, plan, { width: el.clientWidth, height: el.clientHeight }, PLAN_INSET);
    stopTween();
    target.current = nextPose;
    setZoom(nextPose.scale);
    if (!pointers.current.size) setAnnouncedZoom(zoomPercent(nextPose.scale));
    if (smooth && !window.matchMedia(motionPreference).matches) {
      const interpolated = { ...pose.current };
      tween.current = gsap.to(interpolated, {
        ...nextPose, duration: 0.24, ease: "power2.out",
        onUpdate: () => apply({ x: interpolated.x, y: interpolated.y, scale: interpolated.scale }),
        onComplete: () => { tween.current = null; },
      });
    } else {
      apply(nextPose);
    }
  }, [apply, plan, stopTween]);

  useEffect(() => {
    const el = view.current;
    if (!el) return;
    const observer = new ResizeObserver(() => moveTo(target.current, false));
    observer.observe(el);
    const motion = window.matchMedia(motionPreference);
    const reduce = (event: MediaQueryListEvent) => {
      if (!event.matches || !tween.current) return;
      stopTween();
      apply(target.current);
    };
    motion.addEventListener("change", reduce);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", reduce);
      stopTween();
    };
  }, [apply, moveTo, stopTween]);

  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete) setImageState(image.naturalWidth ? "ready" : "error");
  }, []);

  function zoomBy(direction: 1 | -1) {
    const current = target.current;
    if (direction > 0 ? current.scale >= PLAN_MAX_ZOOM : current.scale <= 1) return;
    const desired = current.scale * (direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    moveTo(zoomPlanAt(current, desired >= 3.9999 ? PLAN_MAX_ZOOM : desired <= 1.0001 ? 1 : desired), true);
  }

  function keyPan(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "+" || event.key === "=") zoomBy(1);
    else if (event.key === "-") zoomBy(-1);
    else if (event.key === "0" || event.key === "Home") moveTo(PLAN_HOME, true);
    else {
      if (target.current.scale === 1) return;
      const { x, y, scale } = target.current;
      const offset = 52;
      switch (event.key) {
        case "ArrowLeft": moveTo({ x: x + offset, y, scale }, true); break;
        case "ArrowRight": moveTo({ x: x - offset, y, scale }, true); break;
        case "ArrowUp": moveTo({ x, y: y + offset, scale }, true); break;
        case "ArrowDown": moveTo({ x, y: y - offset, scale }, true); break;
        default: return;
      }
    }
    event.preventDefault();
  }

  function start(event: PointerEvent<HTMLDivElement>) {
    if (!ready || event.button !== 0 || pointers.current.size >= 2 ||
        (event.pointerType !== "touch" && target.current.scale === 1)) return;
    const point = pointAt(event);
    pointers.current.set(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);
    stopTween();
    target.current = pose.current;
    setZoom(pose.current.scale);
    const [a, b] = pointers.current.values();
    if (b) {
      const rect = event.currentTarget.getBoundingClientRect();
      const centre = midpoint(a, b);
      gesture.current = {
        pose: pose.current, span: distance(a, b),
        centre: { x: centre.x - rect.left - rect.width / 2, y: centre.y - rect.top - rect.height / 2 },
      };
    }
    setDragging(true);
  }

  function drag(event: PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(event.pointerId);
    if (!prev) return;
    const next = pointAt(event);
    pointers.current.set(event.pointerId, next);
    const [a, b] = pointers.current.values();
    const pinch = gesture.current;
    if (pinch && b) {
      const rect = event.currentTarget.getBoundingClientRect();
      const centre = midpoint(a, b);
      const nextPose = zoomPlanAt(pinch.pose, pinch.pose.scale * distance(a, b) / pinch.span, pinch.centre);
      moveTo({
        ...nextPose,
        x: nextPose.x + centre.x - rect.left - rect.width / 2 - pinch.centre.x,
        y: nextPose.y + centre.y - rect.top - rect.height / 2 - pinch.centre.y,
      }, false);
    } else if (pose.current.scale > 1) {
      moveTo({ ...pose.current, x: pose.current.x + next.x - prev.x, y: pose.current.y + next.y - prev.y }, false);
    }
  }

  function end(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    gesture.current = null;
    if (!pointers.current.size) finishGesture();
  }

  function finishGesture() {
    setDragging(false);
    setAnnouncedZoom(zoomPercent(target.current.scale));
  }

  function cancelGesture(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const captured = [...pointers.current.keys()];
    pointers.current.clear();
    gesture.current = null;
    // Unlike pointerup, cancellation must not turn the surviving finger into a drag.
    for (const id of captured) {
      if (event.currentTarget.hasPointerCapture(id)) event.currentTarget.releasePointerCapture(id);
    }
    finishGesture();
  }

  return (
    <>
      <div ref={view} className={`${styles.planWindow} ${accessibility.planWindow}`}
        role={ready ? "region" : undefined} aria-label={ready ? "Interaktivni tlocrt stana" : undefined}
        aria-describedby={ready ? "apartment-plan-keys" : undefined} tabIndex={ready ? 0 : undefined}
        data-zoom={zoom} data-pannable={ready && zoom > 1} data-dragging={dragging}
        onKeyDown={keyPan} onPointerDown={start} onPointerMove={drag} onPointerUp={end}
        onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture}>
        <div ref={art} className={styles.planArt} style={{ padding: PLAN_INSET }} hidden={imageState === "error"}>
          {/* Lossless, native source copy; no reflow, cropping or optimizer substitutions. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imageRef} src={plan.src} width={plan.width} height={plan.height} alt={`Izvorni tlocrt stana ${unitId}`}
            data-apartment-image draggable={false} onLoad={() => setImageState("ready")} onError={() => setImageState("error")} />
        </div>
        <div aria-live="polite" aria-atomic="true">
          {imageState === "error" && <p className={styles.planMessage}>Pojedinačni tlocrt nije dostupan.</p>}
        </div>
      </div>
      <div className={styles.planTools} hidden={!ready}>
        <p>
          <span className={styles.keyboardHelp}>Tipke + i − mijenjaju povećanje. Povucite ili koristite strelice za pomak.</span>
          <span className={styles.touchHelp}>Za povećanje dodirnite + ili raširite dva prsta. Povucite za pomak.</span>
          <span id="apartment-plan-keys" hidden>Tipke + i − mijenjaju povećanje, strelice pomiču uvećani tlocrt, a Home vraća cijeli prikaz.</span>
        </p>
        <div className={`${styles.controls} ${accessibility.controls}`} role="group" aria-label="Kontrole tlocrta">
          {/* Native disabled blurs the focused button just when keyboard zoom reaches its limit. */}
          <button type="button" aria-label="Smanji tlocrt" title="Smanji tlocrt"
            aria-disabled={zoom <= 1} tabIndex={zoom <= 1 ? -1 : undefined} onClick={() => zoomBy(-1)}><Minus aria-hidden="true" /></button>
          <span className={styles.zoom} aria-hidden="true">{zoomPercent(zoom)}%</span>
          <span className="sr-only" aria-live="polite" aria-atomic="true">Povećanje tlocrta: {announcedZoom}%</span>
          <button type="button" aria-label="Povećaj tlocrt" title="Povećaj tlocrt"
            aria-disabled={zoom >= PLAN_MAX_ZOOM} tabIndex={zoom >= PLAN_MAX_ZOOM ? -1 : undefined} onClick={() => zoomBy(1)}><Plus aria-hidden="true" /></button>
          <button type="button" aria-label="Vrati cijeli tlocrt" title="Vrati cijeli tlocrt"
            onClick={() => moveTo(PLAN_HOME, true)}><RotateCcw aria-hidden="true" /></button>
        </div>
      </div>
    </>
  );
}
