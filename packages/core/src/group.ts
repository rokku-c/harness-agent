import { Data, Effect } from "effect"
import type { AgentProgram, AgentError, Result } from "./core.js"
import type { Delivery, MessengerService } from "./messenger.js"

/**
 * Group / Organization —— 组织 agent 的范围。
 *
 *   Group        最小组织单元（装 agent 的集合）
 *   Organization 由多个 Group 组成，必须有一个 OfficeGroup
 *
 * 虚拟范围可重叠（一个 agent 可同时在多个 group）；不定义 group 就是单独 agent。
 * agent 是唯一可活动实体——group/org 只是组织范围，通信由成员 agent 执行。
 *
 * 见 DESIGN.md「Connection / Group / Messenger」。
 */

/** Group：最小组织单元，装 agent。 */
export interface Group<I = unknown, O = unknown, E = AgentError, R = never> {
  readonly id: string
  readonly agents: ReadonlyArray<AgentProgram<I, O, E, R>>
  /** 组的通信方式（可选）。 */
  readonly messenger?: MessengerService
}

export class GroupError extends Data.TaggedError("GroupError")<{
  readonly cause: unknown
  readonly group?: string
  readonly message?: string
}> {}

export const makeGroup = <I, O, E, R>(
  id: string,
  agents: ReadonlyArray<AgentProgram<I, O, E, R>> = [],
  messenger?: MessengerService
): Group<I, O, E, R> => ({ id, agents, ...(messenger ? { messenger } : {}) })

/** 组内广播结果：带 agent 标识。 */
export interface BroadcastResult<O> {
  readonly agent: string
  readonly result: Result<O>
}

/** 组内广播：把 delivery 投递给所有成员 agent（应答模式）。 */
export const broadcast = <I, O, E, R>(
  group: Group<I, O, E, R>,
  delivery: Omit<Delivery<I>, "id" | "payload"> & { payload: I }
): Effect.Effect<ReadonlyArray<BroadcastResult<O>>, E | GroupError, R> =>
  Effect.forEach(group.agents, (agent) =>
    agent.run(delivery.payload).pipe(
      Effect.map((result) => ({ agent: agent.id, result })),
      Effect.mapError((cause) => new GroupError({ cause, group: group.id }))
    ), { concurrency: "unbounded" })

/** 组内点对点：投递给指定 agent。 */
export const sendTo = <I, O, E, R>(
  group: Group<I, O, E, R>,
  agentId: string,
  delivery: Omit<Delivery<I>, "id" | "payload"> & { payload: I }
): Effect.Effect<Result<O>, E | GroupError, R> => {
  const agent = group.agents.find((a) => a.id === agentId)
  if (!agent) return Effect.fail(new GroupError({ group: group.id, message: `Agent ${agentId} not in group` }))
  return agent.run(delivery.payload).pipe(
    Effect.mapError((cause) => new GroupError({ cause, group: group.id }))
  )
}

/**
 * Organization：由多个 Group 组成，必须有一个 OfficeGroup。
 * OfficeGroup 是组织的主 group / 默认挂载点。
 */
export interface Organization<I = unknown, O = unknown, E = AgentError, R = never> {
  readonly id: string
  readonly groups: ReadonlyArray<Group<I, O, E, R>>
  /** 必须存在的 OfficeGroup（默认挂载点）。 */
  readonly officeGroup: Group<I, O, E, R>
}

export class OrganizationError extends Data.TaggedError("OrganizationError")<{
  readonly cause: unknown
  readonly org?: string
  readonly message?: string
}> {}

export const makeOrganization = <I, O, E, R>(
  id: string,
  groups: ReadonlyArray<Group<I, O, E, R>>,
  officeGroup: Group<I, O, E, R>
): Organization<I, O, E, R> => ({ id, groups: [...groups, officeGroup], officeGroup })

/** 组织的全部成员 agent（跨所有 group，去重）。 */
export const membersOf = <I, O, E, R>(org: Organization<I, O, E, R>): ReadonlyArray<AgentProgram<I, O, E, R>> =>
  [...new Set(org.groups.flatMap((group) => group.agents))]
