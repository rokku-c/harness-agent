/**
 * The console's theme wrapper.
 *
 * Every mount point in the console — a view, a config form, the shell — renders
 * inside one of these, so they cannot drift apart in appearance. The accent is
 * the platform's green and the gray is neutral, which is the one place the
 * console still holds an opinion: everything else about how a component looks
 * is the design system's, and changing it here changes it everywhere.
 *
 * `fill` carries the screen chain through: `Theme` renders a div of its own and
 * takes no height prop, so it takes the class instead. Only a surface that is
 * itself a screen asks for it — a document screen leaves its theme as tall as
 * its content, which is what it wants.
 */

import * as React from "react"
import { Theme } from "@radix-ui/themes"
import { useAppearance } from "./theme-appearance.ts"

export const ConsoleTheme = ({ children, fill = false }: { readonly children: React.ReactNode; readonly fill?: boolean }) => {
  const appearance = useAppearance()
  return <Theme className={fill ? "view-fill" : undefined} appearance={appearance} accentColor="jade" grayColor="gray" radius="large" scaling="100%">{children}</Theme>
}
