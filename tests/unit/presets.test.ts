import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { emtionjiPresets, getEmtionjiPreset } from "../../src/presets"

describe("built-in emtionji presets", () => {
  it("exports every example JSON as a typed preset", () => {
    expect(Object.keys(emtionjiPresets)).toHaveLength(22)
    for (const [emoji, preset] of Object.entries(emtionjiPresets)) {
      expect(preset.emoji).toBe(emoji)
      expect(getEmtionjiPreset(emoji)).toBe(preset)
    }
  })

  it("rejects emojis without a built-in preset", () => {
    expect(() => getEmtionjiPreset("😀")).toThrow("No built-in emtionji preset")
  })
})

describe("package contract", () => {
  it("supports Git installation and public preset imports", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"))

    expect(packageJson.scripts.prepare).toBe("pnpm build")
    expect(packageJson.files).toContain("examples/emojis")
    expect(packageJson.exports["./presets"].import).toBe("./dist/presets.js")
    expect(packageJson.exports["./emoji/*.json"]).toBe("./examples/emojis/*.json")
  })
})

