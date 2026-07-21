import { parse } from "@twemoji/parser"

export const twemojiAssetBase = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.2/assets/svg/"

const svgCaches = new WeakMap<typeof fetch, Map<string, Promise<string>>>()
const allowedTags = new Set([
  "svg",
  "g",
  "path",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "rect",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask"
])

export function resolveEmojiAssetUrl(emoji: string) {
  const entities = parse(emoji, {
    assetType: "svg",
    buildUrl: codepoints => `${twemojiAssetBase}${codepoints}.svg`
  })
  if (entities.length !== 1 || entities[0]?.text !== emoji) {
    throw new TypeError(`Expected exactly one supported emoji, received '${emoji}'`)
  }
  return entities[0].url
}

function sanitizeSvg(source: string) {
  const document = new DOMParser().parseFromString(source, "image/svg+xml")
  if (document.querySelector("parsererror") || document.documentElement.localName !== "svg") {
    throw new TypeError("Emoji asset is not valid SVG")
  }
  for (const element of Array.from(document.querySelectorAll("*"))) {
    if (!allowedTags.has(element.localName)) {
      element.remove()
      continue
    }
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name) || /^(?:href|xlink:href)$/i.test(attribute.name) || /(?:javascript:|data:|https?:)/i.test(attribute.value)) {
        element.removeAttribute(attribute.name)
      }
    }
  }
  document.documentElement.removeAttribute("width")
  document.documentElement.removeAttribute("height")
  return new XMLSerializer().serializeToString(document.documentElement)
}

export async function emojiToSvg(emoji: string, fetcher: typeof fetch = fetch) {
  const url = resolveEmojiAssetUrl(emoji)
  let svgCache = svgCaches.get(fetcher)
  if (!svgCache) {
    svgCache = new Map()
    svgCaches.set(fetcher, svgCache)
  }
  const cached = svgCache.get(url)
  if (cached) {
    return cached
  }
  const request = fetcher(url).then(async response => {
    if (!response.ok) {
      throw new Error(`Unable to load emoji SVG (${response.status})`)
    }
    return sanitizeSvg(await response.text())
  }).catch(error => {
    svgCache.delete(url)
    throw error
  })
  svgCache.set(url, request)
  return request
}

export function createSvgElement(source: string) {
  const document = new DOMParser().parseFromString(source, "image/svg+xml")
  if (document.querySelector("parsererror") || document.documentElement.localName !== "svg") {
    throw new TypeError("Emoji asset is not valid SVG")
  }
  return document.documentElement as unknown as SVGSVGElement
}
