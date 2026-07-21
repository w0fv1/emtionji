import { animate, type AnimationPlaybackControlsWithThen } from "motion"
import type { AnimationTrack, KeyframeValue, MotionProperty } from "./definition"

export type PlayContext = {
  direction: -1 | 1
  reducedMotion: boolean
}

export function smoothNumericKeyframes(frames: number[], subdivisions = 3): number[] {
  if (frames.length < 2 || subdivisions < 2) {
    return [...frames]
  }
  const smoothed = [frames[0]!]
  for (let index = 0; index < frames.length - 1; index += 1) {
    const p0 = frames[Math.max(0, index - 1)]!
    const p1 = frames[index]!
    const p2 = frames[index + 1]!
    const p3 = frames[Math.min(frames.length - 1, index + 2)]!
    for (let step = 1; step <= subdivisions; step += 1) {
      if (step === subdivisions) {
        smoothed.push(p2)
        continue
      }
      const t = step / subdivisions
      const t2 = t * t
      const t3 = t2 * t
      const value = 0.5 * (
        (2 * p1)
        + (-p0 + p2) * t
        + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
        + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
      )
      const lower = Math.min(p1, p2)
      const upper = Math.max(p1, p2)
      smoothed.push(Number(Math.min(upper, Math.max(lower, value)).toFixed(6)))
    }
  }
  return smoothed
}

export function resolveKeyframes(
  track: AnimationTrack,
  direction: -1 | 1
): Partial<Record<MotionProperty, KeyframeValue[]>> {
  const directional = new Set(track.directional)
  return Object.fromEntries(Object.entries(track.keyframes).map(([property, frames]) => {
    const typedProperty = property as MotionProperty
    const resolved = frames!.map(frame => typeof frame === "number" && directional.has(typedProperty)
      ? frame * direction
      : frame)
    return [property, resolved.every(frame => typeof frame === "number")
      ? smoothNumericKeyframes(resolved as number[])
      : resolved]
  }))
}

export function playTracks(
  tracks: AnimationTrack[],
  parts: ReadonlyMap<string, SVGElement[]>,
  context: PlayContext
): AnimationPlaybackControlsWithThen[] {
  if (context.reducedMotion) {
    return []
  }
  return tracks.map(track => {
    const targets = parts.get(track.target)
    if (!targets?.length) {
      throw new Error(`Missing rendered emtionji part '${track.target}'`)
    }
    const keyframes = resolveKeyframes(track, context.direction)
    const numericTrack = Object.values(keyframes).every(frames => frames?.every(frame => typeof frame === "number"))
    return animate(targets, keyframes, {
      duration: track.duration,
      delay: track.delay ?? 0,
      ease: numericTrack ? "linear" : (track.ease ?? "easeInOut")
    })
  })
}
