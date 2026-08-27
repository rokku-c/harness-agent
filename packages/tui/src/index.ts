import { Effect } from "effect"
import type { ReprClient, ReprIntent, ReprSnapshot } from "@effect-agent/repr"
import { computeWorkbenchLayout, type LayoutRect } from "@effect-agent/ui"

export interface TuiViewport {
  readonly columns: number
  readonly rows: number
}

const crop = (value: string, width: number) => width < 1 ? "" : value.length <= width
  ? value.padEnd(width)
  : width === 1 ? "…" : `${value.slice(0, width - 1)}…`

/** Dense workbench: connection index, focused contract and event ledger. */
export const renderTui = (snapshot: ReprSnapshot, viewport: TuiViewport) => {
  const width = Math.max(40, viewport.columns)
  const height = Math.max(12, viewport.rows)
  const layout = computeWorkbenchLayout({ inlineSize: width, blockSize: height, unit: "cell", cellAspect: 0.5 })
  const visible = snapshot.connections.filter((connection) =>
    !snapshot.filter || `${connection.id} ${connection.protocol ?? ""} ${connection.capabilities.map((capability) => capability.name).join(" ")}`.toLowerCase().includes(snapshot.filter.toLowerCase()))
  const selected = snapshot.connections.find((connection) => connection.id === snapshot.selected)
  const invocation = selected ? snapshot.invocations[selected.id] : undefined
  const focusedCapability = selected?.capabilities.find((capability) => capability.name === invocation?.capability) ?? selected?.capabilities[0]
  const canvas = Array.from({ length: height }, () => Array<string>(width).fill(" "))
  const write = (x: number, y: number, value: string, available: number) => {
    if (y < 0 || y >= height || available < 1) return
    const output = crop(value, Math.min(available, width - x))
    for (let index = 0; index < output.length && x + index < width; index++) if (x + index >= 0) canvas[y][x + index] = output[index]
  }
  const box = (rect: LayoutRect, title: string, lines: ReadonlyArray<string>) => {
    const { x, y, width: boxWidth, height: boxHeight } = rect
    if (boxWidth < 4 || boxHeight < 2) return
    write(x, y, `┌ ${title} ${"─".repeat(Math.max(0, boxWidth - title.length - 4))}┐`, boxWidth)
    for (let row = 1; row < boxHeight - 1; row++) {
      write(x, y + row, "│", 1)
      write(x + 1, y + row, lines[row - 1] ?? "", boxWidth - 2)
      write(x + boxWidth - 1, y + row, "│", 1)
    }
    write(x, y + boxHeight - 1, `└${"─".repeat(Math.max(0, boxWidth - 2))}┘`, boxWidth)
  }

  write(layout.regions.header.x, layout.regions.header.y,
    ` CORE  ${visible.length}/${snapshot.connections.length}  rev:${snapshot.revision}  ${layout.profile.anchor}/${layout.profile.density}  filter:${snapshot.filter || "—"}`,
    layout.regions.header.width)
  box(layout.regions.connections, "CONNECTIONS", visible.map((connection) =>
    `${connection.id === snapshot.selected ? "▸" : " "} ${connection.status === "failed" ? "!" : connection.status === "active" ? "●" : "·"} ${connection.id}`))
  box(layout.regions.inspector, "INSPECTOR", [
    `connection  ${selected?.id ?? "—"}`,
    `protocol    ${selected?.protocol ?? "—"}`,
    `state       ${selected?.status ?? "—"}`,
    `last event  ${selected?.lastEvent ?? "—"}`,
    `last call   ${invocation ? `${invocation.capability} [${invocation.status}]` : "—"}`,
    `result      ${invocation?.status === "failed" ? invocation.error : invocation?.output === undefined ? "—" : printable(invocation.output)}`,
    "capabilities",
    ...(selected?.capabilities.map((capability) => `• ${capability.name}${capability.mode ? ` [${capability.mode}]` : ""}`) ?? []),
    `input       ${focusedCapability ? printable(focusedCapability.input) : "—"}`,
    `output      ${focusedCapability ? printable(focusedCapability.output) : "—"}`
  ])
  box(layout.regions.events, "EVENT LEDGER", snapshot.events.slice().reverse().map((event) =>
    `${String(event.sequence).padStart(4)} ${event.connectionId} ${event.kind}`))
  write(layout.regions.command.x, layout.regions.command.y,
    " j/k select   i invoke   r refresh   x close   c clear   q quit", layout.regions.command.width)
  return canvas.map((row) => row.join("")).join("\n")
}

const printable = (value: unknown) => {
  try { return typeof value === "string" ? value : JSON.stringify(value) }
  catch { return String(value) }
}

export const tuiIntent = (key: string, snapshot: ReprSnapshot): ReprIntent | undefined => {
  const current = Math.max(0, snapshot.connections.findIndex((connection) => connection.id === snapshot.selected))
  if (key === "j") return { type: "select", connection: snapshot.connections[Math.min(snapshot.connections.length - 1, current + 1)]?.id }
  if (key === "k") return { type: "select", connection: snapshot.connections[Math.max(0, current - 1)]?.id }
  if (key === "r") return { type: "refresh" }
  if (key === "c") return { type: "clear-events" }
  if (key === "x" && snapshot.selected) return { type: "close", connection: snapshot.selected }
  if (key === "i" && snapshot.selected) {
    const connection = snapshot.connections.find((item) => item.id === snapshot.selected)
    if (connection?.capabilities[0]) return {
      type: "invoke",
      connection: connection.id,
      capability: connection.capabilities[0].name,
      input: {}
    }
  }
  return undefined
}

export const createTui = (client: ReprClient, viewport: TuiViewport) => ({
  frame: client.snapshot.pipe(Effect.map((snapshot) => renderTui(snapshot, viewport))),
  handle: (key: string) => client.snapshot.pipe(Effect.flatMap((snapshot) => {
    const intent = tuiIntent(key, snapshot)
    return intent ? client.dispatch(intent).pipe(Effect.asVoid) : Effect.void
  }))
})
