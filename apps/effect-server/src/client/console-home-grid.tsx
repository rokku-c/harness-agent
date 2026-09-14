import * as React from "react"
import { Button, Flex, Grid, Text, TextField } from "@radix-ui/themes"
import { AppTile, markOf, placeMark, type AppMark } from "./console-app-icon.tsx"
import { navigate } from "./console-nav.ts"
import { appRoute, type ConsoleEntry } from "./console-plan.ts"
import type { Place } from "./console-place.ts"

interface Link {
  readonly mark: AppMark
  readonly open: () => void
}

const springboard = (apps: readonly ConsoleEntry[], settings: Place): readonly Link[] => [
  ...apps.map((entry) => ({ mark: markOf(entry), open: () => navigate(appRoute(entry.id)) })),
  { mark: placeMark(settings), open: () => navigate(settings.route) },
]

const matches = (mark: AppMark, text: string): boolean => {
  const needle = text.trim().toLowerCase()
  return needle === "" || mark.title.toLowerCase().includes(needle) || mark.id.toLowerCase().includes(needle)
}

export const HomeGrid = ({ apps, settings }: { readonly apps: readonly ConsoleEntry[]; readonly settings: Place }) => {
  const [filter, setFilter] = React.useState("")
  const links = springboard(apps, settings)
  const shown = links.filter((link) => matches(link.mark, filter))
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
    <Grid columns={{ initial: "2", sm: "3", md: "4", lg: "6" }} gap="3">
      {(missed ? links : shown).map((link) =>
        <AppTile key={link.mark.id} mark={link.mark} onSelect={link.open} />)}
    </Grid>
  </Flex>
}
