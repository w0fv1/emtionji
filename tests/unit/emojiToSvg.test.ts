import { describe, expect, it } from "vitest"
import { emojiToSvg, resolveEmojiAssetUrl } from "../../src/emojiToSvg"

describe("emojiToSvg", () => {
  it("maps one emoji to a pinned SVG asset", () => {
    expect(resolveEmojiAssetUrl("🌻")).toBe("https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.2/assets/svg/1f33b.svg")
  })

  it("rejects text and multiple emoji", () => {
    expect(() => resolveEmojiAssetUrl("hello")).toThrow("exactly one supported emoji")
    expect(() => resolveEmojiAssetUrl("🌻🌻")).toThrow("exactly one supported emoji")
  })

  it("loads, sanitizes and returns SVG in memory", async () => {
    const fetcher = async () => new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" onclick="alert(1)"><script>alert(1)</script><path fill="#fff" d="M0 0"/></svg>',
      { status: 200 }
    )
    const source = await emojiToSvg("🌻", fetcher as typeof fetch)
    expect(source).toContain("<svg")
    expect(source).toContain("<path")
    expect(source).not.toContain("script")
    expect(source).not.toContain("onclick")
  })
})

