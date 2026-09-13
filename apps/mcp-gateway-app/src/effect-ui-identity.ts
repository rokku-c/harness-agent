/**
 * The identities screen: the one form, and the two lists it is about.
 *
 * It is a screen of its own rather than a card on the gateway's, because the act
 * here is a different kind of act. The first screen answers a question — may this
 * agent reach this tool — and costs nothing to ask; this one hands out and takes
 * away credentials, and a token is shown exactly once. Keeping them apart is what
 * lets each have the whole area when it is entered, and the first screen's
 * question stay readable beside it when the window is wide.
 *
 * The form is above the lists and the lists scroll under it, so the act stays
 * where it is while a directory of any length goes by beneath. Both lists are
 * read by one source, so a failed or slow read is stated once at the top of the
 * screen rather than once per list — and each list still says its own emptiness,
 * which is a fact about the list rather than about the read.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { failureNotice, identitiesSource, loadingRows, region } from "./effect-ui-nodes.ts"
import { issueSection } from "./effect-ui-issue.ts"
import { principalsSection } from "./effect-ui-principals.ts"
import { tokensSection } from "./effect-ui-tokens.ts"

export const identityNodes: readonly UiNodeSpec[] = [
  loadingRows(identitiesSource, 2),
  failureNotice(identitiesSource),
  issueSection,
  region([principalsSection, tokensSection]),
]
