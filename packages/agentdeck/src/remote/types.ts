/**
 * agentdeck/remote - running a command on ANOTHER machine.
 *
 * This is the transport seam for everything remote: collecting that machine's
 * agent sessions, launching an agent in one of its working directories, probing
 * what it has installed. Nothing above this layer should know it is ssh.
 */

/** a machine we can reach as a user */
export interface RemoteTarget {
  readonly host: string
  readonly user?: string
  readonly port?: number
  /** private key path, when the agent's identity is not the ssh default */
  readonly identity?: string
  /** extra `ssh -o` options, passed through verbatim */
  readonly options?: ReadonlyArray<string>
}

export interface RemoteRunOptions {
  /** run the command from this directory on the target */
  readonly cwd?: string
  /** bytes for the command's stdin (how scripts are shipped without installing) */
  readonly stdin?: string
  readonly timeoutMs?: number
}

export interface RemoteRun {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
  /** the command did not finish inside timeoutMs and was killed */
  readonly timedOut: boolean
}

export interface RemoteTransport {
  readonly target: RemoteTarget
  readonly run: (command: string, options?: RemoteRunOptions) => Promise<RemoteRun>
}
