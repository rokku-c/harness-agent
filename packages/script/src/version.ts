/**
 * Versioning = content addressing (git-like).
 * hash = SHA-256(canonical content + dep hashes) ⟹ tool@hash automatically locks the
 * versions of the whole dependency closure. Declaring a hash as a strong dependency is
 * equivalent to declaring "the exact version set of the tool + its dependency closure".
 */
import { createHash } from "node:crypto"
import type { Ref, ToolDef, Version } from "./types.ts"

/** Canonical tool content (deps sorted by name; dep hashes participate in addressing). */
export const canonical = (content: ToolDef, depHashes: Readonly<Record<string, string>>): string =>
  JSON.stringify({
    name: content.name,
    description: content.description,
    semver: content.semver ?? null,
    input: content.input,
    output: content.output,
    deps: [...content.deps].sort().map((dep) => [dep, depHashes[dep] ?? null]),
    impl: content.impl,
    compat: content.compat ?? null,
    behavior: content.behavior ?? null
  })

export const hashVersion = (
  content: ToolDef,
  depHashes: Readonly<Record<string, string>>,
  parent?: string
): string =>
  createHash("sha256")
    .update(JSON.stringify({ content: canonical(content, depHashes), parent: parent ?? null }))
    .digest("hex")

const parseSemver = (semver: string | undefined): [number, number] | undefined => {
  if (semver === undefined) return undefined
  const match = semver.match(/^(\d+)(?:\.(\d+))?/)
  if (match === null) return undefined
  return [Number(match[1]), match[2] !== undefined ? Number(match[2]) : 0]
}

/** Version store: tool → a version chain ordered by revision (parent points to the previous version's hash). */
export class VersionStore {
  private readonly map = new Map<string, Version[]>()

  commit(
    tool: string,
    content: ToolDef,
    options: {
      readonly message: string
      readonly depHashes: Readonly<Record<string, string>>
      readonly hidden?: boolean
    }
  ): Version {
    const chain = this.map.get(tool) ?? []
    const parent = chain.at(-1)?.hash
    const hash = hashVersion(content, options.depHashes, parent)
    const version: Version = {
      tool,
      revision: chain.length + 1,
      hash,
      parent,
      message: options.message,
      content,
      createdAt: Date.now(),
      ...(options.hidden ? { hidden: true } : {})
    }
    this.map.set(tool, [...chain, version])
    return version
  }

  versions = (tool: string): ReadonlyArray<Version> => this.map.get(tool) ?? []
  head = (tool: string): Version | undefined => this.versions(tool).at(-1)
  byHash = (tool: string, hash: string): Version | undefined =>
    this.versions(tool).find((version) => version.hash === hash)
  byRevision = (tool: string, n: number): Version | undefined =>
    this.versions(tool).find((version) => version.revision === n)

  /** Resolve a version reference: latest / revision / hash (exact strong dep) / range (weak dep). */
  resolve = (tool: string, ref: Ref): Version | undefined => {
    switch (ref.kind) {
      case "latest":
        return this.head(tool)
      case "revision":
        return this.byRevision(tool, ref.n)
      case "hash":
        return this.byHash(tool, ref.hash)
      case "range":
        return this.matchRange(tool, ref.spec)
    }
  }

  /** ^1.2 / >=1 — compatible range matching (skeleton: parses leading major/minor). */
  private matchRange(tool: string, spec: string): Version | undefined {
    const match = spec.match(/^[\^>=]*\s*(\d+)(?:\.(\d+))?/)
    const major = match !== null ? Number(match[1]) : undefined
    const minor = match !== null && match[2] !== undefined ? Number(match[2]) : undefined
    if (major === undefined) return this.head(tool)
    const caret = spec.startsWith("^")
    const candidates = [...this.versions(tool)].reverse()
    const found = candidates.find((version) => {
      const parsed = parseSemver(version.content.semver)
      if (parsed === undefined) return false
      const [vMajor, vMinor] = parsed
      if (caret) return vMajor === major && (minor === undefined || vMinor >= minor)
      return vMajor >= major && (minor === undefined || vMinor >= minor)
    })
    return found ?? this.head(tool)
  }
}

/** Convert a ref into a displayable short label. */
export const refLabel = (ref: Ref): string => {
  switch (ref.kind) {
    case "latest": return "latest"
    case "revision": return "rev:" + ref.n
    case "hash": return ref.hash.slice(0, 10) + "…"
    case "range": return ref.spec
  }
}
