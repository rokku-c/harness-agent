import { Effect, Schema } from "effect"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { Client, type SFTPWrapper } from "ssh2"
import SSHConfig from "ssh-config"
import { ConnectionError, Op, Uri, makeContainer, makeContainers, type Connection, type ContainersService, type RemoteRequest, type RemoteResponse } from "@effect-agent/core"
import { SshDefaults } from "@effect-agent/core"

/**
 * Parse an `ssh://[user@]host[:port]/path` URI into connection parts.
 *
 *   ssh://root@example.com/tmp/test1
 *     → { user: "root", host: "example.com", port: 22, basePath: "/tmp/test1" }
 */
export interface SshUriParts {
  readonly user: string
  readonly host: string
  readonly port: number
  readonly basePath: string
}

export const parseSshUri = (uri: string): SshUriParts => {
  const url = new URL(uri)
  if (url.protocol !== "ssh:")
    throw new Error(`Not an ssh:// URI: ${uri}`)
  return {
    user: url.username || process.env.USER || "root",
    host: url.hostname,
    port: url.port ? Number(url.port) : SshDefaults.port,
    basePath: url.pathname || "/"
  }
}

/** Connection parameters resolved from `~/.ssh/config` for a given host alias. */
export interface SshConfigResolved {
  readonly hostName: string
  readonly user?: string
  readonly port?: number
  readonly identityFile?: string
}

const expandTilde = (path: string) => path.startsWith("~/") ? join(homedir(), path.slice(2)) : path

/**
 * Resolve a host alias against the user's `~/.ssh/config` (like `ssh` itself does).
 * Returns undefined when the file is absent or the host is not configured.
 *
 *   resolveSshConfig("ubuntu_dev")
 *     → { hostName: "10.9.32.228", user: "root", identityFile: "/Users/x/.ssh/id_ed25519" }
 */
export const resolveSshConfig = (host: string): SshConfigResolved | undefined => {
  const configPath = join(homedir(), ".ssh", "config")
  try {
    const text = readFileSync(configPath, "utf8")
    const parsed = SSHConfig.parse(text)
    const computed = parsed.compute(host) as Record<string, string | string[] | undefined>
    if (!computed || Object.keys(computed).length === 0) return undefined
    const hostNameRaw = Array.isArray(computed.HostName) ? computed.HostName[0] : computed.HostName
    const hostName = hostNameRaw ?? host
    const user = typeof computed.User === "string" ? computed.User : undefined
    const port = typeof computed.Port === "string" ? Number(computed.Port) : undefined
    const identityFileRaw = Array.isArray(computed.IdentityFile)
      ? computed.IdentityFile[0]
      : computed.IdentityFile
    return {
      hostName,
      ...(user ? { user } : {}),
      ...(port ? { port } : {}),
      ...(identityFileRaw ? { identityFile: expandTilde(identityFileRaw) } : {})
    }
  } catch {
    return undefined
  }
}

/** Open an SSH connection, yielding the connected Client inside a Scope. */
const connect = (parts: SshUriParts, options: { password?: string; allowUserConfig?: boolean }) =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: () => new Promise<Client>((resolve, reject) => {
        const client = new Client()
        client.on("ready", () => resolve(client))
        client.on("error", reject)
        const resolved = options.allowUserConfig ? resolveSshConfig(parts.host) : undefined
        const identityFile = resolved?.identityFile
        client.connect({
          host: resolved?.hostName ?? parts.host,
          port: resolved?.port ?? parts.port,
          username: resolved?.user ?? parts.user,
          password: options.password,
          ...(identityFile ? { privateKey: readFileSync(identityFile, "utf8") } : {})
        })
      }),
      catch: (cause) => new ConnectionError({ uri: `ssh://${parts.user}@${parts.host}`, cause })
    }),
    (client) => Effect.sync(() => { client.end() }).pipe(Effect.ignore)
  )

/** Open an SFTP session over a connected SSH client. */
const sftp = (client: Client) =>
  Effect.tryPromise({
    try: () => new Promise<SFTPWrapper>((resolve, reject) => client.sftp((err, sftp) => err ? reject(err) : resolve(sftp))),
    catch: (cause) => new ConnectionError({ uri: "ssh", cause })
  })

const joinPath = (base: string, relative: string) =>
  `${base.replace(/\/$/, "")}/${relative.replace(/^\//, "")}`

const readRemoteFile = (sftp: SFTPWrapper, path: string) =>
  new Promise<string>((resolve, reject) => {
    sftp.readFile(path, "utf8", (err, data) => err ? reject(err) : resolve(String(data)))
  })

const mkdirp = (sftp: SFTPWrapper, dir: string) =>
  new Promise<void>((resolve, reject) => {
    if (!dir || dir === "/" || dir === ".") return resolve()
    sftp.stat(dir, (statErr) => {
      if (!statErr) return resolve()
      mkdirp(sftp, dir.slice(0, Math.max(0, dir.lastIndexOf("/")))).then(() => {
        sftp.mkdir(dir, (mkdirErr) => mkdirErr ? reject(mkdirErr) : resolve())
      }, reject)
    })
  })

const writeRemoteFile = async (sftp: SFTPWrapper, path: string, content: string) => {
  const dir = path.slice(0, path.lastIndexOf("/"))
  await mkdirp(sftp, dir)
  await new Promise<void>((resolve, reject) => sftp.writeFile(path, content, "utf8", (err) => err ? reject(err) : resolve()))
}

interface SshOptions {
  readonly password?: string
  readonly allowUserConfig?: boolean
}

/**
 * Run a function against an SFTP wrapper over a fresh, scoped SSH connection.
 * The connection is opened for the duration of `run` and closed afterwards.
 */
const withSftp = <A>(parts: SshUriParts, options: SshOptions, run: (sftp: SFTPWrapper) => Promise<A>) =>
  Effect.scoped(
    Effect.gen(function*() {
      const client = yield* connect(parts, options)
      const wrapper = yield* sftp(client)
      return yield* Effect.tryPromise({
        try: () => run(wrapper),
        catch: (cause) => new Error(String(cause))
      })
    })
  ).pipe(
    Effect.mapError((cause) => cause instanceof ConnectionError
      ? cause
      : new ConnectionError({ uri: `ssh://${parts.host}`, cause, message: cause instanceof Error ? cause.message : String(cause) }))
  )

/**
 * A real SSH connection to a remote filesystem.
 *
 *   const conn = SshConnection("ssh://root@example.com/tmp/test1")
 *   conn.open  → ContainersService with a container exposing remote readFile/writeFile
 *
 * The container's bindings can be wired into an Agent via `Agent.uses(...)` so the
 * agent reads and writes files on the remote host as if they were local.
 */
export const SshConnection = (
  uri: string,
  options: SshOptions = {}
): Connection => {
  const parts = parseSshUri(uri)
  const readFile = Op.read({
    name: "ssh.readFile",
    description: `读取远程主机上 ${parts.basePath} 目录中的一个 UTF-8 文本文件。相对路径解析到该目录下。`,
    input: Schema.Struct({ path: Schema.String }),
    output: Schema.String,
    execute: ({ path }) => withSftp(parts, options, (sftp) =>
      readRemoteFile(sftp, joinPath(parts.basePath, path))
    ).pipe(Effect.mapError((cause) => new Error(cause instanceof Error ? cause.message : String(cause))))
  })

  const writeFile = Op.write({
    name: "ssh.writeFile",
    description: `在远程主机上 ${parts.basePath} 目录中写入一个 UTF-8 文本文件（自动创建父目录）。相对路径解析到该目录下。`,
    input: Schema.Struct({ path: Schema.String, content: Schema.String }),
    output: Schema.String,
    execute: ({ path, content }) => withSftp(parts, options, (sftp) =>
      writeRemoteFile(sftp, joinPath(parts.basePath, path), content).then(() => `written: ${path}`)
    ).pipe(Effect.mapError((cause) => new Error(cause instanceof Error ? cause.message : String(cause))))
  })

  const binding = {
    uri: Uri.make("ssh", "filesystem", `${parts.host}:${parts.basePath}`),
    ops: [readFile, writeFile]
  }
  const container = makeContainer(binding.uri, [binding])
  const containers = makeContainers([container])

  return {
    uri,
    open: Effect.succeed(containers),
    request: (request: RemoteRequest): Effect.Effect<RemoteResponse, ConnectionError, never> =>
      withSftp(parts, options, async (sftp) => {
        const { method, params } = request
        const p = params as Readonly<Record<string, unknown>>
        const path = typeof p?.path === "string" ? p.path : ""
        const target = joinPath(parts.basePath, path)
        if (method === "readFile") return { value: await readRemoteFile(sftp, target) }
        if (method === "writeFile") {
          const content = typeof p?.content === "string" ? p.content : ""
          await writeRemoteFile(sftp, target, content)
          return { value: `written: ${path}` }
        }
        return { value: null }
      }),
    events: []
  }
}
