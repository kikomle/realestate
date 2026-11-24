# Design system (web viewer)

Owner: Agent C. Tokens live in `src/app/globals.css` (`:root`, `.dark`, `@theme inline`).

Applies to both the image-first baseline and the optional 3D path (`docs/BUILD-PLAN.md`). The
tokens below already cover the image-first experience; the hotspot rules in "Hotspots and overlay"
were added for it.

## Direction

Restrained, architectural, premium: a stone/limestone background, graphite text, and one warm accent reserved for selection and focus. The hero is the architectural image (the floor plan on the image-first baseline, the 3D model on the optional 3D path); the UI should recede.

## Colour tokens

| Token | Value (oklch) | Use |
|---|---|---|
| `--background` | oklch(0.955 0.012 85) | Page, limestone |
| `--foreground` | oklch(0.24 0.01 70) | Graphite text |
| `--card` | oklch(0.985 0.006 85) | Panels, overlay cards |
| `--muted-foreground` | oklch(0.45 0.012 75) | Secondary text |
| `--border` | oklch(0.86 0.014 80) | Hairlines |
| `--accent` / `--ring` | oklch(0.62 0.12 55) | Selection and focus only |
| `--destructive` | oklch(0.55 0.19 27) | Errors |

Dark mode: `.dark` block keeps the shadcn defaults and is opt-in (not toggled in this build).

## Typography

- UI: Inter (`--font-sans-ui`) via `next/font/google`, self-hosted at build time.
- Display: Fraunces (`--font-serif-display`), used for `--font-heading`.
- Mono for semantic IDs: system monospace stack.
- Scale: text-sm (14px) body in panels, text-2xl (24px) page title.

## Spacing, radius, elevation

- Spacing: Tailwind 4 default 4px grid.
- Radius: `--radius: 0.75rem` (shadcn derives sm/md/lg/xl from it).
- Elevation: `--shadow-soft` (two-layer, low-contrast).

## Motion

| Token | Value | Use |
|---|---|---|
| `--motion-fast` | 150 ms | Hover and focus |
| `--motion-base` | 300 ms | UI state changes |
| `--motion-slow` | 1200 ms | Camera fly-to (GSAP, `power2.inOut`) |
| `--ease-standard` | cubic-bezier(0.2, 0, 0, 1) | CSS transitions |

Reduced motion: a `prefers-reduced-motion: reduce` rule in `globals.css` collapses CSS animations and transitions to ~0 ms, and `CameraRig` snaps the camera instantly (`src/lib/viewer/camera.ts` `transitionDuration`).

## Accessibility

- Visible focus: `:focus-visible` outline in `--ring`, 2px, offset 2px.
- Loading state uses a fixed-aspect container so the layout does not shift when the model arrives.
- Selection is also conveyed as text (semantic ID card), not colour alone.

## Hotspots and overlay (image-first baseline)

- A hotspot is a real focusable control (`<a>`/`<button>`) positioned over the SVG overlay in the
  source image's pixel space; it has an accessible name (the unit label, e.g. "H 2.1") and a state
  hint ("available" / "sold" / "not published").
- The overlay is pinned to the art: the same content hash and intrinsic pixel size, `viewBox="0 0 W H"`,
  and the same resize/crop transform, so shapes track the rendered image. Hotspots are keyed
  `(image, level)` on OVERVIEW and `(image, level, unit_id)` on FLOOR; coordinates are never converted
  to metres or advertised areas.
- Hover: `--motion-fast` (150 ms), accent border on `--accent`. Focus: the 2 px `--ring` outline,
  same as every other control. Selected: a persistent accent fill plus the text panel — colour is
  never the only signal.
- On navigation, focus moves to the new view's heading/anchor, and an explicit up/back link restores
  focus to the control the user came from.
- Contrast: hotspot label text meets AA against the plan background; where a plan area is light,
  the label sits on a `--card` chip rather than directly on the raster.
