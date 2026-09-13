/**
 * An app as the design system draws it.
 *
 * A tile is an `Avatar`: the library's own component for "a small coloured mark
 * that stands for a thing", which is exactly what an app icon is. Both the mark
 * and the colour arrive on the entry, declared by the app itself, so this file
 * holds no list of app ids — adding an app never means editing the console.
 */

import * as React from "react"
import { Avatar, Card, Flex, Text } from "@radix-ui/themes"
import type { ConsoleEntry } from "./console-plan.ts"

/** Radix takes its own accent-name union; the catalogue carries it as a string. */
const accent = (color: string): never => color as never

export const AppAvatar = ({ entry, size = "5" }: { readonly entry: ConsoleEntry; readonly size?: "4" | "5" | "6" }) =>
  <Avatar size={size} radius="large" variant="solid" color={accent(entry.color)} fallback={entry.icon} />

/** The dock's form: the mark alone, inline beside a label. */
export const AppMark = ({ entry, size = "2" }: { readonly entry: ConsoleEntry; readonly size?: "1" | "2" | "3" }) =>
  <Avatar size={size} radius="large" variant="solid" color={accent(entry.color)} fallback={entry.icon} />

/** The springboard's form: the mark, then the name underneath. */
export const AppTile = ({ entry, onSelect }: { readonly entry: ConsoleEntry; readonly onSelect: () => void }) =>
  <Card asChild size="2">
    <button type="button" onClick={onSelect} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 0 }}>
      <Flex direction="column" align="center" gap="2" py="2">
        <AppAvatar entry={entry} size="6" />
        <Text size="2" weight="medium" align="center">{entry.title}</Text>
      </Flex>
    </button>
  </Card>
