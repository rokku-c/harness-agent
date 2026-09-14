/**
 * Home: the app index, and what is waiting on you.
 *
 * There is no separate Apps page (§1.4) — this *is* the index — so the grid is
 * the page and its empty state is a pane rather than a blank, which is what H11
 * asks for and what §2.H1's loading branch means by "tile-shaped skeletons, not a
 * spinner".
 *
 * The catalogue's failure notice lives here rather than in the chrome because
 * this is the surface that uses the catalogue: Inbox, Activity, Tools and
 * Settings resolve with no apps registered at all, so a failed catalogue costs
 * Home its grid and nothing else (§2.H1).
 *
 * The needs-you strip reads the queue on its own and draws only when there is
 * something in it. A queue that cannot be read draws nothing here: the strip is
 * one line of Home, and the place that owns that read is the one that reports a
 * failure to read it (§2.H12, `console-place-inbox.tsx`).
 */

import * as React from "react"
import { Button, Callout, Flex, Heading, Text } from "@radix-ui/themes"
import { navigate } from "./console-nav.ts"
import { useSource, sourceValue } from "./console-source.ts"
import { loadInbox } from "./console-decision.ts"
import { FirstSteps } from "./console-first-steps.tsx"
import { HomeGrid } from "./console-home-grid.tsx"
import { SETTINGS } from "./console-place-settings.tsx"
import type { Place, PlaceContext } from "./console-place.ts"

/** One count, as the link that opens the place it counts. */
const Count = ({ label }: { readonly label: string }) =>
  <Button size="2" variant="soft" color="violet" onClick={() => navigate({ kind: "inbox" })}>{label}</Button>

const NeedsYou = () => {
  const inbox = useSource("inbox", loadInbox)
  const snapshot = sourceValue(inbox.state)
  const waiting = snapshot?.decisions.length ?? 0
  const actions = snapshot?.actionItems.length ?? 0
  if (waiting === 0 && actions === 0) return null
  return <Callout.Root color="violet"><Callout.Text>
    <Flex align="center" gap="3" wrap="wrap">
      <Text size="2" weight="medium">Needs you now</Text>
      {waiting === 0 ? null : <Count label={waiting === 1 ? "1 decision waiting" : `${String(waiting)} decisions waiting`} />}
      {actions === 0 ? null : <Count label={actions === 1 ? "1 action item" : `${String(actions)} action items`} />}
    </Flex>
  </Callout.Text></Callout.Root>
}

const HomePlace = ({ context }: { readonly context: PlaceContext }) => {
  const apps = context.plan.filter((entry) => entry.hasView)
  const { failure, retry } = context.catalogue
  return <Flex direction="column" gap="5">
    <Flex direction="column" gap="1">
      <Heading size="6">Apps</Heading>
      <Text size="2" color="gray">The springboard: every app this host has, and what is waiting on you.</Text>
    </Flex>
    {failure === undefined ? null
      : <Callout.Root color="red"><Callout.Text>
          <Flex align="center" gap="3" wrap="wrap">
            <Text size="2">{failure}</Text>
            <Button size="1" variant="soft" color="gray" onClick={retry}>Retry</Button>
          </Flex>
        </Callout.Text></Callout.Root>}
    <NeedsYou />
    {apps.length === 0
      ? <FirstSteps status={context.status} quiet={context.plan.length === 0} />
      : <HomeGrid apps={apps} settings={SETTINGS} />}
  </Flex>
}

export const HOME: Place = {
  id: "home",
  title: "Home",
  route: { kind: "home" },
  mark: "House",
  color: "jade",
  chrome: "page",
  kinds: ["home"],
  /** The empty hash, and only that: `#` with anything after it is somebody else's address. */
  claim: (address) => address.parts.length === 0 ? { kind: "home" } : undefined,
  view: (_route, context) => <HomePlace context={context} />,
}
