/**
 * A declared view, mounted: its state, its screens, and the actions that move
 * between them.
 *
 * The three parts are separate and stay that way. The *store* is built once from
 * the view, and survives every screen change (effect-ui-view-state.tsx). The
 * *screen* is chosen from the address bar and nowhere else (effect-ui-screen-nav.ts),
 * so a click, a pasted link and the back button all take the same path. The
 * *actions* are the view's own, with one thing added: an action may say which
 * screen it opens (effect-ui-action-runtime.ts).
 *
 * Nothing here interprets a node. A screen is a spec, and the same renderer that
 * drew every view before this one draws it.
 */

import * as React from "react"
import { JSONUIProvider, type ComponentRegistry } from "@json-render/react"
import { ROOT_SCREEN } from "@effect-agent/effect-ui"
import { makeActionHandlers, type OpenScreen } from "./effect-ui-action-runtime.ts"
import { ConsoleTheme } from "./console-theme.tsx"
import { ScreenMenu } from "./effect-ui-screen-menu.tsx"
import { ScreenPanes } from "./effect-ui-screen-panes.tsx"
import { useNavState, useScreenView } from "./effect-ui-screen-nav.ts"
import { SourceLoader, useViewStore } from "./effect-ui-view-state.tsx"
import { openScreen } from "./console-nav.ts"
import type { EffectUiRuntimeSpec } from "./effect-ui-runtime-types.ts"

type Props = { readonly registry: ComponentRegistry; readonly runtime?: EffectUiRuntimeSpec }

/** A parameter rides in a link, so it arrives as the strings a query string can carry. */
const asParams = (values: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value ?? "")]))

export const EffectUiRuntime = ({ registry, runtime }: Props) => {
  const screens = runtime?.screens ?? [], sources = runtime?.sources ?? [], appId = runtime?.appId ?? ""
  const store = useViewStore(screens[0]?.spec.state, sources)
  const fetcher = React.useMemo(() => window.fetch.bind(window), [])
  const { chain, current, params } = useScreenView(screens)
  useNavState(store, current?.id, params)
  const open = React.useCallback<OpenScreen>((screen, values) => openScreen(appId, { screen, params: asParams(values) }), [appId])
  const handlers = React.useMemo(() => makeActionHandlers(runtime?.actions, sources, store, open, fetcher), [runtime?.actions, sources, store, open, fetcher])
  if (current === undefined) return null
  const menu = runtime?.menu === true && current.id === ROOT_SCREEN ? <ScreenMenu appId={appId} screens={screens} /> : null
  return <ConsoleTheme fill>
    <JSONUIProvider store={store} registry={registry} handlers={handlers}>
      <SourceLoader sources={sources} store={store} fetcher={fetcher} />
      <ScreenPanes chain={chain} registry={registry} menu={menu} />
    </JSONUIProvider>
  </ConsoleTheme>
}
