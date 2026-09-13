/**
 * The node builders the gateway console is written with.
 *
 * Every one of them is a shape the framework states once for every console — a
 * field is its label above its control, a section is a card, a list of records
 * is a table — so this file holds no opinion of its own: it names the ones this
 * app builds its page from, and nothing here is a second copy of them.
 *
 * What is here beyond that is what only this console needs: where its three
 * reads keep their answers, where the one form keeps what has been typed, and
 * the row a credential is drawn in.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"

export {
  cell,
  cellOf,
  chip,
  chipList,
  emptyRows,
  failureBadge,
  failureCallout,
  failureNotice,
  field,
  heading,
  line,
  list,
  listCard,
  loadingRows,
  press,
  region,
  row,
  section,
  sourceStates,
  stateBadge,
  stateRows,
  table,
  text,
  whenRows,
  type ListCard,
} from "@effect-agent/effect-ui"

/**
 * The three reads. A source's body lands at a path named after it — `/audit`
 * for the audit, `/identities` for the directory — so a path in a node says
 * which read it came from without a second table saying so.
 *
 * The url is the app's own route rather than the path the answer lands at: the
 * read is made of the gateway, and it is kept here under the name the screen
 * reads it by. They are spelled differently on purpose, and `identities` is the
 * one place both are needed.
 */
export const identitiesSource = "identities"
export const identitiesUrl = "/mcp-gateway/identities"
export const identitiesPath = "/identities"
export const principalsPath = `${identitiesPath}/principals`
export const tokensPath = `${identitiesPath}/tokens`

/** What the form has been typed but not sent. Blanks are what "no answer yet" is written as. */
export const draft = (name: string): string => `/issue/draft/${name}`

/** Where each press's answer lands. One path per press, on the card the press is in. */
export const issueResult = "/issue/result"
export const revokeResult = "/revoke/result"
export const principalResult = "/principal/result"

/**
 * A record that is read on its own and acted on where it stands: its facts on
 * one line, and what can be done to it at the end of that same line.
 *
 * Not a table. A table compares one column across many records — which server is
 * offline, which set allows what — and these are read one at a time, in a pane
 * that is a third of the window whenever the console is split. A row that reads
 * at any width is worth more here than a column that lines up at one.
 *
 * The facts sit in a row of their own so a badge and a chip keep the size they
 * were given, which a column would stretch across the pane.
 */
export const recordRow = (facts: readonly UiNodeSpec[], action: UiNodeSpec): UiNodeSpec => ({
  component: "Flex",
  props: { justify: "between", align: "center", gap: "2" },
  children: [
    { component: "Flex", props: { gap: "2", wrap: "wrap", align: "center" }, children: [...facts] },
    action,
  ],
})

export const stack = (children: readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column", gap: "1" }, children: [...children] })
