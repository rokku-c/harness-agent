/** Pending approvals as a declarative UI document (R32).
 *  The screen BUILDS a SpecDoc from state, the renderer catalog turns it
 *  into views; button actions dispatch back to product code by name+data.
 *  Visuals are unchanged from the pre-spec version. */
import { type JSX } from "react"
import { panel, usePanel } from "../store.ts"
import { renderNode } from "../schema/render.tsx"
import { badge, button, code, col, paper, row, text } from "../schema/spec.ts"
import type { PanelState } from "../store.ts"
import type { SpecAction, SpecDoc } from "../schema/types.ts"
import { shortId } from "../common.ts"

const approvalsDocument = (state: PanelState): SpecDoc => {
  const pending = state.pending
  let body: SpecDoc["children"] = []
  if (!state.approvalsOn && pending.length === 0) {
    body = [text("off", "本实例未启用审批门：agent 写操作直接执行。", { size: "sm", c: "dimmed", center: true, mt: 40 })]
  } else if (state.approvalsOn && pending.length === 0) {
    body = [text("empty", "暂无待批请求——需要放行时会在这里出现卡片。", { size: "sm", c: "dimmed", center: true, mt: 40 })]
  } else {
    body = pending.map((p) => {
      const meta = row("meta", [
        badge("tool", p.tool, { size: "xs", variant: "light", color: "yellow" }),
        text("id", shortId(p.callId), { size: "xs", c: "dimmed", mono: true }),
        ...(p.session !== undefined && p.session !== "" ? [text("who", "来自会话 " + p.session, { size: "xs", c: "dimmed" })] : [])
      ], { gap: 6 })
      const head = row("head", [
        meta,
        text("waiting", "等待操作者", { size: "xs", c: "dimmed" })
      ], { justify: "space-between", style: { marginBottom: 6 } })
      const bodyCode = code("input", JSON.stringify(p.input, null, 2), { style: { fontSize: 11, maxHeight: 180, overflow: "auto" } })
      const actions = row("actions", [
        button("deny", "拒绝", "deny", { callId: p.callId }, { color: "red", variant: "light", icon: "x" }),
        button("allow", "同意", "allow", { callId: p.callId }, { icon: "check" })
      ], { justify: "flex-end", style: { marginTop: 8 } })
      return paper("card-" + p.callId, [head, bodyCode, actions], {
        p: "sm",
        radius: "md",
        style: { maxWidth: 640, alignSelf: "center", width: "100%" }
      })
    })
  }
  return col("approvals", body ?? [], { gap: "sm", style: { height: "100%", overflow: "auto", padding: 8 } })
}

const onSpecAction = (action: SpecAction): void => {
  if (action.name !== "allow" && action.name !== "deny") return
  const callId = (action.data as { callId?: string } | undefined)?.callId
  if (callId === undefined) return
  void panel.resolveApproval(callId, action.name === "allow")
}

export const ApprovalsView = (): JSX.Element => {
  const state = usePanel()
  return <>{renderNode(approvalsDocument(state), { onAction: onSpecAction })}</>
}
