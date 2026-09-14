import { join } from "node:path"
import {
  bundleRefId, fromWire, validateNodeDeployment, type BundleArtifact, type NodeAdapterPlan, type NodeDeployment,
} from "@effect-agent/agentd"
import { writeArtifactDir } from "./stage-write.ts"
import type { NodeControl } from "./transport.ts"

export interface StagingOptions {
  readonly root: string
  readonly control: NodeControl
}

export interface StagedArtifact {
  readonly id: string
  readonly dir: string
  readonly digest: string
  readonly files: number
}

export interface StagedDeployment {
  readonly deployment: NodeDeployment
  readonly staged: readonly StagedArtifact[]
}

export const stagingApply = (options: StagingOptions) =>
  async (plan: NodeAdapterPlan): Promise<StagedDeployment> => {
    const wanted: readonly BundleArtifact[] = [
      ...(plan.desired.kernel === undefined ? [] : [plan.desired.kernel]),
      ...plan.desired.apps,
    ]
    const verified = await Promise.all(wanted.map(async (artifact) => {
      const id = bundleRefId(artifact)
      const decoded = fromWire(await options.control.artifact(id))
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
