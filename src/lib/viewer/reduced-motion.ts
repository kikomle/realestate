export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

export function shouldReduceMotion(matches: boolean | null | undefined): boolean {
  return matches === true
}

export function readReducedMotion(win: Pick<Window, "matchMedia"> | undefined): boolean {
  if (!win || typeof win.matchMedia !== "function") return false
  return shouldReduceMotion(win.matchMedia(REDUCED_MOTION_QUERY).matches)
}
