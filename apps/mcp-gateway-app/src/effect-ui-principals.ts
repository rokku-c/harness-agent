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
