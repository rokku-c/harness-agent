import { describe, expect, test } from "bun:test"
import { classifyViewport, computeWorkbenchLayout } from "@effect-agent/ui"

describe("adaptive universal UI layout", () => {
  test("nearby aspect ratios resolve to stable layout families", () => {
    expect(classifyViewport({ inlineSize: 10, blockSize: 11, unit: "pixel" }).family).toBe("square")
    expect(classifyViewport({ inlineSize: 16, blockSize: 10, unit: "pixel" }).family).toBe("wide")
    expect(classifyViewport({ inlineSize: 16, blockSize: 9, unit: "pixel" }).family).toBe("wide")
    expect(classifyViewport({ inlineSize: 3, blockSize: 4, unit: "pixel" }).family).toBe("portrait")
  })

  test("layout families move whole regions rather than only resize them", () => {
    const portrait = computeWorkbenchLayout({ inlineSize: 600, blockSize: 1000, unit: "pixel" })
    const wide = computeWorkbenchLayout({ inlineSize: 1600, blockSize: 900, unit: "pixel" })
    // Portrait stacks the event ledger below the inspector.
    expect(portrait.regions.events.y).toBeGreaterThan(portrait.regions.inspector.y)
    expect(portrait.regions.events.x).toBe(portrait.regions.inspector.x)
    // Wide layout moves the ledger beside the inspector.
    expect(wide.regions.events.x).toBeGreaterThan(wide.regions.inspector.x)
    expect(wide.regions.events.y).toBe(wide.regions.inspector.y)
  })

  test("terminal cell aspect participates in orientation", () => {
    expect(classifyViewport({ inlineSize: 80, blockSize: 24, unit: "cell", cellAspect: 0.5 }).family).toBe("wide")
    expect(classifyViewport({ inlineSize: 32, blockSize: 40, unit: "cell", cellAspect: 0.5 }).family).toBe("portrait")
  })
})
