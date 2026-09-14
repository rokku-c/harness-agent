import { Effect } from "effect"
import {
  AgentRegistry, AgentRuntime, Boards, Groups, type Binding
} from "@effect-agent/core"
import { batchOps } from "../batch.ts"
import { boardOps } from "../boards.ts"
import { groupOps } from "../groups.ts"
import { progressOp } from "../signals.ts"
import { spawnOps } from "./lifecycle.ts"
import { signalOps } from "./child-ops.ts"

export const runtimeBinding: Binding<any, any, AgentRuntime | AgentRegistry | Boards | Groups> = {
  uri: "ea://runtime/agents",
  read: Effect.map(AgentRegistry, (registry) => ({
    _tag: "Text" as const,
    text: "Registered agents you may spawn: " + (registry.names().join(", ") || "(none)")
  })),
  ops: [...spawnOps(), ...batchOps(), ...signalOps(), ...groupOps(), ...boardOps(), progressOp()]
}

export const childBinding: Binding<any, any, Boards> = {
  uri: "ea://runtime/child",
  ops: [...boardOps(), progressOp()]
}
