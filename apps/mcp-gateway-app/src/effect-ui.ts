import type { EffectUiView } from "@effect-agent/effect-ui"

/** mcp-gateway console as a declarative effect-ui view (renderer-agnostic). */
export const effectUiView: EffectUiView = {
  viewId: "mcp-gateway-console",
  title: "mcp-gateway console",
  nodes: [
    { kind: "text", text: "mcp-gateway console" },
    {
      kind: "list",
      items: [
        "route: resolve target MCP server",
        "gate: evaluate access rules",
        "forward: stream json-rpc to upstream",
        "audit: append request/response record",
      ],
    },
    { kind: "text", text: "Access rules" },
    {
      kind: "list",
      items: ["allow: default when no rule matches", "deny: explicit blocklist", "log: record without blocking"],
    },
    {
      kind: "stack",
      direction: "horizontal",
      gap: 8,
      children: [
        { kind: "text", text: "status: in-process" },
        { kind: "text", text: "audit: .effect-agent/mcp-gateway.jsonl" },
      ],
    },
    { kind: "formField", label: "Rule pattern", placeholder: "tool:read:*" },
    { kind: "button", label: "Open mcp-gateway console", onPress: "open.mcp-gateway" },
  ],
}
