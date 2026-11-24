export const SEMANTIC_TYPES = [
  "wall",
  "slab",
  "window",
  "door",
  "balcony",
  "stair",
  "column",
  "roof",
  "site",
] as const

export type SemanticType = (typeof SEMANTIC_TYPES)[number]

export type SemanticId = {
  building: string
  level: string
  unit: string
  type: SemanticType
  index: string
  raw: string
}

const PATTERN =
  /^(B\d{2,})__((?:LM|L)\d{2,})__(NONE|U\d{3,})__(wall|slab|window|door|balcony|stair|column|roof|site)__(\d{3,})$/

export function parseSemanticId(value: string): SemanticId | null {
  const match = PATTERN.exec(value)
  if (!match) return null
  const [, building, level, unit, type, index] = match
  return {
    building,
    level,
    unit,
    type: type as SemanticType,
    index,
    raw: value,
  }
}

export function isSemanticId(value: string): boolean {
  return parseSemanticId(value) !== null
}
