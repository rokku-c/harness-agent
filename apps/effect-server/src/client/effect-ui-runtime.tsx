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
import { adaptRegistry } from "./adapt/registry.ts"
import { adaptComponent } from "./adapt/render.tsx"
import { ConsoleTheme } from "./console-theme.tsx"
import { ScreenMenu } from "./effect-ui-screen-menu.tsx"
import { ScreenPanes } from "./effect-ui-screen-panes.tsx"
import { useNavState, useScreenView } from "./effect-ui-screen-nav.ts"
import { useScreenEnter } from "./effect-ui-screen-entry.ts"
import { SourceLoader, useViewStore } from "./effect-ui-view-state.tsx"
import { openScreen, navigate } from "./console-nav.ts"
import { canGoBack, backTarget } from "./console-stack.ts"
import { parseDestination } from "./console-route.ts"
import type { EffectUiRuntimeSpec } from "./effect-ui-runtime-types.ts"

type Props = {
  /** The components the host renders itself, when a view names one the library does not have. */
  readonly ours?: ComponentRegistry
  readonly runtime?: EffectUiRuntimeSpec
}

/** A parameter rides in a link, so it arrives as the strings a query string can carry. */
const asParams = (values: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value ?? "")]))

export const EffectUiRuntime = ({ ours, runtime }: Props) => {
  const screens = React.useMemo(() => runtime?.screens ?? [], [runtime])
  const sources = React.useMemo(() => runtime?.sources ?? [], [runtime])
  const appId = runtime?.appId ?? ""
  /**
   * One registry for the whole view: every name any screen uses, resolved once.
   * Built across all the screens rather than one at a time because the provider
   * holds the registry too — a registry per screen would be two answers to what
   * a name means inside one view, and the two would not agree the moment a
   * screen was added.
   */
  const registry = React.useMemo(
    () => Object.assign({}, ...screens.map((screen) => adaptRegistry(screen.spec, adaptComponent, ours))),
    [screens, ours],
  )
  const store = useViewStore(screens[0]?.spec.state, sources)
  const fetcher = React.useMemo(() => window.fetch.bind(window), [])
  const { chain, current, params } = useScreenView(screens)
  useNavState(store, current?.id, params)
  const open = React.useCallback<OpenScreen>((screen, values) => openScreen(appId, { screen, params: asParams(values) }), [appId])
  /**
   * Up one level. A screen this session walked to has the screen it came from
   * behind it in the browser's history, and going back through that history is
   * what keeps the ancestors' own parameters; a screen the reader pasted in has
   * nothing behind it, and there the chain the view declares is the answer
   * (screen.ts), which is also the only one that cannot leave the product.
   */
  const back = React.useCallback(() => {
    if (canGoBack()) { window.history.back(); return }
    // The first screen is `nodes`, and the address names it by saying nothing.
    const parent = chain[chain.length - 2]?.id
    navigate({ kind: "app", id: appId, ...(parent === undefined || parent === ROOT_SCREEN ? {} : { screen: parent }) })
  }, [appId, chain])
  /**
   * Where the return control goes, named by that destination's own title (§2.H5):
   * a walked screen is the one the history is about to land on, a pasted one is
   * the parent the view declares. It is never the word "Back", because two
   * controls that both read as "back" is the defect this replaces.
   */
  const returnTo = React.useMemo(() => {
    const parent = chain[chain.length - 2]
    if (!canGoBack()) return parent
    const screen = parseDestination(backTarget() ?? "").screen ?? ROOT_SCREEN
    return screens.find((candidate) => candidate.id === screen) ?? parent
  }, [chain, screens])
  const handlers = React.useMemo(() => makeActionHandlers(runtime?.actions, sources, store, open, fetcher), [runtime?.actions, sources, store, open, fetcher])
  useScreenEnter(handlers, current, params)
  if (current === undefined) return null
  const menu = runtime?.menu === true && current.id === ROOT_SCREEN ? <ScreenMenu appId={appId} screens={screens} /> : null
  return <ConsoleTheme fill>
    <JSONUIProvider store={store} registry={registry} handlers={handlers}>
      <SourceLoader sources={sources} store={store} fetcher={fetcher} />
      <ScreenPanes chain={chain} registry={registry} menu={menu} onBack={back} returnLabel={returnTo?.title} />
    </JSONUIProvider>
  </ConsoleTheme>
}
