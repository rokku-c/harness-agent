import type { EffectUiView } from "@effect-agent/effect-ui"

/**
 * mcp-registry catalog console as a declarative effect-ui view
 * (renderer-agnostic). Describes the registry surface: server count,
 * era tags, the server list and open/register actions.
 */
export const effectUiView: EffectUiView = {
  viewId: "mcp-registry-console",
  title: "mcp-registry console",
  nodes: [
    { kind: "text", text: "mcp-registry · catalog of MCP servers & apps" },
    {
      kind: "text",
      text: "0 healthy · 0 warn · 0 offline — 0 servers registered",
    },
    { kind: "text", text: "era tags: modern · auto · legacy" },
    {
      kind: "list",
      items: [
        "board        modern   stdio           healthy   ui://board/console",
        "deckconsole  modern   stdio           healthy   ui://deckconsole/console",
        "ai-gateway   auto     streamable-http healthy   —",
      ],
    },
    {
      kind: "stack",
      direction: "horizontal",
      gap: 8,
      children: [
        { kind: "button", label: "Open catalog", onPress: "open.mcp-registry" },
        { kind: "button", label: "Register server", onPress: "register.mcp-registry" },
      ],
    },
    {
      kind: "formField",
      label: "Filter by era",
      placeholder: "modern | auto | legacy",
    },
  ],
}
