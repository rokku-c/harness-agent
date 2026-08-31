/**
 * The progress stream: everything a run wants observable by its supervisor.
 * Child progress and completion are forwarded into the parent's signal box,
 * so a supervisor SEES its children between its own steps.
 */
export type AgentEvent =
  | { readonly _tag: "Step"; readonly agent: string; readonly step: number }
  | { readonly _tag: "ToolUse"; readonly agent: string; readonly tool: string; readonly input: unknown }
  | { readonly _tag: "ToolResult"; readonly agent: string; readonly tool: string; readonly output: unknown }
  | { readonly _tag: "Progress"; readonly agent: string; readonly text: string }
  | { readonly _tag: "ChildCompleted"; readonly childId: string; readonly agent: string; readonly output: unknown }
  | { readonly _tag: "ChildFailed"; readonly childId: string; readonly agent: string; readonly error: string }

