import type { EffectUiView } from "@effect-agent/effect-ui"

/** Mantis console summary as a declarative view (facade; worker stays live). */
export const effectUiView: EffectUiView = {
  viewId: "mantis-console",
  title: "Mantis",
  nodes: [
    { kind: "text", text: "Mantis" },
    { kind: "list", items: ["dingtalk robot · dws channels", "workspace sqlite + memory", "approval cards"] },
    { kind: "formField", label: "approvals", value: "ask", placeholder: "allow | ask | deny" },
  ],
}
