import * as React from "react"
import { Theme } from "@radix-ui/themes"
import { useAppearance } from "./theme-appearance.ts"

export const ConsoleTheme = ({ children, fill = false }: { readonly children: React.ReactNode; readonly fill?: boolean }) => {
  const appearance = useAppearance()
  return <Theme className={fill ? "view-fill" : undefined} appearance={appearance} accentColor="jade" grayColor="gray" radius="large" scaling="100%">{children}</Theme>
}
