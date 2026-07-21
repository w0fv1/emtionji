import { describe, expect, it } from "vitest"
import { resolveKeyframes, smoothNumericKeyframes } from "../../src/runtime"

describe("resolveKeyframes", () => {
  it("applies click direction from generic JSON metadata", () => {
    const resolved = resolveKeyframes({
      target: "head",
      keyframes: {
        x: [0, 4, 0],
        scale: [1, 1.1, 1]
      },
      duration: 1,
      directional: ["x"]
    }, -1)

    expect(resolved.x).toHaveLength(7)
    expect(resolved.x?.[0]).toBe(-0)
    expect(resolved.x?.[3]).toBe(-4)
    expect(resolved.x?.[6]).toBe(-0)
    expect(resolved.scale?.[0]).toBe(1)
    expect(resolved.scale?.[3]).toBeCloseTo(1.1)
    expect(resolved.scale?.[6]).toBe(1)
  })

  it("densifies numeric motion to at least twice the authored frame count", () => {
    const smoothed = smoothNumericKeyframes([0, 10, -4, 0])

    expect(smoothed.length).toBeGreaterThanOrEqual(8)
    expect(smoothed[0]).toBe(0)
    expect(smoothed.at(-1)).toBe(0)
  })
})
