/** worktable/row.tsx - one work-item row + its state-legal quick actions.
 *  Every action goes through the board api act() then refreshes the table. */
import { useState } from "react"
import type { ReactNode } from "react"
import { ActionIcon, Badge, Tooltip } from "@mantine/core"
import { IconCheck, IconPlayerPause, IconPlayerPlay, IconRefresh } from "@tabler/icons-react"
import { api, type ActionResult } from "../api.ts"
import { When, stateColor, prioColor } from "../board/helpers.tsx"
import type { WorkRowProps } from "./table-types.ts"

const fmtAge = (ts: number): string => {
  const d = Math.max(0, Date.now() - ts)
  if (d < 60_000) return "now"
  if (d < 3_600_000) return Math.floor(d / 60_000) + "m"
  return d < 86_400_000 ? (d / 3_600_000).toFixed(1).replace(/\.0$/, "") + "h" : (d / 86_400_000).toFixed(1).replace(/\.0$/, "") + "d"
}
const fmtStamp = (ts: number): string => new Date(ts).toLocaleString([], { hour12: false })

export function WorkRow({ item, resNames, itemTitle, stateTitle, onOpen, onRefresh }: WorkRowProps) {
  const [busy, setBusy] = useState("")
  const prio = item.priority && item.priority !== "normal" ? item.priority : ""
  const act = async (kind: string): Promise<ActionResult> => {
    setBusy(kind)
    let r: ActionResult
    try {
      switch (kind) {
        case "start": r = await api.act("start", item.itemId, { executorId: "console" }); break
        case "done": r = await api.act("done", item.itemId, { detail: "done from web table" }); break
        case "block": r = await api.act("block", item.itemId, { reason: "blocked from web table" }); break
        case "unblock": r = await api.act("unblock", item.itemId); break
        default: r = { ok: false, detail: "?" }
      }
    } catch (e) { r = { ok: false, detail: String(e) } }
    setBusy("")
    await onRefresh()
    return r
  }
  const keys = item.state === "blocked" ? ["unblock"] : item.state === "doing" ? ["done", "block"] : ["start", "block"]
  const iconOf: Record<string, ReactNode> = {
    start: <IconPlayerPlay size={13} />,
    done: <IconCheck size={13} />,
    block: <IconPlayerPause size={13} />,
    unblock: <IconRefresh size={13} />
  }
  const nDeps = item.dependencies?.length ?? 0
  const nReq = item.requires?.length ?? 0
  return (
    <div className="wt-row" role="button" tabIndex={0}
      onClick={() => onOpen(item.itemId)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(item.itemId) } }}>
      <div className="wt-c wt-titlecell">
        <div className="wt-l1">
          <When c={prio !== ""}><span className={"wt-pri wt-pri-" + prio}>{prio[0]?.toUpperCase()}</span></When>
          <span className="wt-title">{item.title}</span>
        </div>
        <div className="wt-l2">
          <When c={(item.labels?.length ?? 0) > 0}><span className="wt-labs">{(item.labels ?? []).slice(0, 3).map((l) => "#" + l).join(" ")}</span></When>
          <When c={!!item.blockedReason}><span className="wt-blocked">⛔ {item.blockedReason}</span></When>
          <When c={!!item.result && item.state === "failed"}><span className="wt-result">↳ {(item.result ?? "").slice(0, 90)}</span></When>
        </div>
      </div>
      <div className="wt-c"><Badge size="sm" variant="light" color={stateColor(item.state)}>{stateTitle(item.state)}</Badge></div>
      <div className="wt-c">
        <When c={!!item.assigneeId}><Tooltip label={"assigned to " + item.assigneeId}><span className="wt-assign">@{item.assigneeId}</span></Tooltip></When>
        <When c={!item.assigneeId}><span className="wt-dim">—</span></When>
      </div>
      <div className="wt-c">
        <When c={nDeps > 0}><Tooltip label={"waits on: " + (item.dependencies ?? []).map(itemTitle).join(" · ")}><span className="wt-warn">{nDeps} wait{nDeps > 1 ? "s" : ""}</span></Tooltip></When>
        <When c={nDeps === 0}><span className="wt-dim">—</span></When>
      </div>
      <div className="wt-c wt-claims">
        <When c={nReq > 0}>
          {(item.requires ?? []).slice(0, 2).map((rc, i) => (<Tooltip key={i} label={resNames.get(rc.resourceId) ?? rc.resourceId}><span className="wt-rc mono">{rc.resourceId}</span></Tooltip>))}
          <When c={nReq > 2}><span className="wt-dim">+{nReq - 2}</span></When>
        </When>
        <When c={nReq === 0}><span className="wt-dim">—</span></When>
      </div>
      <div className="wt-c">
        <Tooltip label={"created " + fmtStamp(item.createdAt) + " · updated " + fmtStamp(item.updatedAt)}>
          <span className={"wt-age" + (Date.now() - item.updatedAt < 3_600_000 ? " wt-fresh" : "")}>{fmtAge(item.createdAt)}</span>
        </Tooltip>
      </div>
      <div className="wt-c wt-acts" onClick={(e) => e.stopPropagation()}>
        {keys.map((k) => (
          <Tooltip key={k} label={k === "start" ? "Start" : k === "done" ? "Mark done" : k === "block" ? "Block" : "Unblock"}>
            <ActionIcon size="md" variant={k === "unblock" || k === "block" ? "subtle" : "filled"}
              color={k === "done" ? "green" : k === "start" ? "brand" : k === "block" ? "yellow" : undefined}
              loading={busy === k} disabled={busy !== "" && busy !== k}
              onClick={(e) => { e.stopPropagation(); void act(k) }}>
              {iconOf[k]}
            </ActionIcon>
          </Tooltip>
        ))}
        <When c={item.state === "doing" && (item.children?.length ?? 0) > 0}><span className="wt-dim">{(item.children?.length ?? 0) + " sub"}</span></When>
      </div>
    </div>
  )
}
