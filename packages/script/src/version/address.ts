/**
 * version/address.ts - CONTENT ADDRESSING.
 *
 * Concept: versioning = content addressing (git-like). hash = SHA-256 of the
 * canonical content + the dep hashes, so tool@hash automatically locks the
 * whole dependency closure: declaring a hash as a strong dependency equals
 * declaring "this exact version set of the tool + closure".
 */
import { createHash } from "node:crypto"
import type { ToolDef } from "../model/tool.ts"

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
