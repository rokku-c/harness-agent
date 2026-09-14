/**
 * The grid, and the field that narrows it (§2.H2).
 *
 * When the filter matches nothing the grid is *not* emptied behind the message:
 * a reader who mistyped a letter needs to see the list they were reading to
 * correct it, and a page that blanks on the third keystroke is the one state an
 * app index must never reach. So the message is drawn beside the full grid
 * rather than in place of it, which is the letter of H2's empty branch.
 *
 * Both keyboard paths to an app — the palette and `/` — are the command
 * registry's (`flows.md` §9.11); the field is here so the pointer path works
 * today, and it advertises no key it cannot honour.
 */

import * as React from "react"
import { Button, Flex, Grid, Text, TextField } from "@radix-ui/themes"
import { AppTile, markOf } from "./console-app-icon.tsx"
import { navigate } from "./console-nav.ts"
import { appRoute, type ConsoleEntry } from "./console-plan.ts"

const matches = (entry: ConsoleEntry, text: string): boolean => {
  const needle = text.trim().toLowerCase()
  return needle === "" || entry.title.toLowerCase().includes(needle) || entry.id.toLowerCase().includes(needle)
}

export const HomeGrid = ({ apps }: { readonly apps: readonly ConsoleEntry[] }) => {
  const [filter, setFilter] = React.useState("")
  const shown = apps.filter((entry) => matches(entry, filter))
  const missed = filter.trim() !== "" && shown.length === 0
  return <Flex direction="column" gap="3">
    <Flex align="center" gap="3" wrap="wrap">
      <TextField.Root size="2" style={{ maxWidth: 280 }} value={filter} placeholder="Filter apps"
        aria-label="Filter apps" onChange={(event) => setFilter(event.target.value)} />
      {missed
        ? <Flex align="center" gap="2">
            <Text size="2" color="amber">{`No app matches "${filter.trim()}".`}</Text>
            <Button size="1" variant="soft" color="gray" onClick={() => setFilter("")}>Clear</Button>
          </Flex>
        : null}
    </Flex>
    <Grid columns={{ initial: "2", sm: "4", md: "6" }} gap="3">
      {(missed ? apps : shown).map((entry) =>
        <AppTile key={entry.id} mark={markOf(entry)} onSelect={() => navigate(appRoute(entry.id))} />)}
    </Grid>
  </Flex>
}
