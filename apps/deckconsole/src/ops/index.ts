import type { Operation } from "@effect-agent/effect-interface"
import type { DeckDomain } from "../domain/deck.ts"
import { consentOperations } from "./consent-ops.ts"
import { launcherOperations } from "./launcher-ops.ts"
import { overviewOperations } from "./overview-ops.ts"
import { presetOperations } from "./preset-ops.ts"
import { sessionOperations } from "./session-ops.ts"
import { turnOperations } from "./turn-ops.ts"

export const deckOperations = (domain: DeckDomain): readonly Operation[] => [
  ...overviewOperations(domain),
  ...sessionOperations(domain),
  ...turnOperations(domain),
  ...launcherOperations(domain),
  ...presetOperations(domain),
  ...consentOperations(domain),
]
