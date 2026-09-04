/**
 * The mantis reply contract: how a session ends. mantis's hidden control
 * tool (final_reply_resolution) is expressed as the agent's OUTPUT TYPE -
 * the agent declares what it returns by declaring when it stops
 * (Until.schema). The model decides, structurally, whether and how to reply.
 */
import { Schema } from "effect"

export class FinalReply extends Schema.Class<FinalReply>("MantisFinalReply")({
  /** the actual reply text sent to the human */
  reply: Schema.String,
  /** presentation hint (mantis's reaction/emoji layer, kept as data) */
  tone: Schema.Literal("plain", "emoji"),
  /** whether the session still needs a human step (confirmation/escalation) */
  asksConfirmation: Schema.Boolean
}) {}
