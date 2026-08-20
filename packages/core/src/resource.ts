import { Schema } from "effect"
import { makeContainer, type Container } from "./core.js"

/**
 * Resource —— 可访问/可协作的东西（抽象）。
 *
 * 资源语义与物理位置分离（本地目录 / SSH / 远程 API 同一 Resource）。
 * 实现上是一种特殊 Container：管理工具就是一组 ops。
 *
 * Mgmt（ResourceMgmt 等管理容器）在 @effect-agent/builtin/containers/mgmt。
 *
 * 见 DESIGN.md「Resource」。
 */

/** 注入形式：资源进入 agent 的方式。 */
export type ResourceInjection = "direct" | "auto" | "managed"

/** 帧视图：工具结果在上下文留几帧。inf = append-only（cache 友好）。 */
export type FrameView = 1 | 2 | "inf"

/** 资源边界：封闭 = 拥有/可锁/状态可枚举；开放 = 引用/不可锁/状态不可枚举。 */
export type ResourceBoundary = "closed" | "open"

/** 租约：谁在用 + 过期（不是所有权，是占用声明）。 */
export interface Lease {
  readonly holder?: string
  readonly expiresAt?: string
}

/** 资源声明。 */
export interface Resource {
  readonly uri: string
  /** 实现 = 特殊 Container（管理工具就是一组 ops）。缺省为空容器。 */
  readonly container: Container
  /** 注入形式。 */
  readonly injection: ResourceInjection
  /** 帧视图：工具结果留几帧。 */
  readonly frameView: FrameView
  /** 租约：当前占用者 + 过期。 */
  readonly lease?: Lease
  /** 边界：决定影响强弱（封闭→强影响，开放→弱影响）。缺省 closed。 */
  readonly boundary: ResourceBoundary
}

export const makeResource = (spec: {
  readonly uri: string
  readonly container?: Container
  readonly injection: ResourceInjection
  readonly frameView: FrameView
  readonly lease?: Lease
  readonly boundary?: ResourceBoundary
}): Resource => ({
  uri: spec.uri,
  container: spec.container ?? makeContainer(spec.uri, []),
  injection: spec.injection,
  frameView: spec.frameView,
  ...(spec.lease ? { lease: spec.lease } : {}),
  boundary: spec.boundary ?? "closed",
})

/* ── 资源 Schema（序列化契约） ── */

export const ResourceInjectionSchema = Schema.Literal("direct", "auto", "managed")
export const FrameViewSchema = Schema.Union(Schema.Literal(1, 2), Schema.Literal("inf"))
export const ResourceBoundarySchema = Schema.Literal("closed", "open")

export const LeaseSchema = Schema.Struct({
  holder: Schema.optional(Schema.String),
  expiresAt: Schema.optional(Schema.String),
})

export const ResourceSchema = Schema.Struct({
  uri: Schema.String,
  injection: ResourceInjectionSchema,
  frameView: FrameViewSchema,
  lease: Schema.optional(LeaseSchema),
  boundary: ResourceBoundarySchema,
})
