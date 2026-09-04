/**
 * app-board: a multi-agent task board (gitlab-workitem style) on top of
 * effect-agent's bottom abstractions.
 *
 *   layers:
 *     ① domain   - work items, resources, executors, views, state machine
 *     ② store    - Ref-backed tables (+ optional JSON snapshot persistence)
 *        governor - all-or-nothing resource claims, priority/fifo wake
 *     ③ builtin  - coordinator agent (breaks a goal into board subtasks)
 *     ④ MCP     - board_* tools over stdio (or in-process for the web host)
 *     ⑤ web     - browser panel; the panel is an MCP client (HTTP shell)
 */
export { makeBoard, type BoardApi, type BoardOptions, type BoardSnapshot } from "./board.ts"
export { makeTables, persist, type Tables } from "./store.ts"
export { ResourceGovernor, type Holdings, type WaitEntry, type Priority } from "./governor.ts"
export { EventBus, type BoardEvent, type BoardEventType } from "./events.ts"
export {
  canTransition, TRANSITIONS, WORK_ITEM_STATES,
  type BoardView, type Concurrency, type Executor, type Priority as DomainPriority,
  type Resource, type ResourceClaim, type ResourceKind, type Transition,
  type ViewColumn, type WorkItem, type WorkItemState
} from "./domain.ts"
export { makeCoordinator, coordinate, CoordinatorReply, type Coordinator, type CoordinatorReplyType } from "./coordinator.ts"
export { buildBoardModel } from "./model.ts"
