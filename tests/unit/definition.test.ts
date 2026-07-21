import { describe, expect, it } from "vitest"
import { loadEmtionjiData, parseEmtionjiData } from "../../src/definition"

const valid = {
  version: 1,
  emoji: "🌻",
  parts: {
    head: { selector: "path:nth-of-type(2)", origin: "18px 14px" }
  },
  animations: {
    press: [{
      target: "head",
      keyframes: { rotate: [0, 12, 0] },
      duration: 1,
      directional: ["rotate"]
    }]
  }
}

describe("parseEmtionjiData", () => {
  it("accepts emoji and animation JSON", () => {
    expect(parseEmtionjiData(valid)).toEqual(valid)
  })

  it("rejects tracks that target undeclared parts", () => {
    expect(() => parseEmtionjiData({
      ...valid,
      animations: { press: [{ ...valid.animations.press[0], target: "leaf" }] }
    })).toThrow("expected a declared part")
  })

  it("rejects invalid keyframe types", () => {
    expect(() => parseEmtionjiData({
      ...valid,
      animations: { press: [{ ...valid.animations.press[0], keyframes: { rotate: [0, "bad"] } }] }
    })).toThrow("expected a finite number")
  })

  it("rejects animation tracks that do not return to their resting state", () => {
    expect(() => parseEmtionjiData({
      ...valid,
      animations: { press: [{ ...valid.animations.press[0], keyframes: { x: [0, 4, 2] } }] }
    })).toThrow("returns to rest")
  })

  it("loads Base64 JSON from a standard Data URL", async () => {
    const base64 = Buffer.from(JSON.stringify(valid), "utf8").toString("base64")
    const loaded = await loadEmtionjiData(`data:application/json;base64,${base64}`)

    expect(loaded).toEqual(valid)
  })

  it("loads percent-encoded JSON from a standard Data URL", async () => {
    const loaded = await loadEmtionjiData(`data:application/json,${encodeURIComponent(JSON.stringify(valid))}`)

    expect(loaded).toEqual(valid)
  })
})
