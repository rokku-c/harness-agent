/**
 * mcp/lifecycle.ts - SESSION LIFECYCLE tools.
 *
 * Concept: drive one mantis session turn (sync or fire-and-poll via
 * mantis_events), enumerate conversations and read one conversation's full
 * timeline, plus the whole-console snapshot. All read the WebConsole seam;
 * nothing here knows how a session is implemented.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { chatId, text } from "./helpers.ts"
import type { WebConsole } from "../../webui/console.ts"

export const registerLifecycle = (server: McpServer, web: WebConsole): void => {
  server.tool(
    "mantis_chat",
    "Send one message to a mantis session and return its final reply. " +
      "A session is an effect-agent loop over the shared workspace: use the same " +
      "conversationId to continue a conversation (history is carried). " +
      "Protected tool calls inside the turn wait for an approval - the reply may " +
      "report a denial or timeout; check mantis_pending / mantis_approve.",
    { conversationId: chatId, text: z.string().min(1), wait: z.boolean().optional() },
    async ({ conversationId, text: chatText, wait }) => {
      // wait=false fires the turn and returns immediately; the final reply
      // then arrives as a "reply" event (poll mantis_events)
      if (wait === false) {
        const fired = web.chatFire(conversationId, chatText)
        return text(fired.ok ? "accepted" : "error: " + (fired.detail ?? "?"))
      }
      const result = await web.chatSync(conversationId, chatText)
      return text(result.ok ? (result.reply ?? "(no reply)") : "error: " + (result.detail ?? "turn failed"))
    }
  )

  server.tool(
    "mantis_conversations",
    "List every conversation this mantis server has seen, with turn counts.",
    async () => {
      const conversations = web.conversations()
      return text(conversations.length === 0 ? "(none)" : conversations.map((c) => c.conversationId + " (" + c.turns + " turns)").join("\n"))
    }
  )

  server.tool(
    "mantis_conversation",
    "Read one conversation's full timeline (messages AND the agent's tool " +
      "steps, oldest first) - one JSON object per line: " +
      '{"seq":n,"ts":n,"kind":"msg"|"tool",...}. Use it to see what a session ' +
      "did (which tools it called, with payload summaries) without replaying events.",
    { conversationId: chatId },
    async ({ conversationId }) => {
      const entries = web.conversationTimeline(conversationId)
      return text(entries.length === 0 ? "(empty)" : entries.map((e) => JSON.stringify(e)).join("\n"))
    }
  )

  server.tool(
    "mantis_events",
    "Events since a timestamp (ms epoch) - message.in / reply / approval.pending / approval.resolved / ui.updated / session.start / session.stop / log. Poll with the last seen ts; the console streams these to the browser.",
    { after: z.number() },
    async ({ after }) => {
      const events = web.bus.after(after)
      return text(events.length === 0 ? "(none)" : events.map((e) => JSON.stringify(e)).join("\n"))
    }
  )

  server.tool(
    "mantis_state",
    "A snapshot of the whole console: conversations + turn counts, pending approvals, agent-UI latest version, approvalsOn.",
    async () => text(JSON.stringify(web.state()))
  )
}
