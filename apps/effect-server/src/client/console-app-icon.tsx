/**
 * An app as the design system draws it.
 *
 * A tile is an `Avatar`: the library's own component for "a small coloured mark
 * that stands for a thing", which is exactly what an app icon is. Both the mark
 * and the colour arrive on the entry, declared by the app itself, so this file
 * holds no list of app ids — adding an app never means editing the console.
 *
 * Places draw with the same tile (`#tools`, `#settings`, the dock), and a place
 * is not an app: it has a mark and a title but no catalogue entry, no colour
 * anybody declared, and no view. So the drawing takes a `mark`, not an entry —
 * the alternative is a fake `ConsoleEntry` per place, and a fake entry is how a
 * place ends up in an app list.
 */

import * as React from "react"
import { Avatar, Card, Flex, Text } from "@radix-ui/themes"
import type { ConsoleEntry } from "./console-plan.ts"

/** What a tile needs to draw: the glyph, the name under it, and the accent. */
export interface AppMark {
  readonly title: string
  readonly icon: string
  readonly color: string
}

/** Radix takes its own accent-name union; the catalogue carries it as a string. */
const accent = (color: string): never => color as never

export const markOf = (entry: ConsoleEntry): AppMark => ({ title: entry.title, icon: entry.icon, color: entry.color })

export const AppAvatar = ({ mark, size = "5" }: { readonly mark: AppMark; readonly size?: "4" | "5" | "6" }) =>
  <Avatar size={size} radius="large" variant="solid" color={accent(mark.color)} fallback={mark.icon} />

/** The springboard's form: the mark, then the name underneath. */
export const AppTile = ({ mark, onSelect }: { readonly mark: AppMark; readonly onSelect: () => void }) =>
  <Card asChild size="2">
    <button type="button" onClick={onSelect} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 0 }}>
      <Flex direction="column" align="center" gap="2" py="2">
        <AppAvatar mark={mark} size="6" />
        <Text size="2" weight="medium" align="center">{mark.title}</Text>
      </Flex>
    </button>
  </Card>
