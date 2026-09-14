import * as React from "react"

let sentence = ""
const details = new Map<string, string>()
const listeners = new Set<() => void>()

const emit = (): void => { for (const listener of listeners) listener() }
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const announce = (next: string): void => {
  if (next === sentence) return
  sentence = next
  emit()
}

export const liveSentence = (): string => sentence

export const useLiveSentence = (): string => React.useSyncExternalStore(subscribe, liveSentence)

export const useRouteDetail = (kind: string): string | undefined =>
  React.useSyncExternalStore(subscribe, () => details.get(kind))

export const useRouteAnnouncement = (kind: string, title: string): void => {
  const detail = useRouteDetail(kind)
  React.useEffect(() => {
    announce(detail === undefined ? title : `${title}, ${detail}`)
  }, [kind, title, detail])
}

export const useRouteDetailFor = (kind: string, detail: string | undefined): void => {
  React.useEffect(() => () => { if (details.delete(kind)) emit() }, [kind])
  React.useEffect(() => {
    if (detail === undefined || details.get(kind) === detail) return
    details.set(kind, detail)
    emit()
  }, [kind, detail])
}
