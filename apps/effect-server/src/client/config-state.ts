import type { ConfigState } from "./config-api.ts"

/** Wording follows server state, never an optimistic client-side assumption. */
export function describeConfigState(state: Pick<ConfigState, "ok" | "pendingRestart" | "revision">) {
  const pending = state.pendingRestart
  return {
    tone: !state.ok ? "error" : pending ? "pending" : "active",
    label: !state.ok ? "配置错误" : pending ? "已保存 · 待重启 / 待应用" : "当前配置已生效",
    detail: pending ? "保存值尚未全部生效；可显式应用已保存配置，或在重启后生效。" : "重新读取会获取服务端持久化配置。",
    revision: state.revision === undefined ? "" : `revision ${state.revision}`,
    canApply: pending,
  }
}
