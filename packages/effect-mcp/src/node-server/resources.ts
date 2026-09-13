import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import { makeServedNames } from "./served-name.js"

export interface NodeStorePlane { readonly get: (key: string) => unknown | undefined; readonly list?: (prefix?: string) => readonly string[] }
export interface NodeResourcePlanes { readonly ui?: Readonly<Record<string, unknown>>; readonly store?: NodeStorePlane }

interface ReadResult { readonly contents: Array<{ uri: string; text: string; mimeType?: string }> }

const jsonResult = (uri: string, doc: unknown): ReadResult => ({
  contents: [{ uri, text: JSON.stringify(doc) ?? "null", mimeType: "application/json" }],
})

/**
 * One resource per view, read by its served name.
 *
 * A view id is not a URI: a slash cannot stay one, so the id is reduced the same
 * way a tool name is (`served-name.ts`). Two view ids that would share one
 * served name are refused, naming both, rather than one of them being dropped.
 */
const registerViews = (register: any, ui: Readonly<Record<string, unknown>>): void => {
  const served = makeServedNames("views")
  for (const [viewId, doc] of Object.entries(ui)) {
    const id = served(viewId, viewId) || "view"
    const uri = `ui://${id}`
    register(`ui:${id}`, uri, { description: `ui plane view ${viewId}` }, () => Promise.resolve(jsonResult(uri, doc)))
  }
}

/** The store as one resource template: `store://<key>`, listing what it holds. */
const registerStore = (register: any, store: NodeStorePlane): void => {
  const record = store as unknown as Record<string, unknown>
  const keys = (): readonly string[] =>
    store.list ? (store.list() ?? []) : Object.keys(record).filter((key) => typeof record[key] !== "function")

  register(
    "store",
    new ResourceTemplate("store://{key}", {
      list: async () => ({ resources: keys().map((key) => ({ uri: `store://${key}`, name: key })) }),
    }),
    { description: "storage plane: store://<key>" },
    async (_uri: URL, vars: Record<string, string>) => {
      const key = vars?.key ?? ""
      const value = store.get(key) ?? record[key]
      if (value === undefined) throw new Error(`store key not found: ${key}`)
      return jsonResult(`store://${key}`, value)
    },
  )
}

/** The planes a node server serves besides its tools: its views, and its store. */
export const registerResources = (server: any, planes: NodeResourcePlanes): void => {
  const register = server.registerResource.bind(server) as any
  registerViews(register, planes.ui ?? {})
  if (planes.store) registerStore(register, planes.store)
}
