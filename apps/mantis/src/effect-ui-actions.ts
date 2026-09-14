/**
 * The operations this console declares, and the reason each one is shaped the
 * way it is.
 *
 * An action is a name a press runs — the five doors are actions with no call to
 * make, because a destination is a behaviour like any other. Three things here
 * are decisions rather than transcription:
 *
 *   * Send's style is read from the page (`/message/wait`) instead of being
 *     fixed, so the switch on the composer is the declaration rather than a
 *     second copy of it. A press that supplies no style still sends one.
 *   * The room's read is addressed from `/_nav`, which is where a row's press and
 *     the start form both put the id — one read, two doors. With no id it makes
 *     no call at all: an address with nobody in it must not be sent as a request
 *     about nobody.
 *   * Allow and deny answer into one result path, because they are one decision.
 *     Two paths would let a deny's answer sit on screen beside an allow's rows
 *     with nothing to say which of the two it belonged to.
 *
 * The record store's calls still address `/mantis/api/workspace`: the word
 * changed on the screen, and the route it reads is the server's own contract.
 */

import { NAV_ROOT, type UiActionSpec } from "@effect-agent/effect-ui"

export const mantisActions: readonly UiActionSpec[] = [
  { name: "mantis.send", method: "POST", url: "/mantis/api/message", result: "/mantis/send",
    params: { wait: { state: "/message/wait" } }, clear: ["/message/text"],
    refresh: ["state", "events", "mantis.conversation"] },
  { name: "mantis.openConversation", opens: "conversation" },
  { name: "mantis.newConversation", opens: "start" },
  { name: "mantis.openRecords", opens: "records" },
  { name: "mantis.openEvents", opens: "events" },
  { name: "mantis.conversation", method: "GET", url: "/mantis/api/conversation?conversationId={conversationId}",
    result: "/mantis/conversation", params: { conversationId: { state: `${NAV_ROOT}/conversationId` } },
    clear: ["/message/text"] },
  { name: "mantis.allow", method: "POST", url: "/mantis/api/approval/resolve", result: "/mantis/decision", refresh: ["state", "events"] },
  { name: "mantis.deny", method: "POST", url: "/mantis/api/approval/resolve", result: "/mantis/decision", refresh: ["state", "events"] },
  { name: "mantis.recordAdd", method: "POST", url: "/mantis/api/workspace", result: "/mantis/recordAdd", refresh: ["records"] },
  { name: "mantis.recordUpdate", method: "PATCH", url: "/mantis/api/workspace", result: "/mantis/recordUpdate", refresh: ["records"] },
  { name: "mantis.recordDelete", method: "DELETE", url: "/mantis/api/workspace?recordId={recordId}", result: "/mantis/recordDelete", refresh: ["records"] },
]
