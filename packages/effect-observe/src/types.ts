import { stableString } from "@effect-agent/canonical-json"

export type Perspective = "app" | "agent" | "global"

export type Sampler = (perspective: Perspective, target: string) => unknown | Promise<unknown>

export interface ObservationSnapshot {
  at: number
  perspective: Perspective
  target: string
  data: unknown
}

export const jsonHash = (value: unknown): string => {
  const json = stableString(value)
  let hash = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}
