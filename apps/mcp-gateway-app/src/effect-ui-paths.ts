import { NAV_ROOT } from "@effect-agent/effect-ui"

export const ACCESS_SCREEN = "access"
export const GRANTS_SCREEN = "grants"
export const PRINCIPALS_SCREEN = "principals"
export const TOPOLOGY_SCREEN = "topology"
export const AUDIT_SCREEN = "audit"

export const TOPOLOGY = "topology"
export const AUDIT = "audit"
export const IDENTITIES = "identities"
export const GATEWAY = "/gateway"
export const EVENTS = "/audit"
export const DIRECTORY = "/identities"

export const SERVERS = `${GATEWAY}/servers`
export const SETS = `${GATEWAY}/sets`
export const BINDINGS = `${GATEWAY}/bindings`
export const TOOLS = `${GATEWAY}/tools`
export const GRANTS_REVISION = `${GATEWAY}/revision`
export const RECORDS = `${EVENTS}/events`
export const PRINCIPALS = `${DIRECTORY}/principals`
export const TOKENS = `${DIRECTORY}/tokens`

export const AGENT = "/access/agent"
export const TOOL = "/access/tool"
export const ACCESS_RESULT = "/access/result"
export const DECISION = `${ACCESS_RESULT}/access`
export const FIXING = `${DECISION}/fixing`

export const DRAFT_KIND = "/issue/draft/kind"
export const DRAFT_ID = "/issue/draft/id"
export const DRAFT_NAME = "/issue/draft/name"
export const DRAFT_DAYS = "/issue/draft/days"
export const ISSUE_RESULT = "/issue/result"
export const ISSUE_DISMISSED = "/issue/dismissed"

export const PRINCIPAL_RESULT = "/principals/result"
export const REVOKE_RESULT = "/principals/revoked"

export const NAV_AGENT = `${NAV_ROOT}/agent`
export const NAV_TOOL = `${NAV_ROOT}/tool`
export const NAV_SERVER = `${NAV_ROOT}/serverId`
export const NAV_SET = `${NAV_ROOT}/setId`
export const NAV_LIST = `${NAV_ROOT}/list`
export const NAV_ENTRY = `${NAV_ROOT}/entry`
