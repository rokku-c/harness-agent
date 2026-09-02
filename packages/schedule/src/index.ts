/**
 * @effect-agent/schedule — L4 scheduling layer
 *
 * Timers/reminders/autonomous triggers (Trigger data + Scheduler service).
 * The default implementation is an in-process timer (stops when its scope
 * closes); an external cron/queue can implement the same service.
 */
export * from "./scheduler.ts"
