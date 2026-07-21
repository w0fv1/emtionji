import { parseEmtionjiData, type EmtionjiData } from "./definition"

const modules = import.meta.glob<unknown>("../examples/emojis/*.json", {
  eager: true,
  import: "default"
})

const entries = Object.values(modules).map((value): readonly [string, EmtionjiData] => {
  const preset = parseEmtionjiData(value)
  return [preset.emoji, preset]
})

export const emtionjiPresets: Readonly<Record<string, EmtionjiData>> = Object.freeze(
  Object.fromEntries(entries)
)

export function getEmtionjiPreset(emoji: string): EmtionjiData {
  const preset = emtionjiPresets[emoji]
  if (!preset) {
    throw new TypeError(`No built-in emtionji preset for ${emoji}`)
  }
  return preset
}

