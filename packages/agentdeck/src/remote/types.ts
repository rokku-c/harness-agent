export interface RemoteTarget {
  readonly host: string
  readonly user?: string
  readonly port?: number
  readonly identity?: string
  readonly options?: ReadonlyArray<string>
}

export interface RemoteRunOptions {
  readonly cwd?: string
  readonly stdin?: string
  readonly timeoutMs?: number
}

export interface RemoteRun {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
  readonly timedOut: boolean
}

export interface RemoteTransport {
  readonly target: RemoteTarget
  readonly run: (command: string, options?: RemoteRunOptions) => Promise<RemoteRun>
}
