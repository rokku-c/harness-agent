/**
 * An app as the design system draws it.
 *
 * A tile is an `Avatar`: the library's own component for "a small coloured mark
 * that stands for a thing", which is exactly what an app icon is. Both the mark
 * and the colour arrive on the entry, declared by the app itself, so this file
 * holds no list of app ids — adding an app never means editing the console.
 *
 * The mark arrives as a *name*, not a character. §8 rule 2 allows no emoji and
 * no textual glyph stand-in in a tile's mark, so what an app declares is one of
 * `glyphs.ts`'s names, and this is where a name becomes the component that
 * draws it. A mark that is not a name in that table draws nothing rather than a
 * letter: the vocabulary is closed on purpose, and a tile that shows the app's
 * colour and no glyph reads "this app declared a mark I do not know" honestly,
 * where an invented initial would read as a mark the app never chose.
 *
 * Places draw with the same tile (`#tools`, `#settings`, the dock), and a place
 * is not an app: it has a mark and a title but no catalogue entry and no view.
 * So the drawing takes a `mark`, not an entry — the alternative is a fake
 * `ConsoleEntry` per place, and a fake entry is how a place ends up in an app
 * list.
 */

import * as React from "react"
import { Avatar, Card, Flex, Text } from "@radix-ui/themes"
import type { ComponentType } from "react"
import { glyphs } from "./adapt/glyphs.ts"
import type { ConsoleEntry } from "./console-plan.ts"
import type { Place } from "./console-place.ts"

/** What a tile needs to draw and to be found by: the id, the name under it, the marked glyph's name, and the accent. */
export interface AppMark {
  readonly id: string
  readonly title: string
  readonly icon: string
  readonly color: string
}

export type MarkSize = "2" | "3" | "4" | "5" | "6"

/**
 * A mark is sized by its avatar, and these are the library's own steps for that
 * — `--avatar-fallback-one-letter-font-size` is `--font-size-3`..`--font-size-7`
 * across sizes 2 to 6, which is 16, 18, 20, 24 and 28 px. So a glyph sits in the
 * circle exactly where Radix would have put a letter, and at the dock's size it
 * lands on §8's own number for the dock, which is that table's 16 px row.
 */
const MARK: Readonly<Record<MarkSize, number>> = { "2": 16, "3": 18, "4": 20, "5": 24, "6": 28 }

/** Radix takes its own accent-name union; the catalogue carries it as a string. */
const accent = (color: string): never => color as never

/** A glyph is resolved by name, so what it accepts is `never` until it is drawn. */
const Mark = ({ name, size }: { readonly name: string; readonly size: MarkSize }): React.ReactNode => {
  const Glyph = glyphs[name] as ComponentType<{ weight: string; size: number }> | undefined
  return Glyph === undefined ? null : <Glyph weight="regular" size={MARK[size]} />
}

export const markOf = (entry: ConsoleEntry): AppMark =>
  ({ id: entry.id, title: entry.title, icon: entry.icon, color: entry.color })

/** A place declares its mark for the same reason an app does: it has a colour and a title of its own. */
export const placeMark = (place: Place): AppMark =>
  ({ id: place.id, title: place.title, icon: place.mark, color: place.color })

export const AppAvatar = ({ mark, size = "5" }: { readonly mark: AppMark; readonly size?: MarkSize }) =>
  <Avatar size={size} radius="large" variant="solid" color={accent(mark.color)}
    fallback={<Mark name={mark.icon} size={size} />} />

/** The springboard's form: the mark, then the name underneath. */
export const AppTile = ({ mark, onSelect }: { readonly mark: AppMark; readonly onSelect: () => void }) =>
  <Card asChild size="1">
    <button type="button" onClick={onSelect} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 0 }}>
      <Flex direction="column" align="center" gap="2" py="2">
        <AppAvatar mark={mark} size="6" />
        <Text size="2" weight="medium" align="center">{mark.title}</Text>
      </Flex>
    </button>
  </Card>
