/**
 * One machine declaration, two strictnesses (§8.5-1), and why they differ.
 *
 * A config file is deliberate: omitting `capabilities` there is an operator
 * saying "none", and the schema fills it in. An announcement is what the push
 * side adjudicates every placement against, so filling in a missing field would
 * be the platform inventing a declaration and then refusing everything because
 * of the number it invented.
 */

import { expect, test } from "bun:test"
import { announcedMachine, machine } from "../src/machine-schema.ts"

const declared = { machineId: "m1", name: "c", status: "online" as const, capabilities: ["runtime:os"], namespaces: ["ops"] }

test("a config machine may leave unstated what a node has not said yet", () => {
  expect(machine.parse({ machineId: "m1", name: "Container" }))
    .toEqual({ machineId: "m1", name: "Container", status: "online", capabilities: [], namespaces: [], reportedAt: 0 })
})

test("a config machine carries nothing until it says otherwise", () => {
  // An allowlist with a permissive default would carry every domain on exactly
  // the nodes nobody thought about; empty refuses by name instead.
  expect(machine.parse({ machineId: "m1", name: "c" }).namespaces).toEqual([])
  expect(machine.parse({ ...declared, namespaces: ["ops", "workspace-b"] }).namespaces).toEqual(["ops", "workspace-b"])
})

test("a ceiling is never invented, in either shape", () => {
  // §11-Q17: no stated ceiling reads as *stated none*, which is a fact about the
  // node. A schema default of 0 would be the platform choosing a number.
  expect(machine.parse({ machineId: "m1", name: "c" }).maxApps).toBeUndefined()
  expect(announcedMachine.parse(declared).maxApps).toBeUndefined()
  // Zero is a declaration like any other: a node draining itself.
  expect(announcedMachine.parse({ ...declared, maxApps: 0 }).maxApps).toBe(0)
  expect(() => announcedMachine.parse({ ...declared, maxApps: -1 })).toThrow()
})

test("an announcement states everything it will be adjudicated against", () => {
  expect(announcedMachine.parse(declared)).toEqual(declared)
  for (const field of ["capabilities", "namespaces", "status"] as const) {
    const { [field]: _omitted, ...rest } = declared
    expect(() => announcedMachine.parse(rest)).toThrow(field)
  }
  // `reportedAt` is the server's observation of the node, not the node's claim
  // about itself, so a declaration carrying one is refused rather than ignored.
  expect(() => announcedMachine.parse({ ...declared, reportedAt: 1 })).toThrow()
})
