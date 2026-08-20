/**
 * effect-agent — 统一入口。
 *
 * re-export 核心抽象与内置实现：
 *   @effect-agent/core    纯抽象（Agent/Stage/Until/Gate/Resource/...）
 *   @effect-agent/builtin 内置实现（providers/agents/containers/transports）
 */

export * from "@effect-agent/core"
export * from "@effect-agent/builtin"
