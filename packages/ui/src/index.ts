import { Context, Effect, Layer } from "effect"
import Yoga, { Direction, FlexDirection } from "yoga-layout"

export type LayoutFamily = "portrait" | "square" | "wide" | "ultrawide"
export type LayoutDensity = "compact" | "regular" | "expanded"

export interface ViewportMetrics {
  readonly inlineSize: number
  readonly blockSize: number
  readonly unit: "cell" | "pixel"
  /** Physical width / height of one terminal cell. Ignored for pixels. */
  readonly cellAspect?: number
  /** Pixels represented by one logical column/row for density classification. */
  readonly logicalUnit?: { readonly inline: number; readonly block: number }
}

export interface LayoutProfile {
  readonly family: LayoutFamily
  readonly density: LayoutDensity
  readonly anchor: "9:16" | "3:4" | "1:1" | "4:3" | "16:10" | "16:9" | "21:9"
  readonly aspect: number
  readonly logicalColumns: number
  readonly logicalRows: number
}

const anchors = [
  { name: "9:16" as const, ratio: 9 / 16, family: "portrait" as const },
  { name: "3:4" as const, ratio: 3 / 4, family: "portrait" as const },
  { name: "1:1" as const, ratio: 1, family: "square" as const },
  { name: "4:3" as const, ratio: 4 / 3, family: "wide" as const },
  { name: "16:10" as const, ratio: 16 / 10, family: "wide" as const },
  { name: "16:9" as const, ratio: 16 / 9, family: "wide" as const },
  { name: "21:9" as const, ratio: 21 / 9, family: "ultrawide" as const }
]

/** Logarithmic distance makes portrait and landscape ratios compare symmetrically. */
export const classifyViewport = (viewport: ViewportMetrics): LayoutProfile => {
  const cellAspect = viewport.cellAspect ?? 0.5
  const aspect = viewport.unit === "cell"
    ? viewport.inlineSize * cellAspect / Math.max(1, viewport.blockSize)
    : viewport.inlineSize / Math.max(1, viewport.blockSize)
  const logicalColumns = viewport.unit === "cell"
    ? viewport.inlineSize
    : viewport.inlineSize / (viewport.logicalUnit?.inline ?? 8)
  const logicalRows = viewport.unit === "cell"
    ? viewport.blockSize
    : viewport.blockSize / (viewport.logicalUnit?.block ?? 18)
  const nearest = anchors.reduce((best, candidate) =>
    Math.abs(Math.log(aspect / candidate.ratio)) < Math.abs(Math.log(aspect / best.ratio)) ? candidate : best)
  const density: LayoutDensity = logicalColumns < 58 || logicalRows < 18
    ? "compact"
    : logicalColumns >= 120 && logicalRows >= 38
      ? "expanded"
      : "regular"
  return { family: nearest.family, density, anchor: nearest.name, aspect, logicalColumns, logicalRows }
}

export type WorkbenchRegion = "header" | "connections" | "inspector" | "events" | "command"

export interface LayoutRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface WorkbenchLayout {
  readonly profile: LayoutProfile
  readonly regions: Readonly<Record<WorkbenchRegion, LayoutRect>>
}

const node = (direction: FlexDirection, grow = 0) => {
  const value = Yoga.Node.create()
  value.setFlexDirection(direction)
  if (grow) value.setFlexGrow(grow)
  value.setFlexShrink(1)
  return value
}

/** Yoga computes boxes; the selected family may replace the whole region tree. */
export const computeWorkbenchLayout = (viewport: ViewportMetrics): WorkbenchLayout => {
  const profile = classifyViewport(viewport)
  const root = node(FlexDirection.Column)
  root.setWidth(viewport.inlineSize)
  root.setHeight(viewport.blockSize)
  const header = node(FlexDirection.Row)
  const command = node(FlexDirection.Row)
  header.setHeight(viewport.unit === "cell" ? 1 : 34)
  command.setHeight(viewport.unit === "cell" ? 1 : 30)
  const body = node(profile.family === "portrait" || profile.family === "square" ? FlexDirection.Column : FlexDirection.Row, 1)
  const connections = node(FlexDirection.Column)
  const inspector = node(FlexDirection.Column)
  const events = node(FlexDirection.Column)

  root.insertChild(header, 0)
  root.insertChild(body, 1)
  root.insertChild(command, 2)

  if (profile.family === "portrait") {
    connections.setFlexGrow(profile.density === "compact" ? 24 : 28)
    inspector.setFlexGrow(profile.density === "compact" ? 46 : 42)
    events.setFlexGrow(30)
    body.insertChild(connections, 0)
    body.insertChild(inspector, 1)
    body.insertChild(events, 2)
  } else if (profile.family === "square") {
    const upper = node(FlexDirection.Row, 66)
    connections.setFlexGrow(36)
    inspector.setFlexGrow(64)
    events.setFlexGrow(34)
    upper.insertChild(connections, 0)
    upper.insertChild(inspector, 1)
    body.insertChild(upper, 0)
    body.insertChild(events, 1)
  } else {
    connections.setFlexGrow(profile.family === "ultrawide" ? 20 : 27)
    inspector.setFlexGrow(profile.family === "ultrawide" ? 42 : 43)
    events.setFlexGrow(profile.family === "ultrawide" ? 38 : 30)
    body.insertChild(connections, 0)
    body.insertChild(inspector, 1)
    body.insertChild(events, 2)
  }

  root.calculateLayout(viewport.inlineSize, viewport.blockSize, Direction.LTR)
  const absolute = (target: ReturnType<typeof node>): LayoutRect => {
    let x = target.getComputedLeft()
    let y = target.getComputedTop()
    let parent = target.getParent()
    while (parent) {
      x += parent.getComputedLeft()
      y += parent.getComputedTop()
      parent = parent.getParent()
    }
    return {
      x: Math.round(x), y: Math.round(y),
      width: Math.round(target.getComputedWidth()), height: Math.round(target.getComputedHeight())
    }
  }
  const result: WorkbenchLayout = {
    profile,
    regions: {
      header: absolute(header), connections: absolute(connections), inspector: absolute(inspector),
      events: absolute(events), command: absolute(command)
    }
  }
  root.freeRecursive()
  return result
}

export interface UiLayoutEngine {
  readonly workbench: (viewport: ViewportMetrics) => Effect.Effect<WorkbenchLayout, Error>
}

export const yogaLayoutEngine: UiLayoutEngine = {
  workbench: (viewport) => Effect.try({
    try: () => computeWorkbenchLayout(viewport),
    catch: (cause) => cause instanceof Error ? cause : new Error(String(cause))
  })
}

export class UiLayout extends Context.Tag("effect-agent/ui/Layout")<UiLayout, UiLayoutEngine>() {
  static yoga = Layer.succeed(this, yogaLayoutEngine)
}
