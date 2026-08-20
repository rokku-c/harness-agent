import { Data, Effect, Schema } from "effect"
import { makeResource, type Resource, type ResourceBoundary, type ResourceInjection, type FrameView, type Lease } from "@effect-agent/core"

/**
 * Mgmt —— 管理容器。
 *
 * 能创建/管理 X 的东西，两个固定身份：是容器，也是资源。
 * 递归来自「Mgmt 是资源 → 能被资源管理器管理」。
 *
 * ResourceMgmt = 管理资源，能建虚拟资源（协作媒介：任务队列/黑板）。
 *
 * 见 DESIGN.md「Mgmt」。
 */

export type CreateMode = "readonly" | "writable"

/** ResourceMgmt = 管理资源的资源。是容器 + 资源两个身份。 */
export interface ResourceMgmt extends Resource {
  readonly createMode: CreateMode
  readonly create: (id: string, spec: Omit<Resource, "uri">) => Effect.Effect<Resource, ResourceMgmtError>
}

export class ResourceMgmtError extends Data.TaggedError("ResourceMgmtError")<{
  readonly cause: unknown
  readonly uri?: string
  readonly message?: string
}> {}

/** 递归判别：Resource = 普通资源 | ResourceMgmt。 */
export const isResourceMgmt = (resource: Resource): resource is ResourceMgmt =>
  "createMode" in resource && "create" in resource

/** 构造一个 ResourceMgmt（writable：能创建虚拟资源）。 */
export const makeResourceMgmt = (spec: {
  readonly uri: string
  readonly createMode?: CreateMode
  readonly injection?: ResourceInjection
  readonly frameView?: FrameView
  readonly lease?: Lease
  readonly boundary?: ResourceBoundary
}): ResourceMgmt => {
  const createMode = spec.createMode ?? "readonly"
  return {
    ...makeResource({ ...spec, injection: spec.injection ?? "auto", frameView: spec.frameView ?? "inf" }),
    createMode,
    create: (id, resourceSpec) =>
      createMode === "readonly"
        ? Effect.fail(new ResourceMgmtError({ cause: new Error("readonly"), uri: spec.uri, message: "ResourceMgmt is readonly" }))
        : Effect.succeed(makeResource({ uri: `${spec.uri}/${id}`, ...resourceSpec })),
  }
}

export const CreateModeSchema = Schema.Literal("readonly", "writable")
export const ResourceMgmtSchema = Schema.Struct({
  uri: Schema.String,
  injection: Schema.Literal("direct", "auto", "managed"),
  frameView: Schema.Union(Schema.Literal(1, 2), Schema.Literal("inf")),
  lease: Schema.optional(Schema.Struct({
    holder: Schema.optional(Schema.String),
    expiresAt: Schema.optional(Schema.String),
  })),
  boundary: Schema.Literal("closed", "open"),
  createMode: CreateModeSchema,
})
