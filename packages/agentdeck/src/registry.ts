import type { ConsentLedger } from "./consent-types.ts"
import type { SessionGateway, SessionStatus } from "./flow.ts"
import { makeConsentLedger } from "./consent.ts"

export class AgentDeck {
  readonly #gateways = new Map<string, SessionGateway>()
  readonly consent: ConsentLedger

  constructor(consent?: ConsentLedger) {
    this.consent = consent ?? makeConsentLedger()
  }

  readonly register = (gateway: SessionGateway): AgentDeck => {
    this.#gateways.set(gateway.kind, gateway)
    return this
  }

  readonly get = (kind: string): SessionGateway | undefined => this.#gateways.get(kind)

  readonly kinds = (): ReadonlyArray<string> => [...this.#gateways.keys()]

  readonly sessions = (): ReadonlyArray<SessionStatus> =>
    [...this.#gateways.values()].flatMap((g) => g.sessions())
}
