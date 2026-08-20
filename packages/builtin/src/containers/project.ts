import { Data, Effect, Schema } from "effect"
import { execFile } from "node:child_process"
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import { dirname, relative, resolve, sep } from "node:path"
import { Op, Uri, type Binding } from "@effect-agent/core"

export class ProjectEnvironmentError extends Data.TaggedError("ProjectEnvironmentError")<{
  readonly operation: string
  readonly cause: unknown
}> {}

export interface ProjectEnvironmentOptions {
  readonly root: string
  readonly scope?: string
  readonly write?: boolean
  readonly maxFileBytes?: number
  readonly maxFiles?: number
}

const command = (file: string, args: ReadonlyArray<string>, cwd: string) =>
  Effect.async<string, ProjectEnvironmentError>((resume) => {
    const child = execFile(file, [...args], { cwd, timeout: 60_000 }, (error, stdout, stderr) =>
      error
        ? resume(Effect.fail(new ProjectEnvironmentError({ operation: `${file} ${args.join(" ")}`, cause: stderr || error })))
        : resume(Effect.succeed(stdout || stderr)))
    return Effect.sync(() => child.kill())
  })

/** A scoped project resource. Local filesystem and process details stay behind Binding Ops. */
export const ProjectEnvironment = {
  make: (options: ProjectEnvironmentOptions): Binding<never, ProjectEnvironmentError> => {
    const root = resolve(options.root)
    const scope = resolve(root, options.scope ?? ".")
    const maxFileBytes = options.maxFileBytes ?? 256 * 1024
    const maxFiles = options.maxFiles ?? 250

    const targetOf = (path: string) => Effect.try({
      try: () => {
        const target = resolve(scope, path)
        if (target !== scope && !target.startsWith(scope + sep)) throw new Error(`Path escapes project scope: ${path}`)
        return target
      },
      catch: (cause) => new ProjectEnvironmentError({ operation: "resolvePath", cause })
    })

    const Status = Op.read({
      name: "project.status",
      description: "Read the current git status and recent commits.",
      input: Schema.Struct({ scope: Schema.optional(Schema.String) }),
      output: Schema.Struct({ gitStatus: Schema.String, recentCommits: Schema.String }),
      execute: () => Effect.all({
        gitStatus: command("git", ["status", "--short"], root),
        recentCommits: command("git", ["log", "--oneline", "-8"], root)
      })
    })

    const ListFiles = Op.read({
      name: "project.listFiles",
      description: "List files inside the granted project scope.",
      input: Schema.Struct({ scope: Schema.optional(Schema.String) }),
      output: Schema.Array(Schema.String),
      execute: () => Effect.tryPromise({
        try: () => readdir(scope, { recursive: true, withFileTypes: true }),
        catch: (cause) => new ProjectEnvironmentError({ operation: "listFiles", cause })
      }).pipe(Effect.map((entries) => entries
        .filter((entry) => entry.isFile())
        .map((entry) => relative(scope, resolve(entry.parentPath, entry.name)))
        .filter((path) => !path.split(sep).some((part) => part === ".git" || part === "node_modules" || part === "dist"))
        .sort()
        .slice(0, maxFiles)))
    })

    const ReadFile = Op.read({
      name: "project.readFile",
      description: `Read one UTF-8 file inside the granted project scope (maximum ${maxFileBytes} bytes).`,
      input: Schema.Struct({ path: Schema.String }),
      output: Schema.String,
      execute: ({ path }) => targetOf(path).pipe(
        Effect.flatMap((target) => Effect.tryPromise({
          try: () => stat(target),
          catch: (cause) => new ProjectEnvironmentError({ operation: "stat", cause })
        }).pipe(Effect.flatMap((info) => info.isFile() && info.size <= maxFileBytes
          ? Effect.tryPromise({
              try: () => readFile(target, "utf8"),
              catch: (cause) => new ProjectEnvironmentError({ operation: "readFile", cause })
            })
          : Effect.fail(new ProjectEnvironmentError({ operation: "readFile", cause: `Invalid file or file too large: ${path}` })))))
      )
    })

    const RunCheck = Op.read({
      name: "project.runCheck",
      description: "Run one of the project's fixed verification commands.",
      input: Schema.Struct({ check: Schema.Literal("typecheck", "test") }),
      output: Schema.String,
      execute: ({ check }) => check === "typecheck"
        ? command("bun", ["run", "typecheck"], root)
        : command("bun", ["test"], root)
    })

    const WriteFile = Op.write({
      name: "project.writeFile",
      description: "Write one UTF-8 file inside the granted project scope.",
      input: Schema.Struct({ path: Schema.String, content: Schema.String }),
      output: Schema.String,
      execute: ({ path, content }) => targetOf(path).pipe(
        Effect.flatMap((target) => Effect.tryPromise({
          try: () => mkdir(dirname(target), { recursive: true }),
          catch: (cause) => new ProjectEnvironmentError({ operation: "mkdir", cause })
        }).pipe(Effect.flatMap(() => Effect.tryPromise({
          try: () => writeFile(target, content, "utf8"),
          catch: (cause) => new ProjectEnvironmentError({ operation: "writeFile", cause })
        })))),
        Effect.as(path)
      )
    })

    return {
      uri: Uri.make("local", "project", options.scope ?? "."),
      ops: [Status, ListFiles, ReadFile, RunCheck, ...(options.write ? [WriteFile] : [])]
    }
  }
}
