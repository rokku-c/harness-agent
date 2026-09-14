import type {
  AdapterPlan, DeclaredMachine, GatewayAgentConfig, LaunchIntent, LaunchState, MachineReport, NodeAdapterPlan,
  NodePresence, SessionRecord, WireArtifact,
} from "@effect-agent/agentd"
import { makeCaller, type CallOptions } from "./call.ts"
import { artifactMissing, gatewayRefused, planRefused } from "./faults.ts"

export interface NodeControl {
  readonly announce: (machine: DeclaredMachine) => Promise<NodePresence>
  readonly heartbeat: (nodeId: string) => Promise<NodePresence>
  readonly withdraw: (nodeId: string) => Promise<NodePresence>
  readonly plan: (nodeId: string) => Promise<NodeAdapterPlan>
  readonly report: (nodeId: string, revision: number, state: unknown) => Promise<unknown>
  readonly artifact: (bundleId: string) => Promise<WireArtifact>
  readonly gatewayConfig: (agentId: string, reported?: unknown) => Promise<AdapterPlan<GatewayAgentConfig>>
  readonly claim: (machineId: string, limit?: number) => Promise<readonly LaunchIntent[]>
  readonly settle: (intentId: string, machineId: string, state: LaunchState, detail?: string) => Promise<LaunchIntent>
  readonly reportFacts: (machineId: string, facts: unknown) => Promise<MachineReport>
  readonly reportSessions: (machineId: string, sessions: readonly SessionRecord[]) => Promise<MachineReport>
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
