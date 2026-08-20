/**
 * @effect-agent/builtin — 内置实现。
 *
 * 依赖 @effect-agent/core，提供具体 SDK 适配：
 *   providers/    native/effect/vercel（模型驱动）
 *   agents/       claude-code/codex/pi（ComposedAgent）
 *   containers/   project 环境
 *   transports/   ssh
 *   composed.ts   ComposedAgent
 *   predictive.ts PredictiveHarness
 */

export * from "./providers/index.js"
export * from "./agents/claude-code.js"
export * from "./agents/codex.js"
export * from "./agents/pi.js"
export * from "./containers/project.js"
export * from "./transports/ssh.js"
export * from "./composed.js"
export * from "./predictive.js"
