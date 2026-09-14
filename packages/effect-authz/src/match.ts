import { ANY_SEGMENT, REST_SEGMENT, parseResource, type Resource } from "./resource.ts"

const alignsAt = (grant: readonly string[], target: readonly string[]): boolean => {
  for (let index = 0; index < grant.length; index++) {
    const segment = grant[index]
    if (segment !== ANY_SEGMENT && segment !== target[index]) return false
  }
  return true
}

export const covers = (grant: Resource, target: Resource): boolean => {
  const g = parseResource(grant.raw)
  const t = parseResource(target.raw)
  if (g.scheme !== "" && g.scheme !== t.scheme) return false
  const rest = g.segments[g.segments.length - 1] === REST_SEGMENT
  const head = rest ? g.segments.slice(0, -1) : g.segments
  if (head.length > t.segments.length) return false
  if (!alignsAt(head, t.segments)) return false
  if (rest) return head.length < t.segments.length
  if (head.length === t.segments.length) return true
  return !head.includes(ANY_SEGMENT)
}

export const specificityOf = (resource: Resource): number => {
  const { segments } = parseResource(resource.raw)
  if (segments[segments.length - 1] === REST_SEGMENT) return 0
  return segments.filter((segment) => segment !== ANY_SEGMENT && segment !== REST_SEGMENT).length
}
