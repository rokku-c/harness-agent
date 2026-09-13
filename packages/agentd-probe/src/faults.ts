/**
 * What an *endpoint* knows about a status that the generic reading cannot.
 *
 * `call.ts` holds the default — a 4xx is about this caller, a 5xx is the server
 * breaking, a 404 is a lapsed lease — and applies it to every verb that has
 * nothing more to say. These three are the verbs that do, and each is here
 * rather than at its call site because the reading is the whole difference
 * between a machine that keeps working and one that stops: a 404 on an artifact
 * and a 404 on a node carry the same number and mean opposite things.
 */
import { byStatus } from "./call.ts"
import { ProbeFault } from "./errors.ts"

/** On the plan, a 400 is the plan builder refusing this deployment, not this caller. */
export const planRefused = (status: number, detail: string, where: string): ProbeFault =>
  status === 400 ? new ProbeFault("plan", `${where}: ${detail}`, status) : byStatus(status, detail, where)

/**
 * On an artifact, 404 is "this version has no bytes" — the server telling the
 * truth about the fleet, not saying the node is unknown. Reading it as a lapsed
 * lease would send the node off to announce itself again, which fixes nothing.
 */
export const artifactMissing = (status: number, detail: string, where: string): ProbeFault =>
  status === 404 ? new ProbeFault("refused", `${where}: ${detail}`, status) : byStatus(status, detail, where)

/**
 * On a gateway config, a 4xx is a sentence about *one agent*, not about this
 * caller: nobody issued that identity a credential, or the center was never told
 * where the door is. Reading it as `refused` — which is what an unclassified 400
 * means everywhere else — would stop the whole machine's beat over one agent, so
 * it is `plan`, and `runLaunches` settles that one intent with it and keeps
 * going. A 401 is the exception and stays what it is everywhere: the node
 * credential was rejected, which is about this machine and halts.
 */
export const gatewayRefused = (status: number, detail: string, where: string): ProbeFault =>
  status === 401 ? byStatus(status, detail, where) : new ProbeFault("plan", `${where}: ${detail}`, status)
