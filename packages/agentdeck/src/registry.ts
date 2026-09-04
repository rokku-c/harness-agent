/**
 * agentdeck/registry - gateway registry: resolve an agent kind to its
 * adapter and enumerate what the deck controls. One deck = one shared
 * consent ledger across every agent it drives.
 */
import type { ConsentLedger, SessionGateway, SessionStatus } from "./types.ts"
import { makeConsentLedger } from "./consent.ts"

export class AgentDeck {
  readonly #gateways = new Map<string, SessionGateway>()
  readonly consent: ConsentLedger

  constructor(consent?: ConsentLedger) {
    this.consent = consent ?? makeConsentLedger()
  }

  /** install a gateway for one agent kind (last one wins) */
  readonly register = (gateway: SessionGateway): AgentDeck => {
    this.#gateways.set(gateway.kind, gateway)
    return this
  }

  readonly get = (kind: string): SessionGateway | undefined => this.#gateways.get(kind)

  readonly kinds = (): ReadonlyArray<string> => [...this.#gateways.keys()]

  /** sessions across every registered gateway */
  readonly sessions = (): ReadonlyArray<SessionStatus> =>
    [...this.#gateways.values()].flatMap((g) => g.sessions())
}
