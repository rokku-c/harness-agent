import type { Model } from "@effect-agent/model"
import type { StoreService } from "@effect-agent/state"
import type { EventLogService } from "@effect-agent/state"
import type { MemoryService } from "@effect-agent/memory"
import type { MemoryChannel } from "@effect-agent/channel"
import type { ToolRegistryService } from "@effect-agent/tools"
import type { GateService } from "@effect-agent/gate"
import type { SchedulerService } from "@effect-agent/schedule"

export interface AssembleOptions {
  readonly database?: string
  readonly model?: Model
  readonly store?: StoreService
  readonly eventLog?: EventLogService
  readonly memory?: MemoryService
  readonly channel?: MemoryChannel
  readonly registry?: ToolRegistryService
  readonly gate?: GateService
  readonly scheduler?: SchedulerService
}

export interface DriverOptions {
  readonly instructions?: string
  readonly maxSteps?: number
}
