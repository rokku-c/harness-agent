/**
 * One operation, declared once and served on every surface.
 *
 * The declaration is the contract: the input schema validates an HTTP body or
 * query *and* an MCP tool's arguments, the description is the tool description,
 * and the handler is the behaviour. A surface is then a projection of the same
 * list - `toEffectTools` for MCP, `toHttpHandler` for HTTP - so the two cannot
 * drift into accepting different input or answering differently.
 */
import type { z } from "zod"

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

/**
 * A value the transport supplies rather than the caller: a token travels in a
 * header over HTTP, so it stays out of bodies and body logs, and as an ordinary
 * argument over MCP, where there is no header to put it in.
 */
export interface CredentialBinding {
  readonly field: string
  readonly header: string
  readonly prefix?: string
}

export interface HttpBinding {
  readonly method: HttpMethod
  /** Absolute path; `:name` segments are bound from the URL into input fields. */
  readonly path: string
  /** Where the rest of the input comes from. Default: query for GET/DELETE, body otherwise. */
  readonly from?: "query" | "body"
  /**
   * When the body IS one field rather than the whole input: a PATCH of a task
   * sends the patch itself, while the tool takes `{ id, patch }`.
   */
  readonly bodyField?: string
  /**
   * The answer is the returned value with this content type instead of JSON -
   * a feed, say. The same handler still answers a tool call with that value.
   */
  readonly contentType?: string
  /** Success status. Default 200; a create says 201. */
  readonly status?: number
  readonly credential?: CredentialBinding
}

export interface OperationContext {
  /**
   * The request, when there is one. An operation should not need it: it is here
   * for the rare answer that depends on how it was asked for.
   */
  readonly request?: Request
}

export interface Operation {
  readonly name: string
  readonly description: string
  /** A read is safe to repeat; a write is not replayed after a failure. */
  readonly access: "read" | "write"
  readonly input: z.ZodObject
  readonly handler: (input: never, context: OperationContext) => unknown
  readonly http?: HttpBinding
}

/** An operation that failed with a status of its own, rather than a bug. */
export class OperationFault extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = "OperationFault"
  }
}

/**
 * The handler takes `never` and the spec keeps its own inferred input, which is
 * what lets a fully typed declaration join an untyped list: a handler that takes
 * `{ id: string }` is assignable to one that takes `never`. One cast, here, so
 * every declaration site is typed and the projections need none.
 */
export const operation = <S extends z.ZodObject>(spec: {
  readonly name: string
  readonly description: string
  readonly access?: "read" | "write"
  readonly input: S
  readonly handler: (input: z.infer<S>, context: OperationContext) => unknown
  readonly http?: HttpBinding
}): Operation => ({ access: "write", ...spec }) as unknown as Operation
