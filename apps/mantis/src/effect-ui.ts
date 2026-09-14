/**
 * Mantis's console: one screen of what needs an operator, and four it enters.
 *
 * The start screen leads with decisions and not with conversations, and that
 * order is the design: a protected call does not run until it is decided, so a
 * decision is the only thing here that is *holding work still*, and an operator
 * who has to read past a history of conversations to reach it is reading the
 * wrong list first. The doors to the other screens stand above the region below
 * them, because the region scrolls and an unbounded history would otherwise carry
 * the app's destinations off the top of the screen with it.
 *
 * The room, the record store and the event ring are screens rather than sections
 * under the list, because each is a job an operator enters and comes back from.
 * The room is also the one screen reachable two ways — a row's press and an
 * address pasted into the bar — and the two arrive by one read, which the screen
 * declares as `onEnter`, so neither has a path the other lacks.
 *
 * The reads are three sources and one action (`effect-ui-actions.ts`). The three
 * are the console's own lists and refresh on their own intervals; the room's
 * timeline cannot be a source at all, because a source's address is declared and
 * this one's carries the conversation id, which belongs to the address bar. That
 * is why reading a room is a press, and why a fired turn has to say so.
 *
 * Two words changed, and neither is decoration (flows §1.7): the *workspace* is
 * herdr's unit for something this host calls records, and an *approval* is a
 * decision — the word the app's own tools and users already have.
 */

import type { EffectUiView } from "@effect-agent/effect-ui"
import { mantisActions } from "./effect-ui-actions.ts"
import { chatNodes } from "./effect-ui-chat.ts"
import { conversationSection, startNodes } from "./effect-ui-conversations.ts"
import { decisionGate, decisionSection } from "./effect-ui-decisions.ts"
import { eventNodes } from "./effect-ui-events.ts"
import { mantisDoors, mantisHeader } from "./effect-ui-header.ts"
import { failureNotice, loadingRows, region } from "./effect-ui-nodes.ts"
import { recordsNodes } from "./effect-ui-records.ts"

export const effectUiView: EffectUiView = {
  viewId: "mantis-console",
  title: "Mantis",
  state: {
    mantis: {
      state: { conversations: [], pending: [], approvalsOn: false },
      events: [],
      conversation: { entries: [] },
      send: undefined,
      decision: undefined,
      records: { resources: [] },
      recordAdd: undefined,
      recordUpdate: undefined,
      recordDelete: undefined,
    },
    // The draft, and the style it will be sent with: waited out is what this
    // console has always done, so it is what a screen that has not been asked
    // offers — a default that fired turns would change behaviour nobody chose.
    message: { text: "", wait: true },
    start: { id: "ui" },
    recordAdd: { kind: "", text: "" },
    recordEdit: { recordId: "", text: "" },
  },
  sources: [
    { id: "state", url: "/mantis/api/state", state: "/mantis/state", refreshMs: 5000 },
    { id: "events", url: "/mantis/api/events?after=0", state: "/mantis/events", refreshMs: 5000 },
    { id: "records", url: "/mantis/api/workspace", state: "/mantis/records", refreshMs: 10000 },
  ],
  actions: mantisActions,
  nodes: [
    mantisHeader,
    // One page-wide fact above everything it governs: the gate is about the whole
    // console, and a badge inside a row would read as that row's own state.
    decisionGate,
    mantisDoors,
    // The two lists are as long as this host's history is, and the read that feeds
    // them is stated once here rather than inside each: one failed read is one
    // failure, and each list says its own emptiness.
    region([loadingRows("state", 3), failureNotice("state"), decisionSection, conversationSection]),
  ],
  screens: [
    { id: "conversation", title: "Conversation", onEnter: "mantis.conversation", nodes: chatNodes },
    { id: "start", title: "New conversation", nodes: startNodes },
    { id: "records", title: "Records", nodes: recordsNodes },
    { id: "events", title: "Recent events", nodes: eventNodes },
  ],
}
