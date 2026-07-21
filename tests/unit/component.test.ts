/* eslint-disable vue/one-component-per-file */
import { createApp } from "vue"
import { afterEach, describe, expect, it, vi } from "vitest"
import AnimatedEmoji from "../../src/AnimatedEmoji.vue"

const data = {
  version: 1 as const,
  emoji: "🌻",
  parts: {
    head: { selector: "path", origin: "50% 50%" }
  },
  animations: {
    press: [{
      target: "head",
      keyframes: { rotate: [0, 10, 0] },
      duration: 0.2
    }]
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe("AnimatedEmoji", () => {
  it("loads an HTTPS JSON URL and creates its emoji SVG in memory", async () => {
    const dataUrl = "https://example.com/emtionji/sunflower.json"
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      if (String(input) === dataUrl) {
        return new Response(JSON.stringify(data), { status: 200 })
      }
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#f4b400" d="M0 0h18v36H0z"/><path fill="#ffcc4d" d="M18 0h18v36H18z"/></svg>',
        { status: 200 }
      )
    })
    vi.stubGlobal("fetch", fetcher)
    const container = document.createElement("div")
    document.body.append(container)
    const app = createApp(AnimatedEmoji, { data: dataUrl })

    app.mount(container)
    await vi.waitFor(() => {
      expect(container.querySelector("svg")).not.toBeNull()
    })

    expect(fetcher).toHaveBeenNthCalledWith(1, dataUrl)
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.2/assets/svg/1f33b.svg")
    const part = container.querySelector<SVGGElement>("[data-emtionji-part='head']")
    expect(part?.tagName.toLowerCase()).toBe("g")
    expect(part?.children).toHaveLength(2)
    expect(container.querySelector("[role='img']")?.getAttribute("data-emtionji-state")).toBe("idle")
    app.unmount()
  })

  it("composes a part from inherited SVG members and clipped highlight layers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><g fill="#50A5E6"><circle cx="10" cy="10" r="8"/></g><g fill="#A8E0F9" fill-opacity=".5"><circle cx="10" cy="10" r="7"/></g><path fill="#fff" d="M5 5h10v10H5z"/></svg>',
      { status: 200 }
    )))
    const composedData = {
      version: 1 as const,
      emoji: "🫧",
      parts: {
        bubble: {
          members: [
            { selector: ":scope > g:first-of-type > circle" },
            { selector: ":scope > g:nth-of-type(2) > circle" },
            { selector: ":scope > path", clip: ":scope > g:first-of-type > circle" }
          ],
          origin: "28% 28%"
        }
      },
      animations: {
        press: [{ target: "bubble", keyframes: { y: [0, -2, 0] }, duration: 0.2 }]
      }
    }
    const container = document.createElement("div")
    document.body.append(container)
    const app = createApp(AnimatedEmoji, { data: composedData })

    app.mount(container)
    await vi.waitFor(() => {
      expect(container.querySelector("[data-emtionji-part='bubble']")).not.toBeNull()
    })

    const part = container.querySelector<SVGGElement>("[data-emtionji-part='bubble']")!
    expect(part.querySelectorAll(":scope > circle")).toHaveLength(2)
    expect(part.querySelector(":scope > circle")?.getAttribute("fill")).toBe("#50A5E6")
    expect(part.querySelector("[clip-path] path")).not.toBeNull()
    expect(container.querySelectorAll("svg > path")).toHaveLength(0)
    app.unmount()
  })
})
