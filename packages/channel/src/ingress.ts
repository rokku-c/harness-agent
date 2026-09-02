/**
 * Ingress: where messages enter (E7 Channel, inbound half). Pull-based so
 * any transport (DingTalk stream, HTTP webhook, CLI stdin, queue) can be an
 * adapter; a poller at the edge decides when to read.
 */
import { Context } from "effect"
import type { IncomingMessage } from "./types.ts"

export interface IngressService {
  /** Pull the next message, or undefined when idle. */
  readonly read: () => Promise<IncomingMessage | undefined>
  /** Number of messages waiting (observability / backpressure). */
  readonly depth: () => Promise<number>
}

export class Ingress extends Context.Tag("effect-agent/Ingress")<Ingress, IngressService>() {}
