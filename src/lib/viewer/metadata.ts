import { parseSemanticId, type SemanticId } from "@/lib/semantic-id"

export type NodeMetadata = {
  name: string
  semantic: SemanticId | null
  properties: Record<string, string | number | boolean | null>
}

type RawExtras = Record<string, unknown> | undefined

export function buildNodeMetadata(name: string, extras: RawExtras): NodeMetadata {
  const properties: NodeMetadata["properties"] = {}
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        properties[key] = value
      }
    }
  }
  const semantic = parseSemanticId(name)
  return { name, semantic, properties }
}
