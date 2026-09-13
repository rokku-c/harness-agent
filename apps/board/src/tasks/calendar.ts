/**
 * The calendar projection of board tasks: an RFC 5545 feed an operator can
 * subscribe to from Apple Calendar. Board owns tasks; the feed owns nothing and
 * stores nothing - a subscription re-reads this projection on its own schedule.
 *
 * Only scheduled tasks appear. A task with neither a start nor a due time is
 * work, not an appointment, and inventing an hour for it would put fiction on
 * somebody's calendar.
 */
import type { Task } from "./schema.ts"

const CRLF = "\r\n"
const HOUR = 3_600_000
const encoder = new TextEncoder()

/** RFC 5545 UTC timestamp, e.g. 20260911T090000Z */
const stamp = (ms: number): string => new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, "")

const escapeText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,")

/** Content lines fold at 75 octets, and a multibyte character may not be split. */
const fold = (line: string): string => {
  const parts: string[] = []
  let current = "", octets = 0
  for (const character of line) {
    const size = encoder.encode(character).length
    if (octets + size > 75) { parts.push(current); current = " "; octets = 1 }
    current += character; octets += size
  }
  parts.push(current)
  return parts.join(CRLF)
}

const statusOf = (task: Task): string =>
  task.state === "done" ? "COMPLETED" : task.state === "cancelled" ? "CANCELLED" : "CONFIRMED"

/** A due time alone still marks a point in time; a start alone gets one hour. */
const intervalOf = (task: Task): { start: number; end: number } | undefined => {
  const start = task.startAt ?? task.dueAt
  if (start === undefined) return undefined
  const end = task.startAt !== undefined && task.dueAt !== undefined ? task.dueAt : start + HOUR
  return { start, end }
}

const linesOf = (task: Task): string[] => {
  const interval = intervalOf(task)
  if (interval === undefined) return []
  return [
    "BEGIN:VEVENT",
    `UID:${task.id}@board`,
    // DTSTAMP tracks the task's own revision, so a polling client can tell
    // "nothing changed" from "the calendar moved"
    `DTSTAMP:${stamp(task.updatedAt)}`,
    `DTSTART:${stamp(interval.start)}`,
    `DTEND:${stamp(interval.end)}`,
    `SUMMARY:${escapeText(task.title)}`,
    ...(task.body.trim() === "" ? [] : [`DESCRIPTION:${escapeText(task.body)}`]),
    `STATUS:${statusOf(task)}`,
    "END:VEVENT"
  ]
}

export interface CalendarFeed {
  /** the name a subscribed client shows for this calendar */
  readonly name?: string
  readonly description?: string
  readonly productId?: string
}

export const toIcs = (tasks: readonly Task[], feed: CalendarFeed = {}): string => {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    `PRODID:${feed.productId ?? "-//effect-agent//board//EN"}`,
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(feed.name ?? "Board")}`,
    "X-WR-TIMEZONE:UTC",
    ...(feed.description === undefined ? [] : [`X-WR-CALDESC:${escapeText(feed.description)}`]),
    ...tasks.flatMap(linesOf),
    "END:VCALENDAR", ""
  ]
  return lines.map(fold).join(CRLF)
}
