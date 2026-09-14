import * as React from "react"
import { Avatar, Card, Flex, Text } from "@radix-ui/themes"
import type { ComponentType } from "react"
import { glyphs } from "./adapt/glyphs.ts"
import type { ConsoleEntry } from "./console-plan.ts"
import type { Place } from "./console-place.ts"

export interface AppMark {
  readonly id: string
  readonly title: string
  readonly icon: string
  readonly color: string
}

export type MarkSize = "2" | "3" | "4" | "5" | "6"

const MARK: Readonly<Record<MarkSize, number>> = { "2": 16, "3": 18, "4": 20, "5": 24, "6": 28 }

const accent = (color: string): never => color as never

const Mark = ({ name, size }: { readonly name: string; readonly size: MarkSize }): React.ReactNode => {
  const Glyph = glyphs[name] as ComponentType<{ weight: string; size: number }> | undefined
  return Glyph === undefined ? null : <Glyph weight="regular" size={MARK[size]} />
}

export const markOf = (entry: ConsoleEntry): AppMark =>
  ({ id: entry.id, title: entry.title, icon: entry.icon, color: entry.color })

export const placeMark = (place: Place): AppMark =>
  ({ id: place.id, title: place.title, icon: place.mark, color: place.color })

export const AppAvatar = ({ mark, size = "5" }: { readonly mark: AppMark; readonly size?: MarkSize }) =>
  <Avatar size={size} radius="large" variant="solid" color={accent(mark.color)}
    fallback={<Mark name={mark.icon} size={size} />} />

export const AppTile = ({ mark, onSelect }: { readonly mark: AppMark; readonly onSelect: () => void }) =>
  <Card asChild size="1">
    <button type="button" onClick={onSelect} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 0 }}>
      <Flex direction="column" align="center" gap="2" py="2">
        <AppAvatar mark={mark} size="6" />
        <Text size="2" weight="medium" align="center">{mark.title}</Text>
      </Flex>
    </button>
  </Card>
