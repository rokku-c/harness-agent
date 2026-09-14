export type EffectTransport = "inproc" | "stdio" | "http"

export interface EffectAppInfo {
  readonly id: string
  readonly title?: string
  readonly description?: string
  readonly resourceUri?: string
  readonly path?: string
}

export interface EffectManifest {
  readonly id: string
  readonly title?: string
  readonly transport: EffectTransport
  readonly module?: string
  readonly command?: string
  readonly args?: readonly string[]
  readonly url?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly apps?: readonly EffectAppInfo[]
  readonly config?: unknown
}

export interface EffectServerYaml {
  readonly server?: { readonly control?: boolean }
  readonly network?: unknown
  readonly enabled?: readonly string[]
  readonly roots?: readonly string[]
  readonly bundles?: readonly string[]
}
