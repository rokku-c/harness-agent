import { byStatus } from "./call.ts"
import { ProbeFault } from "./errors.ts"

export const planRefused = (status: number, detail: string, where: string): ProbeFault =>
  status === 400 ? new ProbeFault("plan", `${where}: ${detail}`, status) : byStatus(status, detail, where)

export const artifactMissing = (status: number, detail: string, where: string): ProbeFault =>
  status === 404 ? new ProbeFault("refused", `${where}: ${detail}`, status) : byStatus(status, detail, where)

export const gatewayRefused = (status: number, detail: string, where: string): ProbeFault =>
  status === 401 ? byStatus(status, detail, where) : new ProbeFault("plan", `${where}: ${detail}`, status)
