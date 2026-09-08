/**
 * effect.yaml manifest — declarative plugin declaration.
 *
 * Each plugin (an app/feature or an external MCP server) declares itself with
 * a transport. The server reads these manifests, auto-discovers them under
 * configured roots, and registers the enabled ones.
 */

export type EffectTransport = "inproc" | "stdio" | "http"

export interface EffectAppInfo {
  /** stable id, e.g. "console" or the ui:// resource path segment. */
  readonly id: string
  readonly title?: string
  readonly description?: string
  readonly resourceUri?: string
  /** host route where the app's live UI is served. */
  readonly path?: string
}

export interface EffectManifest {
  /** plugin id, e.g. "apps/board" or "apps/time-server". */
  readonly id: string
  readonly title?: string
  /** inproc = EffectPlugin module; stdio/http = MCP-style server. */
  readonly transport: EffectTransport
  /** inproc: module exporting `effectPlugin` (EffectPlugin). */
  readonly module?: string
  /** stdio: spawn command + args for an MCP stdio server. */
  readonly command?: string
  readonly args?: readonly string[]
  /** http: remote streamable-http endpoint. */
  readonly url?: string
  readonly headers?: Readonly<Record<string, string>>
  /** other interface ids this plugin requires. */
  readonly requires?: readonly string[]
  /** UI apps this plugin serves (registered alongside its interface). */
  readonly apps?: readonly EffectAppInfo[]
  /** declared config partial (schema default <- this yaml layer <- override). */
  readonly config?: unknown
}

export interface EffectServerYaml {
  readonly server?: { readonly control?: boolean }
  readonly network?: unknown
  /** interfaces/plugins to boot; when empty, everything discovered is enabled. */
  readonly enabled?: readonly string[]
  /** base dirs to auto-discover effect.yaml manifests under. */
  readonly roots?: readonly string[]
  /** apps to compile into bundles and connect back on boot (bun run up). */
  readonly bundles?: readonly string[]
}
