import { Schema } from "effect"

export class FinalReply extends Schema.Class<FinalReply>("MantisFinalReply")({
  reply: Schema.String,
  tone: Schema.Literal("plain", "emoji"),
  asksConfirmation: Schema.Boolean
}) {}
