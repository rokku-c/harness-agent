/**
 * The registry source, and what the server list says while it is read, when it
 * came back with nothing, and when it failed.
 *
 * All three stand outside the region rather than inside it. The region scrolls,
 * so a refusal placed in it sits at the top of the box an operator reading the
 * bottom of a long list has already scrolled past, and the one thing they need
 * would be the one thing out of sight.
 *
 * The failure is written here rather than taken from `sourceStates`, because §9
 * asks three things of it — a sentence, the reason in mono, and the press that
 * repeats the read — and the vocabulary's notice carries the reason alone. The
 * loading and empty states are the vocabulary's own.
 *
 * The retry is a press with no call to make: it writes no answer of its own, so
 * the verdict at `/_sources/registry` stays the runtime's to write and the failed
 * tone clears itself. `refresh` alone is the whole of it — one press, one re-read,
 * and no draft emptied, because a press that wrote nothing has not earned that.
 */
import { emptyNotice, loadingRows, sourceStatusPath, type UiActionSpec, type UiNodeSpec } from "@effect-agent/effect-ui"
import { refused, retry } from "./effect-ui-refusal.ts"

/** The source's id, and the path its rows land at. */
export const REGISTRY = "registry"
export const SERVERS = "/registry/servers"

export const registryRead: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "2" },
  children: [
    loadingRows(REGISTRY, 6),
    emptyNotice(REGISTRY, "No servers are registered. Choose Register a server to add one."),
    refused("Could not read the server list.", `${sourceStatusPath(REGISTRY)}/error`, retry("registry.retry")),
  ],
}

/** Nothing to call: the source it names makes the one call the press consists of. */
export const registryRetryAction: UiActionSpec = { name: "registry.retry", refresh: [REGISTRY] }
