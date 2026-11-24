export const DEFAULT_MODEL_URL = "/models/test/placeholder-building.glb"

export function resolveModelUrl(requested: string | null | undefined): string {
  if (!requested) return DEFAULT_MODEL_URL
  if (!requested.startsWith("/models/")) return DEFAULT_MODEL_URL
  if (requested.includes("..") || requested.includes("\\") || requested.includes("?") || requested.includes("#")) {
    return DEFAULT_MODEL_URL
  }
  if (!/\.glb$/i.test(requested)) return DEFAULT_MODEL_URL
  return requested
}
