export {
  cell, cellOf, emptyRows, field, heading, listCard, loadingRows, press, region, row, section, sourceStatusPath, text,
} from "@effect-agent/effect-ui"

export const AGENTS_SOURCE = "agents"
export const WORKSPACES_SOURCE = "workspaces"

export const rowsPath = (id: string): string => `/herdr/${id}/${id}`

export const navTarget = "/_nav/target"

export const draft = (name: "message" | "startName" | "startKind" | "startWorkspace"): string =>
  `/herdr/draft/${name}`

export const keySeq = (name: "escape" | "interrupt"): string => `/herdr/keys/${name}`

export const outcome = (action: string): string => `/herdr/result/${action.replace(/^herdr\./, "")}`
export const outcomeOk = (action: string): string => `${outcome(action)}/ok`
export const outcomeError = (action: string): string => `${outcome(action)}/error`

export const readField = (action: string, field: string): string => `${outcome(action)}/read/${field}`
