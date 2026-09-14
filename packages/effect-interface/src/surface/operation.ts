import type { z } from "zod"

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

export interface CredentialBinding {
  readonly field: string
  readonly header: string
  readonly prefix?: string
}

export interface HttpBinding {
  readonly method: HttpMethod
  readonly path: string
  readonly from?: "query" | "body"
  readonly bodyField?: string
  readonly contentType?: string
  readonly status?: number
  readonly credential?: CredentialBinding
}

export interface OperationContext {
  readonly request?: Request
}

export interface Operation {
  readonly name: string
  readonly description: string
  readonly access: "read" | "write"
  readonly input: z.ZodObject
  readonly handler: (input: never, context: OperationContext) => unknown
  readonly http?: HttpBinding
}

export class OperationFault extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = "OperationFault"
  }
}

export const operation = <S extends z.ZodObject>(spec: {
  readonly name: string
  readonly description: string
  readonly access?: "read" | "write"
  readonly input: S
  readonly handler: (input: z.infer<S>, context: OperationContext) => unknown
  readonly http?: HttpBinding
}): Operation => ({ access: "write", ...spec }) as unknown as Operation
