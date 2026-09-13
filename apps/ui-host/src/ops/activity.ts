/**
 * Who is on the canvas, and since when.
 *
 * A status is the one thing here that arrives from outside rather than from a
 * browser, so it is the one write with a route of its own. An empty status is
 * legal and means the agent has nothing current: the log reads it that way
 * rather than as a blank chip, which is why the status field is unconstrained
 * while its author is not. A status with no author would be recorded against
 * nobody.
 */
import { noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { UiSurfaces } from "./surfaces.ts"

export const activityOperations = ({ activity }: UiSurfaces): readonly Operation[] => [
  operation({
    name: "ui_list_activity",
    description: "Read what each agent last announced, and the recent announcements in order",
    access: "read", input: noInput, http: { method: "GET", path: "/api/activity" },
    handler: () => ({ statuses: activity.statuses(), events: activity.list() }),
  }),
  operation({
    name: "ui_set_status",
    description: "Announce what an agent is doing on the canvas; an empty status says it has nothing current",
    input: z.object({ agent: z.string().trim().min(1), status: z.string() }).strict(),
    http: { method: "POST", path: "/api/status" },
    handler: (input) => ({ ok: true, event: activity.setStatus(input.agent, input.status) }),
  }),
]
