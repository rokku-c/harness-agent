import type { RoutePattern } from "@effect-agent/effect-host"

export interface KernelPlaneSpec {
  readonly id: string
  readonly priority: number
  readonly routes?: readonly RoutePattern[]
  readonly always?: boolean
}

export const KERNEL_PLANES: readonly KernelPlaneSpec[] = [
  { id: "platform-network", priority: 0, always: true, routes: [{ path: "/-/network/egress" }, { path: "/-/network/routes", method: "GET" }] },
  { id: "monitor", priority: 14 },
  { id: "effect-apps", priority: 15 },
  { id: "console", priority: 90 },
  { id: "config", priority: 150 },
]

export const planeIsOn = (spec: KernelPlaneSpec, enabled: ReadonlySet<string>): boolean =>
  spec.always === true || enabled.has(spec.id)
