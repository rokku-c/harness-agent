import { NAV_ROOT, type EffectUiView } from "@effect-agent/effect-ui"
import { agentRoom } from "./effect-ui-agent-room.ts"
import { fleetScreen } from "./effect-ui-fleet.ts"
import { launchesScreen } from "./effect-ui-launches.ts"
import { machineRoom } from "./effect-ui-machine-room.ts"
import {
  AGENT_LAUNCH, AGENT_PLAN, AGENT_RESOLUTION, AGENT_SCREEN, LAUNCHES_SCREEN, LAUNCHES_SOURCE, MACHINE_BINDING,
  MACHINE_PLAN, MACHINE_SCREEN, PROMPT, SERVERS_SCREEN, STATUS_SOURCE, WORKDIR,
} from "./effect-ui-paths.ts"
import { serversScreen } from "./effect-ui-servers.ts"

const opened = (name: string) => ({ [name]: { state: `${NAV_ROOT}/${name}` } }) as const

export const effectUiView: EffectUiView = {
  viewId: "agentd-console",
  title: "agentd",
  state: {
    status: { machines: [], agents: [], servers: [], sets: [] },
    launch: { workdir: "", prompt: "" },
    launches: { launches: [] },
  },
  sources: [
    { id: STATUS_SOURCE, url: "/agentd", state: "/status", refreshMs: 10000 },
    { id: LAUNCHES_SOURCE, url: "/agentd/launch", state: "/launches", refreshMs: 8000 },
  ],
  actions: [
    { name: "agentd.openAgent", opens: AGENT_SCREEN },
    { name: "agentd.openMachine", opens: MACHINE_SCREEN },
    { name: "agentd.openLaunches", opens: LAUNCHES_SCREEN },
    { name: "agentd.openServers", opens: SERVERS_SCREEN },
    { name: "agentd.desired", method: "GET", url: "/agentd/desired?agentId={agentId}", params: opened("agentId"),
      result: AGENT_RESOLUTION, clear: [AGENT_PLAN, AGENT_LAUNCH] },
    { name: "agentd.plan", method: "GET", url: "/agentd/plan?agentId={agentId}", params: opened("agentId"),
      result: AGENT_PLAN },
    { name: "agentd.launch", method: "POST", url: "/agentd/launch",
      params: { ...opened("agentId"), workdir: { state: WORKDIR }, prompt: { state: PROMPT } },
      result: AGENT_LAUNCH, clear: [PROMPT], refresh: [LAUNCHES_SOURCE] },
    { name: "agentd.node", method: "GET", url: "/agentd/node?nodeId={nodeId}", params: opened("nodeId"),
      result: MACHINE_BINDING, clear: [MACHINE_PLAN] },
    { name: "agentd.nodePlan", method: "GET", url: "/agentd/node/plan?nodeId={nodeId}", params: opened("nodeId"),
      result: MACHINE_PLAN },
    { name: "agentd.retryStatus", refresh: [STATUS_SOURCE] },
    { name: "agentd.retryLaunches", refresh: [LAUNCHES_SOURCE] },
  ],
  nodes: fleetScreen,
  screens: [
    { id: AGENT_SCREEN, title: "Fleet agent", onEnter: "agentd.desired", nodes: agentRoom },
    { id: MACHINE_SCREEN, title: "Machine", onEnter: "agentd.node", nodes: machineRoom },
    { id: LAUNCHES_SCREEN, title: "Launches", nodes: launchesScreen },
    { id: SERVERS_SCREEN, title: "MCP servers", nodes: serversScreen },
  ],
}
