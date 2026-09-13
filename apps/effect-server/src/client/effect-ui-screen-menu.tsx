/**
 * The functions of a view the host had to read off the layout, offered on the
 * first screen.
 *
 * A view that declares its screens also declares what opens them — every one of
 * them has a control somewhere, and the control says `opens`. Screens that were
 * read instead have no such control, because they were never declared: they are
 * the layout's own blocks, split apart. So the host draws the control they are
 * missing, here, and it is the host's rather than the view's precisely because
 * nothing in the view asked for it.
 *
 * That is also why this is React and not a spec: the menu is not part of any
 * view, and writing it into the spec would mean inventing a synthetic action
 * name in every app's own vocabulary.
 */

import * as React from "react"
import { Button } from "@radix-ui/themes"
import { ROOT_SCREEN } from "@effect-agent/effect-ui"
import { openScreen } from "./console-nav.ts"
import type { ScreenPayload } from "./effect-ui-runtime-types.ts"

/** A screen entered from here is entered with nothing: a read screen takes no parameters by construction. */
export const ScreenMenu = ({ appId, screens }: { readonly appId: string; readonly screens: readonly ScreenPayload[] }) =>
  <div className="screen-menu">
    {screens.filter((screen) => screen.id !== ROOT_SCREEN).map((screen) =>
      <Button key={screen.id} variant="soft" size="2"
        onClick={() => openScreen(appId, { screen: screen.id })}>{screen.title}</Button>)}
  </div>
