/**
 * What a node does with the bytes it is now able to fetch (§8.2, P6).
 *
 * `declarativeApply` says the node agrees to a deployment it already has. This
 * is the other half: it takes the deployment from the wire and puts the files
 * where a loader will find them, one directory per artifact — the shape the
 * kernel loader reads (`<dir>/kernel.js`) and `compileEffectBundle` writes.
 *
 * Both properties here are chosen against the same failure, a node running a
 * mixture of two builds and reporting success: everything is fetched and
 * verified before anything is written, and each directory is written by
 * `stage-write.ts`, which a reader never catches half-made.
 */

import { join } from "node:path"
import {
  bundleRefId, fromWire, validateNodeDeployment, type BundleArtifact, type NodeAdapterPlan, type NodeDeployment,
} from "@effect-agent/agentd"
import { writeArtifactDir } from "./stage-write.ts"
import type { NodeControl } from "./transport.ts"

export interface StagingOptions {
  /** Where artifacts are written. One subdirectory per artifact id. */
  readonly root: string
  readonly control: NodeControl
}

export interface StagedArtifact {
  readonly id: string
  readonly dir: string
  /** The digest the bytes were verified against on the way in. */
  readonly digest: string
  readonly files: number
}

/** What this node now runs, and where the bytes it runs came from. */
export interface StagedDeployment {
  readonly deployment: NodeDeployment
  readonly staged: readonly StagedArtifact[]
}

/**
 * An `apply` that installs the deployment instead of only agreeing to it.
 *
 * A failure here is thrown, not swallowed: `runCycle` receipts it with this
 * message and the loop keeps beating, because a stale source on the control
 * plane is cured by fixing the source, and a probe that halted on it would leave
 * a machine reporting a health nobody could act on.
 */
export const stagingApply = (options: StagingOptions) =>
  async (plan: NodeAdapterPlan): Promise<StagedDeployment> => {
    const wanted: readonly BundleArtifact[] = [
      ...(plan.desired.kernel === undefined ? [] : [plan.desired.kernel]),
      ...plan.desired.apps,
    ]
    const verified = await Promise.all(wanted.map(async (artifact) => {
      const id = bundleRefId(artifact)
      const decoded = fromWire(await options.control.artifact(id))
      // Filed under the name we asked for or not filed at all: a response that
      // answered a different question would put bytes under an id whose digest
      // was never the one checked.
      if (decoded.id !== id) throw new Error(`artifact fetch for ${id} answered with ${decoded.id}`)
      return { id, digest: decoded.digest, files: decoded.files }
    }))
    const staged = verified.map(({ id, digest, files }) => {
      const dir = join(options.root, `${id}.effect-bundle`)
      writeArtifactDir(dir, files)
      return { id, dir, digest, files: files.length }
    })
    return { deployment: validateNodeDeployment(plan.desired), staged }
  }
