export const motionProperties = [
  "x",
  "y",
  "rotate",
  "scale",
  "scaleX",
  "scaleY",
  "opacity",
  "d",
  "fill",
  "stroke",
  "pathLength"
] as const

export type MotionProperty = typeof motionProperties[number]
export type KeyframeValue = number | string

export type PartMemberDefinition = {
  selector: string
  clip?: string
}

export type PartDefinition = {
  selector?: string
  members?: PartMemberDefinition[]
  origin?: string
}

export type AnimationTrack = {
  target: string
  keyframes: Partial<Record<MotionProperty, KeyframeValue[]>>
  duration: number
  delay?: number
  ease?: "linear" | "easeIn" | "easeOut" | "easeInOut" | [number, number, number, number]
  directional?: MotionProperty[]
}

export type EmtionjiData = {
  version: 1
  emoji: string
  parts: Record<string, PartDefinition>
  animations: {
    press: AnimationTrack[]
  }
}

const propertySet = new Set<string>(motionProperties)
const numericProperties = new Set<MotionProperty>([
  "x",
  "y",
  "rotate",
  "scale",
  "scaleX",
  "scaleY",
  "opacity",
  "pathLength"
])
const neutralNumericValues: Partial<Record<MotionProperty, number>> = {
  x: 0,
  y: 0,
  rotate: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  pathLength: 1
}
const safePart = /^[A-Za-z][A-Za-z0-9_-]*$/
const dataCaches = new WeakMap<typeof fetch, Map<string, Promise<EmtionjiData>>>()

function fail(path: string, message: string): never {
  throw new TypeError(`Invalid emtionji data at ${path}: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "expected a finite number")
  }
  return value
}

function validateTrack(value: unknown, path: string, parts: Set<string>): asserts value is AnimationTrack {
  if (!isRecord(value)) {
    fail(path, "expected an object")
  }
  if (typeof value.target !== "string" || !parts.has(value.target)) {
    fail(`${path}.target`, "expected a declared part")
  }
  const duration = finiteNumber(value.duration, `${path}.duration`)
  if (duration <= 0 || duration > 60) {
    fail(`${path}.duration`, "expected a value greater than 0 and at most 60 seconds")
  }
  if (value.delay !== undefined) {
    const delay = finiteNumber(value.delay, `${path}.delay`)
    if (delay < 0 || delay > 60) {
      fail(`${path}.delay`, "expected a value from 0 to 60 seconds")
    }
  }
  if (!isRecord(value.keyframes) || Object.keys(value.keyframes).length === 0) {
    fail(`${path}.keyframes`, "expected at least one animated property")
  }
  for (const [property, frames] of Object.entries(value.keyframes)) {
    if (!propertySet.has(property)) {
      fail(`${path}.keyframes.${property}`, "unsupported motion property")
    }
    if (!Array.isArray(frames) || frames.length < 2) {
      fail(`${path}.keyframes.${property}`, "expected at least two keyframes")
    }
    const typedProperty = property as MotionProperty
    for (const [index, frame] of frames.entries()) {
      const valid = numericProperties.has(typedProperty)
        ? typeof frame === "number" && Number.isFinite(frame)
        : typeof frame === "string"
      if (!valid) {
        fail(`${path}.keyframes.${property}[${index}]`, numericProperties.has(typedProperty) ? "expected a finite number" : "expected a string")
      }
    }
    const first = frames[0] as KeyframeValue
    const last = frames.at(-1) as KeyframeValue
    if (numericProperties.has(typedProperty)) {
      const neutral = neutralNumericValues[typedProperty]!
      const firstIsNeutral = typedProperty === "rotate"
        ? (first as number) % 360 === 0
        : first === neutral
      const lastIsNeutral = typedProperty === "rotate"
        ? (last as number) % 360 === 0
        : last === neutral
      if (!firstIsNeutral || !lastIsNeutral) {
        fail(`${path}.keyframes.${property}`, "expected neutral first and last keyframes so the part returns to rest")
      }
    } else if (first !== last) {
      fail(`${path}.keyframes.${property}`, "expected matching first and last keyframes so the part returns to rest")
    }
  }
  if (value.directional !== undefined) {
    if (!Array.isArray(value.directional)) {
      fail(`${path}.directional`, "expected an array")
    }
    for (const property of value.directional) {
      if (typeof property !== "string" || !numericProperties.has(property as MotionProperty) || !(property in value.keyframes)) {
        fail(`${path}.directional`, "each property must reference numeric keyframes in this track")
      }
    }
  }
  if (value.ease !== undefined) {
    const named = ["linear", "easeIn", "easeOut", "easeInOut"].includes(value.ease as string)
    const bezier = Array.isArray(value.ease)
      && value.ease.length === 4
      && value.ease.every(point => typeof point === "number" && Number.isFinite(point))
    if (!named && !bezier) {
      fail(`${path}.ease`, "expected a named easing or four-number cubic bezier")
    }
  }
}

export function parseEmtionjiData(value: unknown): EmtionjiData {
  if (!isRecord(value)) {
    fail("$", "expected an object")
  }
  if (value.version !== 1) {
    fail("$.version", "expected schema version 1")
  }
  if (typeof value.emoji !== "string" || value.emoji.trim() === "") {
    fail("$.emoji", "expected one emoji string")
  }
  if (!isRecord(value.parts) || Object.keys(value.parts).length === 0) {
    fail("$.parts", "expected at least one SVG part selector")
  }
  const parts = new Set<string>()
  for (const [name, part] of Object.entries(value.parts)) {
    if (!safePart.test(name)) {
      fail(`$.parts.${name}`, "invalid part identifier")
    }
    if (!isRecord(part)) {
      fail(`$.parts.${name}`, "expected an object")
    }
    const hasSelector = typeof part.selector === "string" && part.selector.trim() !== ""
    const hasMembers = Array.isArray(part.members) && part.members.length > 0
    if (hasSelector === hasMembers) {
      fail(`$.parts.${name}`, "expected exactly one non-empty selector or members array")
    }
    if (hasMembers) {
      for (const [index, member] of (part.members as unknown[]).entries()) {
        if (!isRecord(member) || typeof member.selector !== "string" || member.selector.trim() === "") {
          fail(`$.parts.${name}.members[${index}].selector`, "expected a non-empty CSS selector")
        }
        if (member.clip !== undefined && (typeof member.clip !== "string" || member.clip.trim() === "")) {
          fail(`$.parts.${name}.members[${index}].clip`, "expected a non-empty CSS selector")
        }
      }
    }
    if (part.origin !== undefined && typeof part.origin !== "string") {
      fail(`$.parts.${name}.origin`, "expected a CSS transform origin string")
    }
    parts.add(name)
  }
  if (!isRecord(value.animations) || !Array.isArray(value.animations.press)) {
    fail("$.animations.press", "expected an array")
  }
  value.animations.press.forEach((track, index) => validateTrack(track, `$.animations.press[${index}]`, parts))
  return value as EmtionjiData
}

export async function loadEmtionjiData(source: string, fetcher: typeof fetch = fetch) {
  let dataCache = dataCaches.get(fetcher)
  if (!dataCache) {
    dataCache = new Map()
    dataCaches.set(fetcher, dataCache)
  }
  const cached = dataCache.get(source)
  if (cached) {
    return cached
  }
  const request = fetcher(source).then(async response => {
    if (!response.ok) {
      throw new Error(`Unable to load emtionji data (${response.status})`)
    }
    return parseEmtionjiData(await response.json())
  }).catch(error => {
    dataCache.delete(source)
    throw error
  })
  dataCache.set(source, request)
  return request
}
