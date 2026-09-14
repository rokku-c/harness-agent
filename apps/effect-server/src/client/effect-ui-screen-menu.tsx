import * as React from "react"
import { Button, Flex } from "@radix-ui/themes"
import { ROOT_SCREEN } from "@effect-agent/effect-ui"
import { openScreen } from "./console-nav.ts"
import type { ScreenPayload } from "./effect-ui-runtime-types.ts"

export const ScreenMenu = ({ appId, title, screens }: {
  readonly appId: string
  readonly title: string
  readonly screens: readonly ScreenPayload[]
}) =>
  <Flex wrap="wrap" gap="2" pt="3" role="group" aria-label={`Screens of ${title}`}>
    {screens.filter((screen) => screen.id !== ROOT_SCREEN).map((screen) =>
      <Button key={screen.id} variant="soft" size="1"
        onClick={() => openScreen(appId, { screen: screen.id })}>{screen.title}</Button>)}
  </Flex>
