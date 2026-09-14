import * as React from "react"
import { JSONUIProvider } from "@json-render/react"
import { ROOT_SCREEN } from "@effect-agent/effect-ui"
import { makeActionHandlers, type OpenScreen } from "./effect-ui-action-runtime.ts"
import { askConfirm } from "./effect-ui-confirm.ts"
import { ConfirmGate } from "./effect-ui-confirm-gate.tsx"
import { adaptRegistry } from "./adapt/registry.ts"
import { adaptComponent } from "./adapt/render.tsx"
import { ownComponents } from "./effect-ui-own-components.tsx"
import { ConsoleTheme } from "./console-theme.tsx"
import { ScreenMenu } from "./effect-ui-screen-menu.tsx"
import { ScreenPanes } from "./effect-ui-screen-panes.tsx"
import { useNavState, useScreenView } from "./effect-ui-screen-nav.ts"
import { useScreenEnter } from "./effect-ui-screen-entry.ts"
import { useScreenBack } from "./effect-ui-screen-back.ts"
import { useMountedView } from "./effect-ui-mount.ts"
import { SourceLoader, useViewStore } from "./effect-ui-view-state.tsx"
import { openScreen } from "./console-nav.ts"
import type { EffectUiRuntimeSpec } from "./effect-ui-runtime-types.ts"

type Props = { readonly runtime?: EffectUiRuntimeSpec }

const asParams = (values: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value ?? "")]))

export const EffectUiRuntime = ({ runtime }: Props) => {
  const screens = React.useMemo(() => runtime?.screens ?? [], [runtime])
  const sources = React.useMemo(() => runtime?.sources ?? [], [runtime])
  const appId = runtime?.appId ?? ""
  const registry = React.useMemo(
    () => Object.assign({}, ...screens.map((screen) => adaptRegistry(screen.spec, adaptComponent, ownComponents))),
    [screens],
  )
  const store = useViewStore(screens[0]?.spec.state, sources)
  const fetcher = React.useMemo(() => window.fetch.bind(window), [])
  const { chain, current, params } = useScreenView(screens)
  useNavState(store, current?.id, params)
  const open = React.useCallback<OpenScreen>((screen, values) => openScreen(appId, { screen, params: asParams(values) }), [appId])
  const { back, returnTo } = useScreenBack(appId, chain, screens)
  const handlers = React.useMemo(
    () => makeActionHandlers({ actions: runtime?.actions, sources, store, open, fetcher, ask: askConfirm }),
    [runtime?.actions, sources, store, open, fetcher],
  )
  useScreenEnter(handlers, current, params)
  useMountedView(appId, back, handlers)
  if (current === undefined) return null
  const menu = runtime?.menu === true && current.id === ROOT_SCREEN
    ? <ScreenMenu appId={appId} title={runtime.title ?? appId} screens={screens} />
    : null
  return <ConsoleTheme fill>
    <JSONUIProvider store={store} registry={registry} handlers={handlers}>
      <SourceLoader sources={sources} store={store} fetcher={fetcher} />
      <ScreenPanes chain={chain} registry={registry} menu={menu} onBack={back} returnLabel={returnTo?.title} />
      <ConfirmGate />
    </JSONUIProvider>
  </ConsoleTheme>
}
