import type { ConnectionImpl, Driver } from "./concept.js"

/**
 * Compiler —— 任意 Agent 作 Driver（gen 已产出可运行程序，无需独立 compile 阶段）。
 *
 * gen（gen.ts）是唯一编译入口：driver 注入 + 描述收集 + 产出 Program。
 * 这里只保留「把编译后的 agent 包装成 Driver」的适配，供递归/组合。
 */

/**
 * 把一个编译后的 Agent 包装成 Driver，供其他 Agent 使用。
 * 递归：组合 agent 加适配器 = 新 Driver。被驱动 agent 的 input/output 可 unknown。
 */
export const agentDriver = (
  compiled: { drive: (index: number, input: unknown) => import("effect").Effect.Effect<unknown, Error> },
  options: { id?: string; observe?: ReadonlyMap<string, ConnectionImpl> } = {}
): Driver => ({
  id: options.id ?? "agent",
  run: (input) => compiled.drive(0, input),
  ...(options.observe ? { observe: options.observe } : {}),
})
