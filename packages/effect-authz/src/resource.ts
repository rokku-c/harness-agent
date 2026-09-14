export interface Resource {
  readonly raw: string
}

export interface ParsedResource {
  readonly scheme: string
  readonly segments: readonly string[]
}

export const ANY_SEGMENT = "*"
export const REST_SEGMENT = "**"

export const asResource = (raw: string): Resource => ({ raw })

export const parseResource = (raw: string): ParsedResource => {
  const schemeAt = raw.indexOf("://")
  if (schemeAt >= 0) return { scheme: raw.slice(0, schemeAt), segments: raw.slice(schemeAt + 3).split("/") }
  const nsAt = raw.indexOf("::")
  if (nsAt >= 0) return { scheme: "", segments: [raw.slice(0, nsAt), ...raw.slice(nsAt + 2).split(".")] }
  return { scheme: "", segments: [raw] }
}

export const formatResource = (parsed: ParsedResource): string => {
  if (parsed.scheme !== "") return `${parsed.scheme}://${parsed.segments.join("/")}`
  if (parsed.segments.length <= 1) return parsed.segments.join("")
  const [ns, ...rest] = parsed.segments
  return `${ns}::${rest.join(".")}`
}

export const namespaceResource = (ns: string): Resource => asResource(ns)
export const appResource = (ns: string, appId: string): Resource => asResource(`${ns}::${appId}`)
export const toolResource = (ns: string, appId: string, tool: string): Resource => asResource(`${ns}::${appId}.${tool}`)
export const uiResource = (ns: string, appId: string, view: string): Resource => asResource(`ui://${ns}/${appId}/${view}`)
export const storeResource = (ns: string, appId: string, key: string): Resource => asResource(`store://${ns}/${appId}/${key}`)
export const configResource = (ns: string, appId: string): Resource => asResource(`config://${ns}/${appId}`)
export const serverResource = (serverId: string): Resource => asResource(`mcp://${serverId}`)
export const serverToolResource = (serverId: string, tool: string): Resource => asResource(`mcp://${serverId}/${tool}`)
