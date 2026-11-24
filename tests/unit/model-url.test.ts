import { describe, expect, it } from "vitest"
import { DEFAULT_MODEL_URL, resolveModelUrl } from "@/lib/viewer/model-url"

describe("resolveModelUrl", () => {
  it("falls back to the placeholder when no model is requested", () => {
    expect(resolveModelUrl(null)).toBe(DEFAULT_MODEL_URL)
    expect(resolveModelUrl(undefined)).toBe(DEFAULT_MODEL_URL)
  })

  it("accepts same-origin /models/ GLB paths", () => {
    expect(resolveModelUrl("/models/test/smoke-complex.glb")).toBe("/models/test/smoke-complex.glb")
  })

  it("rejects external, traversal and non-GLB URLs", () => {
    expect(resolveModelUrl("https://evil.example/x.glb")).toBe(DEFAULT_MODEL_URL)
    expect(resolveModelUrl("//evil.example/x.glb")).toBe(DEFAULT_MODEL_URL)
    expect(resolveModelUrl("/models/../secret.glb")).toBe(DEFAULT_MODEL_URL)
    expect(resolveModelUrl("/models/test/x.gltf")).toBe(DEFAULT_MODEL_URL)
    expect(resolveModelUrl("/etc/passwd")).toBe(DEFAULT_MODEL_URL)
  })
})
