import type { HerdrClient } from "../herdr-client.ts"
import { typed, type HerdrAgent, type HerdrAgentWithTail, type HerdrRead } from "./surfaces.ts"

const tailed = async (client: HerdrClient, agent: HerdrAgent, lines: number): Promise<HerdrAgentWithTail> => {
  try {
    const answer = typed<{ read: HerdrRead }>(
      await client.call("agent.read", { target: agent.pane_id, source: "recent", lines }),
    )
    return { ...agent, tail: { text: answer.read.text, truncated: answer.read.truncated } }
  } catch {
    return agent
  }
}

export const withTails = (
  client: HerdrClient,
  agents: readonly HerdrAgent[],
  lines: number,
): Promise<readonly HerdrAgentWithTail[]> => Promise.all(agents.map((agent) => tailed(client, agent, lines)))
