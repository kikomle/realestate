import { describe, expect, it } from "vitest"
import { readReducedMotion, REDUCED_MOTION_QUERY, shouldReduceMotion } from "@/lib/viewer/reduced-motion"

describe("reduced motion", () => {
  it("only true when the media query matches exactly", () => {
    expect(shouldReduceMotion(true)).toBe(true)
    expect(shouldReduceMotion(false)).toBe(false)
    expect(shouldReduceMotion(null)).toBe(false)
    expect(shouldReduceMotion(undefined)).toBe(false)
  })

  it("reads the prefers-reduced-motion query", () => {
    const seen: string[] = []
    const win = {
      matchMedia: (q: string) => {
        seen.push(q)
        return { matches: true } as MediaQueryList
      },
    }
    expect(readReducedMotion(win as Pick<Window, "matchMedia">)).toBe(true)
    expect(seen).toEqual([REDUCED_MOTION_QUERY])
  })

  it("defaults to false when matchMedia is unavailable", () => {
    expect(readReducedMotion(undefined)).toBe(false)
    expect(readReducedMotion({} as Pick<Window, "matchMedia">)).toBe(false)
  })
})
