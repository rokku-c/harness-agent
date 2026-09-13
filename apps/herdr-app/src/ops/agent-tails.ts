/**
 * Recent output, one read per agent.
 *
 * Folding this into the listing costs a read per agent, which is why the number
 * of lines is the caller's to choose and why nothing here is read unless one is
 * asked for.
 *
 * A read that fails leaves its agent in the listing bare. An agent Herdr has
 * forgotten between the listing and this read is one stale row; answering with an
 * empty fleet over it would be a lie about all of them.
 */
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
