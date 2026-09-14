import { OperationFault } from "./operation.ts"

export const bindPath = (pattern: string, path: string): Record<string, string> | undefined => {
  const want = pattern.split("/"), got = path.split("/")
  if (want.length !== got.length) return undefined
  const bound: Record<string, string> = {}
  for (let at = 0; at < want.length; at += 1) {
    const segment = want[at] as string, value = got[at] as string
    if (segment.startsWith(":")) {
      if (value === "") return undefined
      bound[segment.slice(1)] = decodeURIComponent(value)
      continue
    }
    if (segment !== value) return undefined
  }
  return bound
}

export const queryInput = (url: URL): Record<string, unknown> => Object.fromEntries(url.searchParams)

export const bodyInput = async (request: Request): Promise<Record<string, unknown>> => {
  if (request.body === null) return {}
  const text = await request.text()
  if (text.trim() === "") return {}
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new OperationFault(400, "body is not valid JSON") }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new OperationFault(400, "body must be a JSON object")
  }
  return parsed as Record<string, unknown>
}

export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const issuesOf = (error: unknown): string | undefined => {
  const issues = (error as { issues?: ReadonlyArray<{ path: readonly PropertyKey[]; message: string }> }).issues
  if (!Array.isArray(issues)) return undefined
  return issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ")
}
