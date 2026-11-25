"use client"

import { useId, type ReactNode } from "react"
import {
  Check,
  ChevronRight,
  Info,
  LockKeyhole,
  Minus,
  Plus,
  RotateCcw,
  Scan,
  TriangleAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { exteriorPreviewPath, planProofHref, privatePlanReviewUrl } from "@/lib/exterior-preview/plan-proof-address"
import { cn } from "@/lib/utils"
import styles from "./explorer-shell.module.css"

export type ExplorerShellProps = {
  children: ReactNode
  floors: readonly { id: string; label: string; mapped: boolean }[]
  selectedFloorId: string | null
  planProofUrl?: string
  view: "arrival" | "facade"
  invalidFloor: boolean
  onFloorSelect: (id: string) => void
  onFloorHover: (id: string | null) => void
  onOverview: () => void
  onBuildingFocus: () => void
  onReset: () => void
  onZoom: (direction: 1 | -1) => void
}

/** Presentation only: the private preview controller owns images, geometry and URL state. */
export function ExplorerShell({
  children,
  floors,
  selectedFloorId,
  planProofUrl,
  view,
  invalidFloor,
  onFloorSelect,
  onFloorHover,
  onOverview,
  onBuildingFocus,
  onReset,
  onZoom,
}: ExplorerShellProps) {
  const id = useId()
  const titleId = `${id}-title`
  const canvasId = `${id}-canvas`
  const floorListId = `${id}-floors`
  const floorHeadingId = `${id}-floor-heading`
  const geometryNoticeId = `${id}-geometry-notice`
  const selectedFloor = floors.find((floor) => floor.id === selectedFloorId)
  const hasInvalidFloor = invalidFloor || (selectedFloorId !== null && !selectedFloor)
  const isArrival = view === "arrival"

  const selectionDescription = selectedFloor
    ? selectedFloor.mapped
      ? "Označeno na pročelju."
      : "Ova je etaža dostupna samo s popisa."
    : isArrival ? "Odaberite etažu s popisa da otvorite tlocrt i odaberete stan." : "Za odabir koristite popis etaža."
  const hasMappedFloors = floors.some(floor => floor.mapped)
  const floorChoices = (
    <ul className={styles.floorList}>
      {floors.map((floor) => {
        const selected = !hasInvalidFloor && floor.id === selectedFloorId
        return (
          <li className={styles.floorItem} key={floor.id}>
            {isArrival ? (
              <a className={cn(styles.floorButton, styles.floorLink)} href={planProofHref(floor.id, "main", undefined, "overview")}>
                <span className={styles.floorName}>{floor.label}</span>
                <ChevronRight className={cn(styles.floorMark, "size-3.5")} aria-hidden="true" />
              </a>
            ) : (
              <Button
                type="submit"
                name="floor"
                value={floor.id}
                variant="ghost"
                className={styles.floorButton}
                aria-label={floor.label}
                aria-pressed={selected}
                data-floor-id={floor.id}
                data-mapped={floor.mapped}
                onClick={event => {
                  event.preventDefault()
                  onFloorSelect(floor.id)
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType !== "touch") onFloorHover(floor.id)
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType !== "touch") onFloorHover(null)
                }}
                onFocus={() => onFloorHover(floor.id)}
                onBlur={() => onFloorHover(null)}
              >
                <span className={styles.floorName}>{floor.label}</span>
                {selected && <Check className={cn(styles.floorMark, "size-3.5")} aria-hidden="true" />}
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )

  return (
    <section
      className={cn(styles.shell, "bg-background font-sans text-foreground")}
      lang="hr"
      aria-labelledby={titleId}
      data-view={view}
    >
      <a className={styles.skipLink} href={`#${floorListId}`}>
        Preskoči na odabir etaže
      </a>

      {/* No image fitting or transforms here: art and registration stay with the canvas owner. */}
      <div className={styles.canvas} id={canvasId}>
        {children}
      </div>
      <div className={styles.scrim} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.identity}>
          <h1
            className="font-heading text-[clamp(1.875rem,3vw,2.5rem)] leading-none font-normal tracking-tight"
            id={titleId}
            translate="no"
          >
            Močire
          </h1>
          <p className="mt-1.5 text-xs leading-4 text-muted-foreground">Zadar / Zgrada H</p>
        </div>

        <nav className={styles.viewNav} aria-label="Odabir pogleda">
          <Button
            type="button"
            variant="ghost"
            className={styles.viewButton}
            aria-pressed={isArrival}
            aria-controls={canvasId}
            onClick={onOverview}
          >
            Prilaz
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={styles.viewButton}
            aria-pressed={!isArrival}
            aria-controls={canvasId}
            onClick={onBuildingFocus}
          >
            Pročelje
          </Button>
        </nav>

        <p className={cn(styles.privacy, "text-xs font-medium")}>
          <LockKeyhole className="size-3.5" aria-hidden="true" />
          Privatni pregled
        </p>
      </header>

      <div className={styles.hud}>
        <section className={styles.floorPanel} aria-labelledby={floorHeadingId}>
          <div className={styles.floorIntro}>
            <p className="text-xs leading-4 text-muted-foreground">Etaže zgrade H</p>
            <h2
              className={cn(
                styles.floorHeading,
                "mt-1.5 font-heading text-[1.75rem] leading-tight font-normal tracking-tight text-balance"
              )}
              id={floorHeadingId}
            >
              {hasInvalidFloor ? "Odaberite etažu" : (selectedFloor?.label ?? "Odaberite etažu")}
            </h2>
          </div>

          <nav
            className={styles.floorNav}
            id={floorListId}
            aria-label="Odabir etaže zgrade H"
            aria-describedby={geometryNoticeId}
            tabIndex={-1}
          >
            {isArrival ? floorChoices : <form action={exteriorPreviewPath} method="get">{floorChoices}</form>}
            {floors.length === 0 && (
              <p className="py-3 text-sm leading-relaxed text-muted-foreground">
                Popis etaža trenutačno nije dostupan.
              </p>
            )}
          </nav>

          <div className={styles.panelNotice} id={geometryNoticeId}>
            {hasInvalidFloor ? (
              <div className={styles.invalidNotice}>
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs leading-relaxed">
                    Etaža iz poveznice nije pronađena. Odaberite je s popisa ili se vratite na
                    prilaz.
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    className={styles.recoveryButton}
                    onClick={onOverview}
                  >
                    Vrati se na prilaz
                  </Button>
                </div>
              </div>
            ) : (
              <div className={styles.geometryNotice}>
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs leading-4 font-medium">
                    {isArrival ? "Tlocrti etaža" : hasMappedFloors ? "Odabir etaže" : "Oznake na pročelju nisu potvrđene"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {selectionDescription}
                  </p>
                </div>
                {planProofUrl ? <a className={styles.planProofLink} href={planProofUrl}>Provjeri tlocrt</a> :
                  <a className={styles.planProofLink} href={privatePlanReviewUrl}>Zumiraj etaže</a>}
              </div>
            )}
          </div>
        </section>

        <div className={styles.story}>
          <h2 className="font-heading text-[clamp(2.5rem,4.5vw,4.5rem)] leading-[1.02] font-normal tracking-tight text-balance">
            {isArrival ? (
              <>
                Zgrada H,
                <br />
                izbliza.
              </>
            ) : (
              "Pogled na pročelje."
            )}
          </h2>
          <p className="mt-3 text-sm leading-relaxed">
            {isArrival ? "Stambena zgrada u Zadru." : "Povucite sliku za pomak."}
          </p>
          <Button
            type="button"
            className={styles.focusButton}
            onClick={isArrival ? onBuildingFocus : onOverview}
          >
            <Scan className="size-4" aria-hidden="true" />
            {isArrival ? "Izdvoji zgradu" : "Cijeli prikaz"}
          </Button>
        </div>

        <div className={styles.viewTools} role="group" aria-label="Prilagodba prikaza">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.toolButton}
            aria-label="Povećaj prikaz"
            title="Povećaj prikaz"
            onClick={() => onZoom(1)}
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.toolButton}
            aria-label="Smanji prikaz"
            title="Smanji prikaz"
            onClick={() => onZoom(-1)}
          >
            <Minus className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.toolButton}
            aria-label="Vrati početni pogled"
            title="Vrati početni pogled"
            onClick={onReset}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isArrival ? "Pregled prilaza zgradi H." : "Pregled pročelja zgrade H."}{" "}
        {hasInvalidFloor
          ? "Etaža iz poveznice nije pronađena. Odaberite etažu s popisa ili se vratite na prilaz."
          : selectedFloor
            ? `Odabrano: ${selectedFloor.label}. ${selectionDescription}`
            : "Nije odabrana etaža. Sve etaže dostupne su putem popisa."}{" "}
        Privatni pregled. {!hasMappedFloors && "Oznake na pročelju nisu potvrđene."}
      </p>
    </section>
  )
}
