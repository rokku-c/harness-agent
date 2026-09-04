/**
 * Official A2UI v0.9 renderer embedded in the console panel.
 * ONE MessageProcessor (@a2ui/web_core) owns the surface state; the official
 * A2uiSurface + basicCatalog (@a2ui/react) paint it. Re-renders feed the
 * processor the same message protocol the agent emitted - nothing custom.
 */
import { type JSX, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { MessageProcessor, injectBasicCatalogStyles, type A2uiClientAction, type ActionListener, type SurfaceModel } from "@a2ui/web_core/v0_9"
import { A2uiSurface, basicCatalog } from "@a2ui/react/v0_9"

// ---- module-level surface registry (one processor per page) ---------------
const surfaceMap = new Map<string, SurfaceModel<any>>()
const listeners = new Set<() => void>()
let versionCounter = 0
let processor: MessageProcessor<any> | null = null

const bump = (): void => { versionCounter += 1; for (const fn of listeners) fn() }
const subscribe = (fn: () => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
const getSnapshot = (): number => versionCounter

const ensureProcessor = (onAction: ActionListener): MessageProcessor<any> => {
  if (processor === null) {
    processor = new MessageProcessor([basicCatalog], (action: A2uiClientAction) => onAction(action))
    processor.onSurfaceCreated((surface) => { surfaceMap.set(surface.id, surface as SurfaceModel<any>); bump() })
    processor.onSurfaceDeleted((id) => { surfaceMap.delete(id); bump() })
    injectBasicCatalogStyles()
  }
  return processor
}

export interface A2uiHostProps {
  /** stable version key - only a NEW agent batch (or a restore) reprocesses */
  readonly version: number
  /** official A2UI v0.9 messages for this version */
  readonly messages: ReadonlyArray<unknown>
  /** user clicked a component action on the surface */
  readonly onAction: (action: A2uiClientAction) => void
}

export const A2uiHost = ({ version, messages, onAction }: A2uiHostProps): JSX.Element | null => {
  const onActionRef = useRef(onAction)
  onActionRef.current = onAction
  ensureProcessor((action) => onActionRef.current(action))
  useSyncExternalStore(subscribe, getSnapshot)
  const [error, setError] = useState<string | null>(null)
  const appliedVersion = useRef<number | null>(null)

  useEffect(() => {
    if (appliedVersion.current === version) return
    appliedVersion.current = version
    const proc = ensureProcessor((action) => onActionRef.current(action))
    try {
      const batch = messages as unknown as Array<Record<string, unknown>>
      const first = batch.find((m) => typeof m["createSurface"] === "object" && m["createSurface"] !== null)
      if (first !== undefined) {
        const surfaceId = String((first["createSurface"] as Record<string, unknown>)["surfaceId"] ?? "main")
        try { proc.processMessages([{ version: "v0.9", deleteSurface: { surfaceId } }] as never) } catch { /* absent */ }
      }
      proc.processMessages(batch as never)
      setError(null)
    } catch (caught) {
      setError(String(caught))
      appliedVersion.current = null // let the next batch retry
    }
  }, [version])

  const latest = surfaceMap.size > 0 ? [...surfaceMap.values()][surfaceMap.size - 1] : null
  if (latest === null && error === null) return null
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {error !== null && (
        <div style={{ fontSize: 11, color: "var(--mantine-color-red-4)", fontFamily: "var(--mantine-font-family-monospace)", padding: "2px 0 6px" }}>
          a2ui: {error}
        </div>
      )}
      {latest !== null && <A2uiSurface surface={latest} />}
    </div>
  )
}
