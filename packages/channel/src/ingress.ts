import { Context } from "effect"
import type { IncomingMessage } from "./types.ts"

export interface IngressService {
  readonly read: () => Promise<IncomingMessage | undefined>
  readonly depth: () => Promise<number>
}

export class Ingress extends Context.Tag("effect-agent/Ingress")<Ingress, IngressService>() {}
