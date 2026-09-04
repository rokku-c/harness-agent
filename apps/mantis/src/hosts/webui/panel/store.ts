/**
 * Barrel: the panel store split by CONCEPT (see ./store/). types.ts =
 * state contract + entry adapter; core.ts = state container + caches;
 * poll.ts = snapshot polling; actions.ts = user actions; panel.ts = the
 * store object + poll timers; selectors.ts = view selectors + usePanel;
 * singleton.ts = one instance per page.
 */
export type { TimelineItem, RawEvent, PanelState } from "./store/types.ts"
export { panel } from "./store/singleton.ts"
export { usePanel, conversationList, conversationItems, defaultConversation } from "./store/selectors.ts"
