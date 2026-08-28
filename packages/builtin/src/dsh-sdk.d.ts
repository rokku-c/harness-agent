/**
 * Minimal ambient type surface for the DeepSeek Harness TS client
 * (@deepseek-ai/dsh-sdk-client, 0.1.1-rc.2). The dsh connection adapter never
 * imports this package directly (injection-first, no hard dependency), so this
 * declaration exists only to keep the lazy loader's dynamic import typechecked
 * while the package is not installed. See docs/dsh-connection.md §2.5.
 */
declare module "@deepseek-ai/dsh-sdk-client" {
  /** Launch spec for the runtime subprocess (subset of the SDK's HarnessClientOptions). */
  export interface DshSdkLaunchOptions {
    readonly command: string
    readonly args?: string[]
    readonly cwd?: string
    /** Merged subprocess env (host + per-key overrides); the SDK replaces process.env wholesale when set. */
    readonly env?: Readonly<Record<string, string>>
    readonly requestTimeoutMs?: number
  }

  /** Options for the high-level DeepSeekHarness wrapper (subset of DeepSeekHarnessOptions). */
  export interface DshSdkHarnessOptions {
    readonly launch: DshSdkLaunchOptions
    readonly cwd?: string
    readonly provider?: string
    readonly model?: string
    readonly maxTokens?: number
  }

  /** One owned session activity interval (subset of RunResult). */
  export interface DshSdkRunResult {
    readonly sessionId: string
    readonly finalResponse: string
    /**
     * Best-effort replay of the session activity in this interval. The real
     * surface is @deepseek-ai/dsh-session's SessionEvent[] (dsh source
     * packages/sdk/client/src/types.ts:68); the adapter passes events through
     * opaquely (unknown here) and never interprets their shape.
     */
    readonly events: ReadonlyArray<unknown>
    readonly notifications: ReadonlyArray<unknown>
  }

  /** High-level client: lazy runtime subprocess, one run per prompt, close reaps the child. */
  export class DeepSeekHarness {
    constructor(options: DshSdkHarnessOptions)
    readonly start: () => Promise<void>
    readonly run: (input: string, options?: { readonly sessionId?: string }) => Promise<DshSdkRunResult>
    readonly session: (sessionId?: string) => unknown
    readonly close: () => Promise<void>
  }
}