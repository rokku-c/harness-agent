/**
 * @effect-agent/channel — L1 channel layer
 *
 * Ingress (inbound) and Delivery (outbound) contracts + in-memory default
 * implementation. DingTalk/HTTP/CLI/queues are all adapters; swapping the
 * channel = swapping the Layer.
 */
export * from "./types.ts"
export * from "./ingress.ts"
export * from "./delivery.ts"
export * from "./memory.ts"
