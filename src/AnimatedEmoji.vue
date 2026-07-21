<script setup lang="ts">
import type { AnimationPlaybackControlsWithThen } from "motion"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type { AmbientPlayOptions } from "./component"
import {
  loadEmtionjiData,
  parseEmtionjiData,
  type EmtionjiData,
  type PartDefinition,
  type PartMemberDefinition
} from "./definition"
import { createSvgElement, emojiToSvg } from "./emojiToSvg"
import { playTracks } from "./runtime"

const props = defineProps<{
  data: EmtionjiData | string
  ambientPlay?: AmbientPlayOptions
}>()

const emit = defineEmits<{
  play: [emoji: string]
  complete: [emoji: string]
  error: [error: Error]
}>()

const host = ref<HTMLElement | null>(null)
const ready = ref(false)
const playing = ref(false)
const definition = ref<EmtionjiData | null>(null)
const emoji = computed(() => definition.value?.emoji ?? "")
let svg: SVGSVGElement | null = null
let parts = new Map<string, SVGElement[]>()
let controls: AnimationPlaybackControlsWithThen[] = []
let restingAttributes = new Map<SVGElement, Map<string, string>>()
let keyboardDirection: -1 | 1 = 1
let generation = 0
let clipSequence = 0
let ambientTimer: ReturnType<typeof setInterval> | undefined
const instanceId = Math.random().toString(36).slice(2)
const inheritedPresentationAttributes = [
  "color",
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "opacity"
]

type ResolvedMember = {
  definition: PartMemberDefinition
  targets: SVGElement[]
  clipTarget?: SVGElement
}

type ResolvedPart = {
  name: string
  definition: PartDefinition
  targets?: SVGElement[]
  members?: ResolvedMember[]
}

function stop() {
  controls.forEach(control => control.stop())
  controls = []
  restoreParts()
  generation += 1
  playing.value = false
}

function restoreParts() {
  for (const [element, attributes] of restingAttributes) {
    for (const attribute of Array.from(element.attributes)) {
      if (!attributes.has(attribute.name)) {
        element.removeAttribute(attribute.name)
      }
    }
    for (const [name, value] of attributes) {
      element.setAttribute(name, value)
    }
  }
}

function queryPartElements(selector: string, label: string) {
  try {
    const targets = Array.from(svg!.querySelectorAll<SVGElement>(selector))
    if (targets.length === 0) {
      throw new TypeError(`${label} matched no SVG elements: ${selector}`)
    }
    return targets
  } catch (cause) {
    if (cause instanceof TypeError && cause.message.includes("matched no SVG elements")) {
      throw cause
    }
    throw new TypeError(`Invalid selector for ${label}: ${selector}`, { cause })
  }
}

function preserveInheritedPresentation(source: SVGElement, target: SVGElement) {
  for (const attribute of inheritedPresentationAttributes) {
    if (target.hasAttribute(attribute)) {
      continue
    }
    let ancestor = source.parentElement
    while (ancestor && ancestor.tagName.toLowerCase() !== "svg") {
      if (ancestor.hasAttribute(attribute)) {
        target.setAttribute(attribute, ancestor.getAttribute(attribute)!)
        break
      }
      ancestor = ancestor.parentElement
    }
  }
}

function generatedDefs() {
  let defs = svg!.querySelector<SVGDefsElement>(":scope > defs[data-emtionji-generated]")
  if (!defs) {
    defs = svg!.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "defs")
    defs.dataset.emtionjiGenerated = ""
    svg!.insertBefore(defs, svg!.firstChild)
  }
  return defs
}

function createClippedLayer(member: ResolvedMember, sourcesToRemove: Set<SVGElement>) {
  const clipId = `emtionji-${instanceId}-${clipSequence++}`
  const clipPath = svg!.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "clipPath")
  clipPath.id = clipId
  clipPath.setAttribute("clipPathUnits", "userSpaceOnUse")
  clipPath.appendChild(member.clipTarget!.cloneNode(true))
  generatedDefs().appendChild(clipPath)

  const layer = svg!.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g")
  layer.setAttribute("clip-path", `url(#${clipId})`)
  for (const source of member.targets) {
    const clone = source.cloneNode(true) as SVGElement
    preserveInheritedPresentation(source, clone)
    layer.appendChild(clone)
    sourcesToRemove.add(source)
  }
  return layer
}

function bindParts() {
  const current = definition.value
  if (!svg || !current) {
    return
  }
  parts = new Map()
  const resolvedParts: ResolvedPart[] = Object.entries(current.parts).map(([name, part]) => {
    if (part.selector) {
      return {
        name,
        definition: part,
        targets: queryPartElements(part.selector, `emtionji part '${name}'`)
      }
    }
    return {
      name,
      definition: part,
      members: part.members!.map((member, index) => {
        const targets = queryPartElements(member.selector, `member ${index} of emtionji part '${name}'`)
        const clipTargets = member.clip
          ? queryPartElements(member.clip, `clip for member ${index} of emtionji part '${name}'`)
          : undefined
        if (clipTargets && clipTargets.length !== 1) {
          throw new TypeError(`Clip for member ${index} of emtionji part '${name}' must match exactly one SVG element`)
        }
        return clipTargets
          ? { definition: member, targets, clipTarget: clipTargets[0]! }
          : { definition: member, targets }
      })
    }
  })
  const sourcesToRemove = new Set<SVGElement>()
  const formerParents = new Set<Element>()

  for (const resolved of resolvedParts) {
    const { name, definition: part } = resolved
    let targets: SVGElement[]
    if (resolved.members) {
      const group = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g")
      for (const member of resolved.members) {
        if (member.definition.clip) {
          group.appendChild(createClippedLayer(member, sourcesToRemove))
          continue
        }
        for (const target of member.targets) {
          if (target.parentElement) {
            formerParents.add(target.parentElement)
          }
          preserveInheritedPresentation(target, target)
          group.appendChild(target)
        }
      }
      svg.appendChild(group)
      targets = [group]
    } else {
      targets = resolved.targets!
    }
    if (targets.length > 1) {
      const parent = targets[0]?.parentNode
      if (!parent || targets.some(target => target.parentNode !== parent)) {
        throw new TypeError(`Selector for emtionji part '${name}' must match sibling SVG elements`)
      }
      const group = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g")
      parent.insertBefore(group, targets[0]!)
      targets.forEach(target => group.appendChild(target))
      targets = [group]
    }
    for (const target of targets) {
      target.dataset.emtionjiPart = name
      if (part.origin) {
        target.style.transformBox = "view-box"
        target.style.transformOrigin = part.origin
      }
    }
    parts.set(name, targets)
  }
  for (const source of sourcesToRemove) {
    if (source.parentElement) {
      formerParents.add(source.parentElement)
    }
    source.remove()
  }
  for (const parent of formerParents) {
    if (parent !== svg && parent.tagName.toLowerCase() === "g" && parent.children.length === 0) {
      parent.remove()
    }
  }
  restingAttributes = new Map(
    Array.from(parts.values()).flat().map(element => [
      element,
      new Map(Array.from(element.attributes).map(attribute => [attribute.name, attribute.value]))
    ])
  )
}

async function load() {
  stop()
  const loadGeneration = generation
  ready.value = false
  definition.value = null
  svg = null
  parts = new Map()
  restingAttributes = new Map()
  host.value?.replaceChildren()
  try {
    const current = typeof props.data === "string"
      ? await loadEmtionjiData(props.data)
      : parseEmtionjiData(props.data)
    if (loadGeneration !== generation) {
      return
    }
    definition.value = current
    const source = await emojiToSvg(current.emoji)
    if (loadGeneration !== generation || !host.value) {
      return
    }
    svg = createSvgElement(source)
    bindParts()
    host.value.replaceChildren(svg)
    ready.value = true
  } catch (cause) {
    if (loadGeneration !== generation) {
      return
    }
    const error = cause instanceof Error ? cause : new Error(String(cause))
    emit("error", error)
  }
}

async function play(event?: MouseEvent) {
  const current = definition.value
  if (!svg || !ready.value || !current) {
    return
  }
  stop()
  const pointer = event && event.detail > 0
  const bounds = svg.getBoundingClientRect()
  const direction: -1 | 1 = pointer
    ? event.clientX < bounds.left + bounds.width / 2 ? -1 : 1
    : (keyboardDirection = keyboardDirection === 1 ? -1 : 1)
  const playGeneration = generation
  playing.value = true
  controls = playTracks(current.animations.press, parts, {
    direction,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
  })
  emit("play", current.emoji)
  await Promise.all(controls)
  if (generation === playGeneration) {
    restoreParts()
    controls = []
    playing.value = false
    emit("complete", current.emoji)
  }
}

function clearAmbientPlay() {
  if (ambientTimer !== undefined) {
    clearInterval(ambientTimer)
    ambientTimer = undefined
  }
}

function syncAmbientPlay() {
  clearAmbientPlay()
  const options = props.ambientPlay
  if (!options) {
    return
  }
  if (!Number.isFinite(options.intervalMs) || options.intervalMs <= 0) {
    emit("error", new TypeError("Invalid ambientPlay.intervalMs: expected a positive finite number"))
    return
  }
  if (!Number.isFinite(options.probability) || options.probability < 0 || options.probability > 1) {
    emit("error", new TypeError("Invalid ambientPlay.probability: expected a number from 0 to 1"))
    return
  }
  ambientTimer = setInterval(() => {
    if (!ready.value || playing.value || document.hidden || Math.random() >= options.probability) {
      return
    }
    void play()
  }, options.intervalMs)
}

watch(() => props.data, load, { deep: true })
watch(() => props.ambientPlay, syncAmbientPlay, { deep: true })
onMounted(() => {
  void load()
  syncAmbientPlay()
})
onBeforeUnmount(() => {
  clearAmbientPlay()
  stop()
})

defineExpose({ play, stop, reload: load })
</script>

<template>
  <span
    class="emtionji"
    role="img"
    :aria-label="emoji || 'animated emoji'"
    :data-emtionji="emoji || undefined"
    :data-emtionji-state="playing ? 'playing' : ready ? 'idle' : 'loading'"
    @click="play"
  >
    <span ref="host" class="emtionji__svg" aria-hidden="true"></span>
    <span v-if="!ready && emoji" class="emtionji__fallback" aria-hidden="true">{{ emoji }}</span>
  </span>
</template>

<style>
.emtionji {
  display: inline-grid;
  width: 1em;
  height: 1em;
  padding: 0;
  place-items: center;
  border: 0;
  color: inherit;
  background: transparent;
  line-height: 1;
  font-family: inherit;
  cursor: pointer;
  overflow: visible;
  touch-action: manipulation;
}

.emtionji__svg,
.emtionji__fallback {
  grid-area: 1 / 1;
}

.emtionji__svg,
.emtionji__svg > svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.emtionji__fallback {
  font-size: 0.78em;
}
</style>
