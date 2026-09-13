/**
 * The plane slots, host-side (docs/architecture-rework.md §6.1–§6.3).
 *
 * Which slots exist, what priority they get and which routes they claim is
 * **host data**, not kernel data: a kernel revision supplies the implementations,
 * not the routing table (§6.3-① — the routing table does not move). Keeping the
 * table here rather than inside a kernel is what lets a swapped-in kernel fill
 * the same slots without renegotiating them.
 */

import type { RoutePattern } from "@effect-agent/effect-host"

/** One slot a kernel fills. The bootstrap registers a stable stand-in per id. */
export interface KernelPlaneSpec {
  readonly id: string
  readonly priority: number
  /** Path claims, for planes that match by route rather than by `canHandle`. */
  readonly routes?: readonly RoutePattern[]
  /**
   * Registered regardless of the enabled set — the control plane's own transport
   * cannot be gated on a plane that only exists once some other plane ran.
   */
  readonly always?: boolean
}

/**
 * The planes this build's kernel fills, and therefore the slots the host opens.
 */
export const KERNEL_PLANES: readonly KernelPlaneSpec[] = [
  { id: "platform-network", priority: 0, always: true, routes: [{ path: "/-/network/egress" }, { path: "/-/network/routes", method: "GET" }] },
  { id: "monitor", priority: 14 },
  { id: "effect-apps", priority: 15 },
  { id: "console", priority: 90 },
  { id: "config", priority: 150 },
]

/**
 * Whether a plane slot is on: the host marks it always-on, or it was enabled.
 * Stated once because boot, the kernel-swap guard and the router all ask it —
 * a plane that were on in one and off in another is a slot nobody serves.
 */
export const planeIsOn = (spec: KernelPlaneSpec, enabled: ReadonlySet<string>): boolean =>
  spec.always === true || enabled.has(spec.id)
