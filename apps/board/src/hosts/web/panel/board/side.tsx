/** panel/board/side.tsx - the ASIDE stack: RESOURCES / EXECUTORS / ACTIVITY.
 *  Concept: side cards read the same snapshot the board renders - resource
 *  usage (used/capacity + concurrency), executor status, and the activity
 *  ring (newest first, formatted timestamps). All presentational. */
import { type JSX } from "react"
import { ScrollArea, Stack, Text } from "@mantine/core"
import { IconActivity, IconBox, IconUsers } from "@tabler/icons-react"
import { execColor, resKindColor, tsText, typeLabel, Dot, When } from "./helpers.tsx"
import type { Ev } from "./use-board.ts"
import type { ResInfo, Snapshot } from "../api.ts"

export function Resources({ res }: { res: ResInfo[] }): JSX.Element {
  return (
    <div className="side-card">
      <div className="side-title"><IconBox size={13} stroke={1.8} /><Text size="xs" fw={650}>RESOURCES</Text></div>
      <Stack gap={5}>
        {res.map((r) => (
          <div className="side-row" key={r.resourceId}>
            <Dot tone={resKindColor(r.kind)} />
            <Text size="sm" truncate style={{ flex: 1 }}>{r.name}</Text>
            <Text size="xs" c="dimmed" className="mono">{r.used}/{r.capacity}</Text>
            <Text size="xs" c="dimmed">{r.concurrency === "exclusive" ? "excl" : "shared"}</Text>
          </div>
        ))}
        <When c={res.length === 0}><Text size="xs" c="dimmed">no resources yet</Text></When>
      </Stack>
    </div>
  )
}

export function Executors({ execs }: { execs: Snapshot["executors"] }): JSX.Element {
  return (
    <div className="side-card">
      <div className="side-title"><IconUsers size={13} stroke={1.8} /><Text size="xs" fw={650}>EXECUTORS</Text></div>
      <Stack gap={5}>
        {execs.map((e) => (
          <div className="side-row" key={e.executorId}>
            <Dot tone={execColor(e.status)} />
            <Text size="sm" truncate style={{ flex: 1 }}>{e.name}</Text>
            <Text size="xs" c="dimmed">{e.kind === "builtin" ? "builtin" : e.status}</Text>
          </div>
        ))}
        <When c={execs.length === 0}><Text size="xs" c="dimmed">none connected yet</Text></When>
      </Stack>
    </div>
  )
}

export function Activity({ evs }: { evs: Ev[] }): JSX.Element {
  return (
    <div className="side-card grow">
      <div className="side-title"><IconActivity size={13} stroke={1.8} /><Text size="xs" fw={650}>ACTIVITY</Text></div>
      <ScrollArea className="activity-scroll" type="hover">
        <Stack gap={2}>
          {evs.map((e, i) => (
            <div key={e.ts + "-" + i} className="act-line">
              <Text size="xs" c="dimmed" className="mono" style={{ minWidth: 58 }}>{tsText(e.ts)}</Text>
              <Text size="xs" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                <Text span c="dimmed">{typeLabel(e.type)}</Text>
                <When c={!!e.message}><Text span>{" " + e.message}</Text></When>
              </Text>
            </div>
          ))}
          <When c={evs.length === 0}><Text size="xs" c="dimmed" py="sm">waiting for activity…</Text></When>
        </Stack>
      </ScrollArea>
    </div>
  )
}
