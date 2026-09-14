import { z } from "@effect-agent/effect-config"

export const target = z.string().min(1)

export const readSource = z.enum(["visible", "recent", "recent_unwrapped", "detection"])

export const agentStatus = z.enum(["idle", "working", "blocked", "done", "unknown"])

export const liveName = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/,
  "a name starts with a lowercase letter and holds only lowercase letters, digits, _ or - (at most 32)")

export const withinMs = z.number().int().positive().max(600_000)
