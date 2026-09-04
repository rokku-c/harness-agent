/**
 * version/store.ts - the VERSION STORE and ref resolution.
 *
 * Concept: tool -> a version chain ordered by revision (parent points to the
 * previous version's hash). Commit appends; resolve turns a Ref (latest/
 * revision/hash/range) into the concrete Version it names; range matching
 * is skeleton semver (leading major/minor).
 */
import type { Ref, Version } from "../model/version-refs.ts"
import type { ToolDef } from "../model/tool.ts"
import { hashVersion } from "./address.ts"

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

  /** Resolve a version reference: latest / revision / hash (exact) / range (weak dep). */
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

  /** ^1.2 / >=1 - compatible range matching (skeleton: leading major/minor). */
  private matchRange(tool: string, spec: string): Version | undefined {
    const match = spec.match(/^[\^>=]*\s*(\d+)(?:\.(\d+))?/)
    const major = match !== null ? Number(match[1]) : undefined
    const minor = match !== null && match[2] !== undefined ? Number(match[2]) : undefined
    if (major === undefined) return this.head(tool)
    const caret = spec.startsWith("^")
    const candidates = [...this.versions(tool)].reverse()
    const found = candidates.find((version) => {
      const semver = version.content.semver
      if (semver === undefined) return false
      const match = semver.match(/^(\d+)(?:\.(\d+))?/)
      if (match === null) return false
      const vMajor = Number(match[1])
      const vMinor = match[2] !== undefined ? Number(match[2]) : 0
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
