/**
 * The activity snapshot: what the host's own read surfaces already say, gathered
 * into one object. It holds no markup — a surface that draws it is separate —
 * and it never invents a second status source.
 */

export interface ActivityService { readonly id: string; readonly enabled: boolean; readonly priority: number }
export interface ActivityObservation { readonly at: number; readonly perspective: string; readonly target: string; readonly error?: string }
export interface ActivitySnapshot {
  readonly services: readonly ActivityService[]
  readonly appCount: number
  readonly privilegedOperations: number
  readonly appOperations: number
  readonly observations: readonly ActivityObservation[]
  readonly failures: readonly ActivityObservation[]
}
export type ActivityFetcher = (path: string) => Promise<unknown>

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const text = (value: unknown): string => typeof value === "string" ? value : ""
const observationOf = (frame: unknown): ActivityObservation | undefined => {
  if (typeof frame !== "object" || frame === null) return undefined
  const record = frame as Record<string, unknown>
  const data = typeof record.data === "object" && record.data !== null ? record.data as Record<string, unknown> : {}
  const error = text(data.error) || text(data.detail)
  return { at: Number(record.at) || 0, perspective: text(record.perspective), target: text(record.target), ...(error === "" ? {} : { error }) }
}

export const loadActivity = async (get: ActivityFetcher): Promise<ActivitySnapshot> => {
  const [planes, apps, operations, frames] = await Promise.all([
    get("/-/status"), get("/-/apps"),
    get("/-/operations").catch(() => []), get("/-/observe/frames").catch(() => []),
  ])
  const services = asArray(planes).map((item) => {
    const record = item as Record<string, unknown>
    return { id: text(record.id), enabled: record.enabled === true, priority: Number(record.priority) || 0 }
  })
  const catalogue = apps as { ui?: unknown[]; views?: unknown[]; config?: unknown[] }
  const appIds = new Set<string>()
  for (const entry of asArray(catalogue?.ui)) if (typeof (entry as { interfaceId?: unknown }).interfaceId === "string") appIds.add((entry as { interfaceId: string }).interfaceId)
  for (const id of asArray(catalogue?.views)) if (typeof id === "string") appIds.add(id)
  for (const entry of asArray(catalogue?.config)) if (typeof (entry as { appId?: unknown }).appId === "string") appIds.add((entry as { appId: string }).appId)
  const ops = asArray(operations).map((item) => item as Record<string, unknown>)
  const observations = asArray(frames).map(observationOf).filter((item): item is ActivityObservation => item !== undefined)
  return {
    services, appCount: appIds.size,
    privilegedOperations: ops.filter((op) => op.privileged === true).length,
    appOperations: ops.filter((op) => op.privileged !== true).length,
    observations,
    failures: observations.filter((observation) => observation.error !== undefined && observation.error !== ""),
  }
}

export const fetchActivity: ActivityFetcher = async (path) => {
  const response = await fetch(path, { cache: "no-store" })
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.json()
}
