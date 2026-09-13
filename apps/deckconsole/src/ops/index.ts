/**
 * This deck's whole surface, declared once.
 *
 * Every declaration here is served twice - as an MCP tool and as the HTTP route
 * the console already called - from this one list, so an agent and the page
 * cannot drift into two decks that accept different input or answer a call
 * differently. What is left for the router to do is the assets and its own 404:
 * a path no operation declares is a path this app does not have.
 */
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
