import { Effect, Fiber, Stream } from "effect"
import type { ReprClient, ReprSnapshot } from "@effect-agent/repr"
import { classifyViewport } from "@effect-agent/ui"

export interface MountedWebUi {
  readonly unmount: Effect.Effect<void>
}

const css = `
.ea-shell{--bg:#111416;--panel:#181c1f;--line:#30363b;--text:#d8dddf;--muted:#899399;--accent:#82b7a2;--bad:#df817c;color:var(--text);background:var(--bg);font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;height:100%;min-height:320px;display:grid;overflow:hidden}
.ea-shell[data-layout=wide],.ea-shell[data-layout=ultrawide]{grid-template-columns:minmax(200px,27%) minmax(300px,43%) minmax(220px,30%);grid-template-rows:34px 1fr;grid-template-areas:"toolbar toolbar toolbar" "list inspector ledger"}.ea-shell[data-layout=ultrawide]{grid-template-columns:minmax(220px,20%) minmax(360px,42%) minmax(280px,38%)}
.ea-shell[data-layout=square]{grid-template-columns:minmax(190px,36%) 1fr;grid-template-rows:34px minmax(180px,66%) minmax(110px,34%);grid-template-areas:"toolbar toolbar" "list inspector" "ledger ledger"}
.ea-shell[data-layout=portrait]{grid-template-columns:1fr;grid-template-rows:34px minmax(100px,25%) minmax(180px,45%) minmax(110px,30%);grid-template-areas:"toolbar" "list" "inspector" "ledger"}
.ea-toolbar{grid-area:toolbar;display:flex;align-items:center;gap:7px;border-bottom:1px solid var(--line);padding:3px 7px;background:var(--panel)}
.ea-mark{font-weight:700;letter-spacing:.08em}.ea-count,.ea-rev{color:var(--muted)}.ea-spacer{flex:1}
.ea-shell button,.ea-shell input,.ea-shell textarea,.ea-shell select{font:inherit;color:inherit;background:#0f1214;border:1px solid var(--line);border-radius:2px}.ea-shell button{padding:3px 7px;cursor:pointer}.ea-shell button:hover{border-color:var(--accent)}.ea-shell input{padding:3px 6px;width:210px}
.ea-list{grid-area:list;border-right:1px solid var(--line);overflow:auto;min-height:0}.ea-row{display:grid;grid-template-columns:13px 1fr auto;gap:5px;padding:5px 7px;border-bottom:1px solid #202529;cursor:pointer}.ea-row:hover{background:#1c2225}.ea-row[data-selected=true]{background:#20302b;box-shadow:inset 2px 0 var(--accent)}.ea-dot{color:var(--muted)}.ea-dot.active{color:var(--accent)}.ea-dot.failed{color:var(--bad)}.ea-proto{color:var(--muted);overflow:hidden;text-overflow:ellipsis}
.ea-inspector{grid-area:inspector;padding:8px;overflow:auto;min-height:0}.ea-section{display:grid;grid-template-columns:92px 1fr;gap:4px 9px;margin-bottom:9px}.ea-label{color:var(--muted)}.ea-caps{display:flex;flex-wrap:wrap;gap:4px}.ea-cap[data-active=true]{border-color:var(--accent);color:var(--accent)}.ea-schemas{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:5px 0 9px}.ea-schema{min-width:0}.ea-schema pre{box-sizing:border-box;min-height:54px;max-height:150px;margin:2px 0 0;padding:5px;overflow:auto;color:var(--muted);background:#0f1214;border:1px solid var(--line);white-space:pre-wrap}.ea-call{display:grid;grid-template-columns:1fr auto;gap:5px}.ea-call textarea{grid-column:1/-1;resize:vertical;min-height:62px;padding:5px}.ea-close{grid-column:1/-1;justify-self:start}.ea-result{grid-column:1/-1;width:100%;box-sizing:border-box;white-space:pre-wrap;color:var(--muted);min-height:32px;max-height:120px;margin:0;padding:5px;overflow:auto;border-left:2px solid var(--line)}
.ea-ledger{grid-area:ledger;border-top:1px solid var(--line);border-left:1px solid var(--line);display:grid;grid-template-rows:27px 1fr;min-height:0}.ea-ledger-head{display:flex;align-items:center;gap:8px;padding:3px 7px;background:var(--panel)}.ea-events{overflow:auto}.ea-event{display:grid;grid-template-columns:46px minmax(90px,25%) minmax(80px,22%) 1fr;gap:7px;padding:3px 7px;border-bottom:1px solid #202529}.ea-event span:first-child,.ea-event span:nth-child(3){color:var(--muted)}.ea-empty{color:var(--muted);padding:8px}
.ea-shell[data-density=compact] .ea-toolbar input{width:100px}.ea-shell[data-density=compact] .ea-event{grid-template-columns:38px minmax(80px,1fr) 1fr}.ea-shell[data-density=compact] .ea-event span:nth-child(3){display:none}.ea-shell[data-density=compact] .ea-schemas{grid-template-columns:1fr}
`

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

const text = (tag: keyof HTMLElementTagNameMap, value: string, className?: string) => {
  const node = element(tag, className)
  node.textContent = value
  return node
}

const printable = (value: unknown) => {
  try { return typeof value === "string" ? value : JSON.stringify(value, null, 2) }
  catch { return String(value) }
}

/** Mount a compact operational workbench driven only by ReprClient. */
export const mountWebUi = (root: HTMLElement, client: ReprClient): Effect.Effect<MountedWebUi, never> =>
  Effect.gen(function* () {
    let snapshot = yield* client.snapshot
    let activeCapability: string | undefined

    const style = element("style")
    style.textContent = css
    const shell = element("section", "ea-shell")
    const toolbar = element("header", "ea-toolbar")
    const mark = text("span", "CORE", "ea-mark")
    const count = text("span", "", "ea-count")
    const revision = text("span", "", "ea-rev")
    const spacer = element("span", "ea-spacer")
    const filter = element("input")
    filter.placeholder = "filter connections"
    filter.setAttribute("aria-label", "Filter connections")
    const refresh = text("button", "refresh") as HTMLButtonElement
    toolbar.append(mark, count, revision, spacer, filter, refresh)

    const list = element("nav", "ea-list")
    const inspector = element("section", "ea-inspector")

    const ledger = element("section", "ea-ledger")
    const ledgerHead = element("header", "ea-ledger-head")
    ledgerHead.append(text("strong", "EVENT LEDGER"))
    const clear = text("button", "clear") as HTMLButtonElement
    ledgerHead.append(clear)
    const events = element("div", "ea-events")
    ledger.append(ledgerHead, events)
    shell.append(toolbar, list, inspector, ledger)
    root.replaceChildren(style, shell)

    const dispatch = (intent: Parameters<ReprClient["dispatch"]>[0]) =>
      Effect.runPromise(client.dispatch(intent)).catch((error) => {
        const output = inspector.querySelector<HTMLElement>(".ea-result")
        if (output) output.textContent = `error: ${String(error)}`
      })

    const render = (next: ReprSnapshot) => {
      snapshot = next
      count.textContent = `${next.connections.length} connections`
      revision.textContent = `rev:${next.revision}`
      if (document.activeElement !== filter) filter.value = next.filter
      const visible = next.connections.filter((connection) =>
        !next.filter || `${connection.id} ${connection.protocol ?? ""} ${connection.capabilities.map((capability) => capability.name).join(" ")}`.toLowerCase().includes(next.filter.toLowerCase()))
      list.replaceChildren(...visible.map((connection) => {
        const row = element("div", "ea-row")
        row.dataset.selected = String(connection.id === next.selected)
        row.append(
          text("span", connection.status === "active" ? "●" : connection.status === "failed" ? "!" : "·", `ea-dot ${connection.status}`),
          text("span", connection.id),
          text("span", connection.protocol ?? "—", "ea-proto")
        )
        row.onclick = () => dispatch({ type: "select", connection: connection.id })
        return row
      }))

      const selected = next.connections.find((connection) => connection.id === next.selected)
      inspector.replaceChildren()
      if (!selected) {
        inspector.append(text("div", "No connection selected", "ea-empty"))
      } else {
        const facts = element("div", "ea-section")
        facts.append(
          text("span", "connection", "ea-label"), text("strong", selected.id),
          text("span", "protocol", "ea-label"), text("span", selected.protocol ?? "—"),
          text("span", "state", "ea-label"), text("span", selected.status),
          text("span", "last event", "ea-label"), text("span", selected.lastEvent ?? "—")
        )
        const caps = element("div", "ea-caps")
        for (const capability of selected.capabilities) {
          const button = text("button", capability.name, "ea-cap") as HTMLButtonElement
          button.title = capability.description ?? capability.name
          button.dataset.active = String(capability.name === activeCapability)
          button.onclick = () => { activeCapability = capability.name; render(snapshot) }
          caps.append(button)
        }
        activeCapability = activeCapability && selected.capabilities.some((capability) => capability.name === activeCapability)
          ? activeCapability
          : selected.capabilities[0]?.name
        const capabilitySpec = selected.capabilities.find((capability) => capability.name === activeCapability)
        const schemas = element("div", "ea-schemas")
        const schemaView = (label: string, schema: unknown) => {
          const wrapper = element("section", "ea-schema")
          wrapper.append(text("div", label, "ea-label"), text("pre", printable(schema)))
          return wrapper
        }
        schemas.append(schemaView("INPUT SCHEMA", capabilitySpec?.input), schemaView("OUTPUT SCHEMA", capabilitySpec?.output))
        const call = element("div", "ea-call")
        const selectedCap = element("select")
        for (const capability of selected.capabilities) {
          const option = element("option")
          option.value = capability.name
          option.textContent = capability.name
          option.selected = capability.name === activeCapability
          selectedCap.append(option)
        }
        selectedCap.onchange = () => { activeCapability = selectedCap.value; render(snapshot) }
        const invoke = text("button", "invoke") as HTMLButtonElement
        const input = element("textarea")
        input.value = "{}"
        const result = element("pre", "ea-result")
        const invocation = next.invocations[selected.id]
        result.textContent = !invocation
          ? "No invocation yet"
          : invocation.status === "running"
            ? `running ${invocation.capability}…`
            : invocation.status === "failed"
              ? `error: ${invocation.error ?? "unknown error"}`
              : printable(invocation.output)
        invoke.onclick = () => {
          let value: unknown
          try { value = JSON.parse(input.value) }
          catch (error) { result.textContent = `invalid JSON: ${String(error)}`; return }
          Effect.runPromise(client.dispatch({
            type: "invoke",
            connection: selected.id,
            capability: selectedCap.value,
            input: value
          })).catch(() => { /* Repr stores and renders the failure. */ })
        }
        const close = text("button", "close session", "ea-close") as HTMLButtonElement
        close.onclick = () => dispatch({ type: "close", connection: selected.id })
        call.append(selectedCap, invoke, input, close, result)
        inspector.append(facts, text("div", "CAPABILITIES", "ea-label"), caps, schemas, text("div", "INVOKE", "ea-label"), call)
      }

      events.replaceChildren(...(next.events.length ? next.events.slice().reverse().map((event) => {
        const row = element("div", "ea-event")
        row.append(
          text("span", String(event.sequence)),
          text("span", event.connectionId),
          text("span", event.adapter),
          text("span", event.kind)
        )
        return row
      }) : [text("div", "No events recorded", "ea-empty")]))
    }

    filter.oninput = () => dispatch({ type: "filter", value: filter.value })
    refresh.onclick = () => dispatch({ type: "refresh" })
    clear.onclick = () => dispatch({ type: "clear-events" })
    render(snapshot)

    const resize = new ResizeObserver(([entry]) => {
      if (!entry) return
      const profile = classifyViewport({
        inlineSize: entry.contentRect.width,
        blockSize: entry.contentRect.height,
        unit: "pixel"
      })
      shell.dataset.layout = profile.family
      shell.dataset.density = profile.density
    })
    resize.observe(shell)

    const fiber = yield* Stream.runForEach(client.changes, (next) => Effect.sync(() => render(next))).pipe(Effect.forkDaemon)
    return {
      unmount: Fiber.interrupt(fiber).pipe(Effect.zipRight(Effect.sync(() => {
        resize.disconnect()
        root.replaceChildren()
      })))
    }
  })
