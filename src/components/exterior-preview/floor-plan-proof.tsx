"use client";

import gsap from "gsap";
import { ArrowLeft, ArrowUpRight, LockKeyhole } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import type { ApartmentDetails } from "@/lib/exterior-preview/apartment-detail";
import { polygonArea } from "@/lib/exterior-preview/plan-footprint";
import { focusFootprint, PLAN_HOME } from "@/lib/exterior-preview/apartment-plan-camera";
import { exteriorPlanReturn, planProofHref, type PlanEntry } from "@/lib/exterior-preview/plan-proof-address";
import { ApartmentDetail } from "./apartment-detail";
import styles from "./floor-plan-proof.module.css";
import motionStyles from "./selection-motion.module.css";

type Drawing = {
  id: string;
  variant: string;
  width: number;
  height: number;
  viewBox: string;
  src: string;
  polygons: readonly { unitId: string; points: string }[] | null;
};

const sizes = [
  { id: "fit", label: "Cijeli tlocrt" },
  { id: "read", label: "Čitljivi prikaz" },
  { id: "native", label: "Izvorna veličina" },
] as const;

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
type PlanScroll = { left: number; top: number };
type Flight =
  | { phase: "zoom" | "return"; unitId: string; points: string; scroll: PlanScroll }
  | { phase: "reveal"; unitId: string };
type Origin = { drawingId: string; unitId: string; link: "outline" | "card"; scroll: PlanScroll };
type ArrivalFocus = { destination: "apartment" } | { destination: "floor"; origin: Origin | null };

function historyOrigin(drawingId: string, unitId: string | null): Origin | null {
  const origin: Origin | undefined = window.history.state?.mocirePlanOrigin;
  return origin && origin.drawingId === drawingId && origin.unitId === unitId &&
    (origin.link === "outline" || origin.link === "card") &&
    Number.isFinite(origin.scroll?.left) && Number.isFinite(origin.scroll?.top) ? origin : null;
}

export function FloorPlanProof({ floorId, label, entry, floors, hasGallery, unitIds, drawing, apartments }: {
  floorId: string;
  label: string;
  entry?: PlanEntry;
  floors: readonly { id: string; label: string }[];
  hasGallery: boolean;
  unitIds: readonly string[];
  drawing: Drawing;
  apartments: readonly ApartmentDetails[];
}) {
  const query = useSearchParams();
  const address = query.toString();
  const unitsInAddress = query.getAll("unit");
  const unitId = unitsInAddress.length === 1 && unitIds.includes(unitsInAddress[0]) ? unitsInAddress[0] : null;
  const invalidUnit = unitsInAddress.length > 0 && unitId === null;
  const [size, setSize] = useState<(typeof sizes)[number]["id"]>("read");
  const [imageState, setImageState] = useState<"pending" | "ready" | "error">("pending");
  const [flight, setFlight] = useState<Flight | null>(null);
  const proof = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const floorTitle = useRef<HTMLHeadingElement>(null);
  const previousAddress = useRef<{ unitId: string | null; origin: Origin | null }>({ unitId, origin: null });
  const focusOnArrival = useRef<ArrivalFocus | null>(null);
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete) setImageState(image.naturalWidth ? "ready" : "error");
  }, []);

  const drawingUrl = planProofHref(floorId, drawing.variant, undefined, entry);
  const exterior = exteriorPlanReturn(floorId, entry);
  const hrefForUnit = (id: string) => planProofHref(floorId, drawing.variant, id, entry);
  const apartment = apartments.find(unit => unit.id === unitId);
  const addressMatchesDrawing = query.get("floor") === floorId && (query.get("plan") ?? "main") === drawing.variant;
  const activeFlight = flight && addressMatchesDrawing && (
    flight.phase === "return" ? unitsInAddress.length === 0 : apartment?.id === flight.unitId
  ) ? flight : null;
  const travelling = activeFlight?.phase === "zoom" || activeFlight?.phase === "return" ? activeFlight : null;
  const pending = travelling?.phase === "zoom";
  const returning = travelling?.phase === "return";
  const showingApartment = apartment && !pending;

  useLayoutEffect(() => {
    // Back/Forward already committed an address. Never replay or write history from a timeline.
    const cancelFlight = () => setFlight(null);
    const motion = window.matchMedia(MOTION_QUERY);
    const onMotionChange = () => { if (motion.matches) cancelFlight(); };
    window.addEventListener("popstate", cancelFlight);
    motion.addEventListener("change", onMotionChange);
    return () => {
      window.removeEventListener("popstate", cancelFlight);
      motion.removeEventListener("change", onMotionChange);
    };
  }, []);

  useLayoutEffect(() => {
    if (!travelling) return;
    const frame = viewport.current;
    const image = art.current;
    const { phase, scroll, points, unitId: targetUnit } = travelling;
    const settle = (reveal = false) => setFlight(current =>
      current === travelling ? (reveal ? { phase: "reveal", unitId: targetUnit } : null) : current);
    const motion = window.matchMedia(MOTION_QUERY);
    const displayed = { width: image?.offsetWidth ?? 0, height: image?.offsetHeight ?? 0 };
    const aperture = { width: frame?.clientWidth ?? 0, height: frame?.clientHeight ?? 0 };
    const target = focusFootprint(points, drawing, displayed, aperture);
    if (!frame || !image || !target || imageState !== "ready" || motion.matches) {
      const nextFrame = requestAnimationFrame(() => settle());
      return () => cancelAnimationFrame(nextFrame);
    }

    frame.scrollTo({ ...scroll, behavior: "instant" });
    if (phase === "return") frame.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    const closeup = { ...target, x: target.x + frame.scrollLeft, y: target.y + frame.scrollTop };
    gsap.set(image, { transformOrigin: "0 0" });
    const shot = gsap.timeline({ onComplete: () => settle(phase === "zoom") });
    if (phase === "zoom") {
      // Give the highlight a beat, frame it, then dissolve out of the floor art.
      shot.to(image, { ...closeup, duration: 0.46, ease: "power2.inOut" }, 0.05)
        .to(image, { opacity: 0.45, duration: 0.14, ease: "sine.inOut" }, 0.48);
    } else {
      // The URL is already the floor. Start on the old footprint as a visual cue only.
      gsap.set(image, { ...closeup, opacity: 0.6 });
      shot.to(image, { opacity: 1, duration: 0.14, ease: "sine.out" }, 0)
        .to(image, { ...PLAN_HOME, duration: 0.44, ease: "power2.inOut" }, 0.06);
    }

    const cut = () => {
      shot.kill();
      settle();
    };
    const resize = new ResizeObserver(() => {
      if (frame.clientWidth !== aperture.width || frame.clientHeight !== aperture.height ||
          image.offsetWidth !== displayed.width || image.offsetHeight !== displayed.height) cut();
    });
    resize.observe(frame);
    resize.observe(image);
    window.addEventListener("resize", cut);
    return () => {
      shot.kill();
      gsap.set(image, { clearProps: "opacity,transform,transformOrigin" });
      frame.scrollTo({ ...scroll, behavior: "instant" });
      resize.disconnect();
      window.removeEventListener("resize", cut);
    };
  }, [drawing, imageState, travelling]);

  useLayoutEffect(() => {
    // A cancellation can render before Next has caught up with native history.
    if (new URLSearchParams(window.location.search).toString() !== address) return;
    const previous = previousAddress.current;
    if (previous.unitId !== unitId) {
      focusOnArrival.current = unitId ? { destination: "apartment" } :
        previous.unitId ? { destination: "floor", origin: previous.origin } : null;
    }
    previousAddress.current = { unitId, origin: historyOrigin(drawing.id, unitId) };
    const arrival = focusOnArrival.current;
    if (travelling || !arrival) return;
    focusOnArrival.current = null;
    if (arrival.destination === "apartment") {
      title.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    } else {
      const origin = arrival.origin;
      if (origin) {
        viewport.current?.scrollTo({ ...origin.scroll, behavior: "instant" });
        const href = planProofHref(floorId, drawing.variant, origin.unitId, entry);
        const anchor = proof.current?.querySelector<HTMLAnchorElement | SVGAElement>(
          `[data-plan-origin="${origin.link}"][href="${CSS.escape(href)}"]`);
        if (anchor?.getClientRects().length) {
          anchor.focus();
          if (document.activeElement === anchor) return;
        }
      }
      floorTitle.current?.focus();
    }
  }, [address, drawing.id, drawing.variant, entry, floorId, travelling, unitId]);

  function select(event: MouseEvent<HTMLAnchorElement | SVGAElement>, href: string, nextUnit?: string) {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    if (`${window.location.pathname}${window.location.search}` === href) return;
    const frame = viewport.current;
    const scroll = { left: frame?.scrollLeft ?? 0, top: frame?.scrollTop ?? 0 };
    const previousUnits = new URLSearchParams(window.location.search).getAll("unit");
    const previousUnit = previousUnits.length === 1 && unitIds.includes(previousUnits[0]) ? previousUnits[0] : null;

    const shotUnit = nextUnit ?? previousUnit;
    const points = drawing.polygons?.find(polygon => polygon.unitId === shotUnit)?.points;
    const canFly = !travelling && frame && imageState === "ready" &&
      !window.matchMedia(MOTION_QUERY).matches;
    let nextFlight: Flight | null = null;
    if (canFly && points) {
      if (nextUnit && !previousUnit) {
        frame.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
        nextFlight = { phase: "zoom", unitId: nextUnit, points, scroll };
      } else if (!nextUnit && previousUnit && showingApartment && apartment?.id === previousUnit) {
        nextFlight = { phase: "return", unitId: previousUnit, points, scroll: historyOrigin(drawing.id, previousUnit)?.scroll ?? scroll };
      }
    }
    setFlight(nextFlight);
    const link = event.currentTarget.dataset.planOrigin;
    const origin: Origin | null = nextUnit && (link === "outline" || link === "card")
      ? { drawingId: drawing.id, unitId: nextUnit, link, scroll } : null;
    // Persist only the focus hint per entry, not selection or animation state.
    window.history.pushState(origin ? { mocirePlanOrigin: origin } : null, "", href);
  }

  return (
    <main ref={proof} lang="hr" className={`${styles.proof} ${motionStyles.motion}`} data-plan-proof data-image-id={drawing.id}
      data-phase={travelling?.phase ?? (showingApartment ? "apartment" : "floor")}
      data-motion-reveal={activeFlight?.phase === "reveal" || undefined}>
      <div className={styles.brandBar}>
        <a className={styles.brand} href={exterior.brandHref}>Močire <span>H</span></a>
        <p className={styles.private}><LockKeyhole aria-hidden="true" /> Privatni pregled</p>
      </div>
      <header className={styles.header}>
        <nav aria-label="Putanja" className={styles.breadcrumb}>
          <ol>
            <li><a href={exterior.href}>{exterior.label}</a></li>
            <li>{unitId || invalidUnit ? (
              <a href={drawingUrl} onClick={event => select(event, drawingUrl)}>{label}</a>
            ) : <span aria-current="page">{label}</span>}</li>
            {unitId && <li aria-current="page">{unitId}</li>}
          </ol>
        </nav>
        <a className={styles.back} href={unitId ? drawingUrl : exterior.href}
          onClick={unitId ? event => select(event, drawingUrl) : undefined}><ArrowLeft aria-hidden="true" />
          {unitId ? "Natrag na etažu" : exterior.back}
        </a>
      </header>

      {!showingApartment && (
        <div className={styles.intro}>
          <div>
            <p>Stambena zgrada H, Zadar</p>
            <h1 tabIndex={-1} ref={floorTitle}>{label}</h1>
          </div>
          <p>Položaj etaže na pročelju nije potvrđen.</p>
        </div>
      )}

      <div className={styles.planNav}>
        <nav className={`${styles.choices} ${styles.levels}`} aria-label="Promijeni etažu">
          {floors.map(floor => (
            <a key={floor.id} href={planProofHref(floor.id, "main", undefined, entry)}
              aria-current={floorId === floor.id ? "page" : undefined}>
              {floor.label}
            </a>
          ))}
        </nav>
        {hasGallery && (
          <nav className={styles.choices} aria-label="Vrsta tlocrta">
            {[{ variant: "main", text: "Glavni tlocrt" }, { variant: "gallery", text: "Galerija" }].map(plan => (
              <a key={plan.variant} href={planProofHref(floorId, plan.variant, unitId ?? undefined, entry)}
                aria-current={drawing.variant === plan.variant ? "page" : undefined}>{plan.text}</a>
            ))}
          </nav>
        )}
      </div>

      <div className={styles.journey}>
      {apartment && <ApartmentDetail key={apartment.id} unit={apartment} floor={label}
        exteriorUrl={exterior.href} exteriorLabel={`${exterior.label} zgrade H`}
        headingRef={title} pending={pending}
        planFootprintPx2={polygonArea(drawing.polygons?.find(p => p.unitId === apartment.id)?.points ?? "")}
        floorFootprintMaxPx2={Math.max(0, ...(drawing.polygons ?? []).map(p => polygonArea(p.points) ?? 0))} />}
      <section className={styles.board} aria-labelledby="plan-title" data-flight={travelling !== null}>
        <div className={styles.toolbar}>
          <div>
            <h2 id="plan-title">{showingApartment ? "Položaj na etaži" :
              drawing.variant === "gallery" ? "Tlocrt galerije" : "Tlocrt etaže"}</h2>
            <p id="plan-instructions">{showingApartment
              ? `Označen je stan ${unitId}${drawing.variant === "gallery" ? " na tlocrtu galerije" : ""}.`
              : "Odaberite obris stana ili njegovu oznaku s popisa."}</p>
          </div>
          <div className={styles.readingControls} role="group" aria-label="Veličina tlocrta" hidden={imageState !== "ready"}>
            {sizes.map(option => (
              <button type="button" key={option.id} aria-pressed={size === option.id}
                onClick={() => {
                  if (travelling) setFlight(null);
                  setSize(option.id);
                }}>{option.label}</button>
            ))}
          </div>
        </div>
        {size !== "fit" && imageState === "ready" && (
          <p className={styles.panHint} data-size={size}>Pomaknite tlocrt vodoravno za ostatak etaže.</p>
        )}

        {imageState === "error" && <p className={styles.notice}>Slika tlocrta nije dostupna. Odaberite stan s popisa.</p>}
        {!drawing.polygons && imageState !== "error" &&
          <p className={styles.notice}>Obrisi stanova nisu dostupni. Odaberite stan s popisa.</p>}

        <div className={styles.scroller} role="region" aria-label="Prikaz tlocrta" aria-describedby="plan-instructions"
          ref={viewport} tabIndex={0} data-plan-scroll data-size={size} hidden={imageState === "error"}>
          <div className={styles.drawing} ref={art} style={size === "native" ? { width: drawing.width } : undefined}>
            {/* Native, hash-checked lossless copy; no optimizer resizing or cropping. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imageRef} src={drawing.src} width={drawing.width} height={drawing.height}
              alt={`Tlocrt: ${label}${drawing.variant === "gallery" ? " – galerija" : ""}`} data-plan-image
              fetchPriority="high" onLoad={() => setImageState("ready")} onError={() => setImageState("error")} />
            {drawing.polygons && (
              <svg className={styles.map} viewBox={drawing.viewBox} width={drawing.width} height={drawing.height}
                aria-label={`Obrisi stanova: ${label}`} data-unit-map data-ready={imageState === "ready"}>
                {drawing.polygons.map(polygon => {
                  const href = hrefForUnit(polygon.unitId);
                  return (
                    <a href={href} key={polygon.unitId} aria-label={`Stan ${polygon.unitId}`} data-plan-origin="outline"
                      aria-current={unitId === polygon.unitId ? "true" : undefined}
                      data-motion-highlight={returning && travelling.unitId === polygon.unitId || undefined}
                      onClick={event => select(event, href, polygon.unitId)}>
                      <polygon data-unit-id={polygon.unitId} points={polygon.points} vectorEffect="non-scaling-stroke" />
                    </a>
                  );
                })}
              </svg>
            )}
          </div>
        </div>
        <p className={styles.selection} role="status">
          {unitId ? `Odabran stan: ${unitId}` : "Nijedan stan nije odabran."}
        </p>
        {invalidUnit && <p className={styles.notice}>Stan iz poveznice nije na ovoj etaži.</p>}
      </section>

      </div>

      <nav className={styles.units} aria-label="Stanovi na etaži">
        <h2>Stanovi na etaži</h2>
        <ul>
          {unitIds.map(id => {
            const href = hrefForUnit(id);
            const unit = apartments.find(apartment => apartment.id === id);
            return (
              <li key={id}><a className={styles.card} href={href}
                data-plan-origin="card"
                aria-current={unitId === id ? "true" : undefined}
                onClick={event => select(event, href, id)}>
                <span><strong>{id}</strong>{unit && <small>{unit.type}</small>}</span>
                {unit && <span className={styles.cardArea}>{unit.listingArea} m²</span>}
                <ArrowUpRight aria-hidden="true" />
              </a></li>
            );
          })}
        </ul>
      </nav>
    </main>
  );
}
