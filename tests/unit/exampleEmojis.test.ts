import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { parseEmtionjiData } from "../../src/definition"
import { resolveEmojiAssetUrl } from "../../src/emojiToSvg"
import { resolveKeyframes } from "../../src/runtime"

const expected = new Map([
  ["🌱", "1f331-seedling.json"], ["🌤️", "1f324-sun-behind-small-cloud.json"], ["🌿", "1f33f-herb.json"],
  ["🍃", "1f343-leaf-fluttering-in-wind.json"], ["🌙", "1f319-crescent-moon.json"], ["☁️", "2601-cloud.json"],
  ["🌈", "1f308-rainbow.json"], ["🫧", "1fae7-bubbles.json"], ["🌊", "1f30a-water-wave.json"],
  ["🪴", "1fab4-potted-plant.json"], ["🕊️", "1f54a-dove.json"], ["🌼", "1f33c-blossom.json"],
  ["🍵", "1f375-teacup-without-handle.json"], ["🪷", "1fab7-lotus.json"], ["✨", "2728-sparkles.json"],
  ["🌻", "1f33b-sunflower.json"], ["🫶", "1faf6-heart-hands.json"], ["🐚", "1f41a-spiral-shell.json"],
  ["🪺", "1faba-nest-with-eggs.json"], ["💫", "1f4ab-dizzy.json"], ["👋", "1f44b-waving-hand.json"],
  ["🫂", "1fac2-people-hugging.json"]
])

describe("example emoji animations", () => {
  it("contains one valid JSON definition for every example emoji", () => {
    const directory = resolve("examples/emojis")
    const files = readdirSync(directory).sort()

    expect(files).toHaveLength(expected.size)
    for (const file of files) {
      const data = parseEmtionjiData(JSON.parse(readFileSync(`${directory}/${file}`, "utf8")))
      expect(expected.get(data.emoji)).toBe(file)
      const codepoint = file.split("-")[0]
      expect(resolveEmojiAssetUrl(data.emoji)).toMatch(new RegExp(`/${codepoint}\\.svg$`))
      for (const track of data.animations.press) {
        const resolved = resolveKeyframes(track, 1)
        for (const [property, frames] of Object.entries(track.keyframes)) {
          expect(resolved[property as keyof typeof resolved]?.length).toBeGreaterThanOrEqual(frames!.length * 2)
        }
      }
    }
  })
})
