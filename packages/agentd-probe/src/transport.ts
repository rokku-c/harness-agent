import type {
  AdapterPlan, DeclaredMachine, GatewayAgentConfig, LaunchIntent, LaunchState, MachineReport, NodeAdapterPlan,
  NodePresence, SessionRecord, WireArtifact,
} from "@effect-agent/agentd"
import { makeCaller, type CallOptions } from "./call.ts"
import { artifactMissing, gatewayRefused, planRefused } from "./faults.ts"

/**
 * The outbound half of §8.5-1, and nothing else. The probe asks; it never
 * listens — a resident program on a machine behind NAT has to work by calling
 * out, which is also why this is a plain `fetch` client rather than the app
 * egress router: the router answers "what may an *app* reach", and a probe is
 * not an app on this machine, it is the machine's own voice.
 */
export interface NodeControl {
  readonly announce: (machine: DeclaredMachine) => Promise<NodePresence>
  readonly heartbeat: (nodeId: string) => Promise<NodePresence>
  readonly withdraw: (nodeId: string) => Promise<NodePresence>
  /**
   * What this node should run, fully adjudicated. The desired set is read from
   * here and not from `/agentd/node` beside it: the plan *contains* the desired
   * deployment and the verdict on it, and asking twice would be two reads that
   * can disagree.
   */
  readonly plan: (nodeId: string) => Promise<NodeAdapterPlan>
  readonly report: (nodeId: string, revision: number, state: unknown) => Promise<unknown>
  /**
   * One published version's bytes (§8.2, P6), as they crossed the wire. Verified
   * by the caller and not here: "do not write bytes that do not add up" belongs
   * where the writing happens, and this file stays the dumb end of the socket.
   */
  readonly artifact: (bundleId: string) => Promise<WireArtifact>
  /**
   * The config one of this machine's agents must run with (§F10), carrying the
   * credential the door will verify. Fetched with the node credential, exactly as
   * bytes are: a secret is fetched, never browsed. Fetched per intent rather than
   * once per beat, so a credential revoked between the queue and the claim is a
   * refusal here instead of a process already running with it.
   */
  readonly gatewayConfig: (agentId: string, reported?: unknown) => Promise<AdapterPlan<GatewayAgentConfig>>
  /**
   * Work for this machine, claimed on the way out. The queue is pulled, not
   * pushed — a machine that cannot be called has to ask — and claiming is what
   * makes an intent this machine's own: after that the center offers it to
   * nobody else, so a second machine cannot do the same work twice.
   */
  readonly claim: (machineId: string, limit?: number) => Promise<readonly LaunchIntent[]>
  /** What became of one it claimed. Only the machine holding it may say. */
  readonly settle: (intentId: string, machineId: string, state: LaunchState, detail?: string) => Promise<LaunchIntent>
  /**
   * What this machine's agents are and what they are configured to talk to, as
   * its own probe found them. Pushed rather than fetched: the machine is the one
   * that can read its home directories, and the center never reaches back.
   */
  readonly reportFacts: (machineId: string, facts: unknown) => Promise<MachineReport>
  /** The sessions that machine has now — a snapshot, so a deleted one stops being reported. */
  readonly reportSessions: (machineId: string, sessions: readonly SessionRecord[]) => Promise<MachineReport>
  /** Why this machine was not read. Not the same as a machine with nothing to report. */
  readonly reportNote: (machineId: string, note: string) => Promise<MachineReport>
}

export const makeNodeControl = (options: CallOptions): NodeControl => {
  const { call } = makeCaller(options)
  const presenceOf = async (verb: "announce" | "heartbeat" | "withdraw", body: unknown): Promise<NodePresence> =>
    (await call("POST", `/agentd/node/${verb}`, body)).presence as NodePresence
  return {
    announce: async (machine) => await presenceOf("announce", { machine }),
    heartbeat: async (nodeId) => await presenceOf("heartbeat", { nodeId }),
    withdraw: async (nodeId) => await presenceOf("withdraw", { nodeId }),
    plan: async (nodeId) =>
      await call("GET", `/agentd/node/plan?nodeId=${encodeURIComponent(nodeId)}`, undefined, planRefused) as unknown as NodeAdapterPlan,
    report: async (nodeId, revision, state) => (await call("POST", "/agentd/node/report", { nodeId, revision, state })).report,
    artifact: async (bundleId) =>
      (await call("GET", `/agentd/artifact?id=${encodeURIComponent(bundleId)}`, undefined, artifactMissing)).artifact as WireArtifact,
    gatewayConfig: async (agentId, reported) => {
      // the document is text in a query string — there is no object syntax in a
      // URL — and the server reads it back with the same `json` field shape the
      // op declares, so one field serves both surfaces
      const said = reported === undefined ? "" : `&reported=${encodeURIComponent(JSON.stringify(reported))}`
      const path = `/agentd/gateway?agentId=${encodeURIComponent(agentId)}${said}`
      return (await call("GET", path, undefined, gatewayRefused)).plan as AdapterPlan<GatewayAgentConfig>
    },
    claim: async (machineId, limit) =>
      (await call("POST", "/agentd/launch/poll", { machineId, ...(limit === undefined ? {} : { limit }) })).launches as readonly LaunchIntent[],
    settle: async (intentId, machineId, state, detail) =>
      (await call("POST", "/agentd/launch/report", {
        intentId, machineId, state, ...(detail === undefined ? {} : { detail }),
      })).launch as LaunchIntent,
    reportFacts: async (machineId, facts) =>
      (await call("POST", "/agentd/facts", { machineId, facts })).report as MachineReport,
    reportSessions: async (machineId, sessions) =>
      (await call("POST", "/agentd/sessions", { machineId, sessions })).report as MachineReport,
    reportNote: async (machineId, note) =>
      (await call("POST", "/agentd/note", { machineId, note })).report as MachineReport,
  }
}
