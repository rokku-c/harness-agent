/**
 * agentdeck/remote - reaching other machines. `makeSshTransport` is the only
 * implementation today; everything above depends on the `RemoteTransport`
 * shape, so a different hop (a probe channel, an agentd node) can replace it
 * without touching callers.
 */
export * from "./types.ts"
export { makeSshTransport, sshArgs, quote, DEFAULT_TIMEOUT_MS } from "./ssh.ts"
