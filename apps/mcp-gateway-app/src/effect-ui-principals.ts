/**
 * The principals screen: who the door can name, and what each of them presents.
 *
 * The screen is called Principals and not Identities because the API's URL is
 * the only place the losing word survives: a principal is anything that can be
 * identified and authorized, an identity is a second word for it that only this
 * app ever used, and a screen an operator reads must not carry the loser of that
 * argument (§1.7).
 *
 * The directory leads, and the two acts about one principal live in the row that
 * already names it — turning it off, and revoking the credential it holds. Only
 * issuing is about no principal in particular, because the act *creates* the one
 * it is about, which is why it is the form at the bottom rather than a press in
 * every row.
 *
 * Turning a principal off and revoking a token are deliberately two acts, drawn
 * as two: off keeps every token and refuses all of them at the door, and is
 * reversible; revocation is final. One control for both would make the
 * reversible thing look like the irreversible one.
 *
 * One read carries both tables, and each says its own emptiness — the runtime
 * decides "empty" from every array an answer holds, so a directory with nothing
 * in it reads `ready` while a token survives in the same body (`empty-rows.ts`).
 */
import {
  cellOf, chip, heading, listCard, loadingRows, press, region, text, toneField, toneWhen, type UiNodeSpec,
} from "@effect-agent/effect-ui"
import { titled } from "./effect-ui-cells.ts"
import { readFailed, refused, retry } from "./effect-ui-refusal.ts"
import { IDENTITIES, PRINCIPALS, PRINCIPAL_RESULT, REVOKE_RESULT } from "./effect-ui-paths.ts"
import { issueNodes } from "./effect-ui-issue.ts"
import { tokensTable } from "./effect-ui-tokens.ts"

const head: UiNodeSpec = {
  component: "Flex", props: { direction: "column", gap: "3" },
  children: [
    heading("Principals", { size: "4" }),
    text("Who the door can name, and every token each of them holds. A principal is turned off reversibly; a token is revoked for good.", { size: "2", color: "gray" }),
  ],
}

/**
 * A press shown only on the row whose state it changes, so the two directions of
 * one flag are never both offered on one row. The subject travels with the press
 * — `kind` and `id` are the row's — and the declaration supplies only the literal
 * status, which is the half of the request a press must not be free to choose.
 */
const turn = (state: string, action: string, label: string): UiNodeSpec =>
  ({ ...press(label, action, { kind: { item: "kind" }, id: { item: "id" } }, { size: "1", variant: "soft" }),
    visible: { source: { item: "status" }, equals: state } })

const directory = listCard({
  title: "Directory",
  id: IDENTITIES,
  empty: "No principal is in the directory. Issue a token below to register one.",
  headings: ["Principal", "Kind", "Status", "Created", ""],
  cells: [
    titled("displayName", "key"),
    cellOf(toneField("info", "kind")),
    cellOf([
      toneWhen("status", "active", "ok", "Active"),
      toneWhen("status", "disabled", "info", "Disabled"),
    ]),
    cellOf(chip("created")),
    cellOf([
      turn("active", "gateway.disablePrincipal", "Turn off"),
      turn("disabled", "gateway.enablePrincipal", "Turn on"),
    ]),
  ],
  repeat: { source: { state: PRINCIPALS } },
})

/**
 * A refused change, and the read that says what actually happened. `Try again`
 * is not a retry of the write — the write read its subject off the row it was
 * pressed on, and no press here can name it — it is the one read that says
 * whether the refusal left the directory as it was.
 *
 * One of these per table, under the rows that caused it, because §9.4 writes a
 * refusal beside its own control and the two controls are in two tables: a
 * shared path would paint a failed revocation under the directory.
 */
const refusalOf = (sentence: string, result: string): UiNodeSpec =>
  refused(sentence, `${result}/error`, retry("gateway.readDirectory"))

export const principalsScreen: readonly UiNodeSpec[] = [
  head,
  region([
    loadingRows(IDENTITIES, 4),
    readFailed("The directory could not be read.", IDENTITIES, "gateway.readDirectory"),
    directory,
    refusalOf("The change was refused.", PRINCIPAL_RESULT),
    tokensTable,
    refusalOf("The revocation was refused.", REVOKE_RESULT),
    ...issueNodes,
  ]),
]
