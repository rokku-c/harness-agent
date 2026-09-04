/**
 * Barrel: the mantis web console - the panel's STATE SOURCE, split by
 * CONCEPT (see ./console/). types.ts = contract; ledger.ts = conversation
 * timelines; event-hook.ts = session events; approvals.ts = the console as
 * operator; host-builder.ts = MantisHost
 * wiring; snapshot.ts = polled snapshots; console.ts = the WebConsole class.
 */
export type { ConsoleTimelineEntry, WebConsoleOptions } from "./console/types.ts"
export { MAX_CHAT_TEXT, WORKSPACE_CONVERSATION } from "./console/types.ts"
export { short } from "./console/helpers.ts"
export { WebConsole } from "./console/console.ts"
