/**
 * The context is the agent's memory surface: an immutable log of content
 * entries. Drivers render it, append to it, and read it back - the loop is
 * context transformation.
 */
export type Content =
  | { readonly _tag: "Text"; readonly text: string }
  | { readonly _tag: "Thinking"; readonly text: string }
  | { readonly _tag: "ToolCall"; readonly id: string; readonly name: string; readonly input: unknown }
  | { readonly _tag: "ToolResult"; readonly id: string; readonly name: string; readonly output: unknown }
  | { readonly _tag: "Object"; readonly value: unknown }

export class AgentContext {
  static empty = new AgentContext([])
  static text = (text: string) => new AgentContext([{ _tag: "Text", text }])
  constructor(readonly entries: ReadonlyArray<Content>) {}
  append = (...entries: ReadonlyArray<Content>) => new AgentContext([...this.entries, ...entries])
  get lastText(): string | undefined {
    return this.entries.findLast((entry): entry is Extract<Content, { _tag: "Text" }> => entry._tag === "Text")?.text
  }
  render = () =>
    this.entries
      .map((entry) =>
        entry._tag === "Text" || entry._tag === "Thinking"
          ? entry._tag + ": " + entry.text
          : entry._tag + ": " + JSON.stringify(entry)
      )
      .join("\n")
}

