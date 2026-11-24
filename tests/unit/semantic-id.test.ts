import { describe, expect, it } from "vitest"
import { isSemanticId, parseSemanticId } from "@/lib/semantic-id"

describe("parseSemanticId", () => {
  it("parses a wall id", () => {
    expect(parseSemanticId("B01__L03__U107__wall__001")).toEqual({
      building: "B01",
      level: "L03",
      unit: "U107",
      type: "wall",
      index: "001",
      raw: "B01__L03__U107__wall__001",
    })
  })

  it("accepts ground, basement and NONE placeholders", () => {
    expect(parseSemanticId("B01__L00__NONE__site__001")?.level).toBe("L00")
    expect(parseSemanticId("B02__LM01__U101__slab__003")?.level).toBe("LM01")
    expect(parseSemanticId("B01__L00__NONE__site__001")?.unit).toBe("NONE")
  })

  it("rejects unknown types and malformed names", () => {
    expect(parseSemanticId("B01__L03__U107__chair__001")).toBeNull()
    expect(parseSemanticId("B01_L03_U107_wall_001")).toBeNull()
    expect(parseSemanticId("Mesh.001")).toBeNull()
    expect(parseSemanticId("")).toBeNull()
  })

  it("rejects extra segments and non-numeric indices", () => {
    expect(parseSemanticId("B01__L03__U107__wall__001__extra")).toBeNull()
    expect(parseSemanticId("B01__L03__U107__wall__abc")).toBeNull()
  })

  it("isSemanticId mirrors parseSemanticId", () => {
    expect(isSemanticId("B01__L01__U101__window__002")).toBe(true)
    expect(isSemanticId("nope")).toBe(false)
  })
})
