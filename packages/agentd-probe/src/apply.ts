import { makeNodeArtifactAdapter, type NodeAdapterPlan } from "@effect-agent/agentd"

export const declarativeApply = (plan: NodeAdapterPlan): Promise<unknown> => makeNodeArtifactAdapter().apply(plan)
