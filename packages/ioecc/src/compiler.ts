import type { ConnectionImpl } from "./concept.js"

/**
 * Compiler —— 任意 Agent 作 Driver。
 *
 * Driver 就是 Agent（五维度）。任何 Agent 天然可以作为另一个 agent 的 driver，
 * 无需包装（gen 直接接收 drivers 数组）。
 * 这里保留 ConnectionImpl 的类型（外围提供 Connection 实现）。
 */

export type { ConnectionImpl }
