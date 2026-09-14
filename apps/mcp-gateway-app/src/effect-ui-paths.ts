/**
 * Every path this console reads or writes, named once.
 *
 * A path spelled twice — once by the declaration that fills it and once by the
 * node that reads it — is the failure this file exists to prevent: a node bound
 * to a path nothing writes draws an empty control and no error at all, so a
 * gateway with no sets on screen reads as a gateway with no sets rather than as
 * the typo it is.
 *
 * The two reserved roots belong to the runtime and are read through the
 * constants it exports (`screen.ts`, `source-status.ts`); nothing here re-spells
 * them. `identities` survives as the source's id and as the URL segment because
 * the flows name the read that way — every word a person reads says *principal*
 * (§1.7).
 */
import { NAV_ROOT } from "@effect-agent/effect-ui"

/** The screens this view declares, by the ids an address and a door name them with. */
export const ACCESS_SCREEN = "access"
export const PRINCIPALS_SCREEN = "principals"
export const TOPOLOGY_SCREEN = "topology"
export const AUDIT_SCREEN = "audit"

/** The three reads: the id a `refresh` names, and the state path the answer lands on. */
export const TOPOLOGY = "topology"
export const AUDIT = "audit"
export const IDENTITIES = "identities"
export const GATEWAY = "/gateway"
export const EVENTS = "/audit"
export const DIRECTORY = "/identities"

/** The lists inside those three answers, each read on its own. */
export const SERVERS = `${GATEWAY}/servers`
export const SETS = `${GATEWAY}/sets`
export const BINDINGS = `${GATEWAY}/bindings`
export const TOOLS = `${GATEWAY}/tools`
export const GRANTS_REVISION = `${GATEWAY}/revision`
export const RECORDS = `${EVENTS}/events`
export const PRINCIPALS = `${DIRECTORY}/principals`
export const TOKENS = `${DIRECTORY}/tokens`

/** The question, and the answer the gateway's own engine gives it. */
export const AGENT = "/access/agent"
export const TOOL = "/access/tool"
export const ACCESS_RESULT = "/access/result"
export const DECISION = `${ACCESS_RESULT}/access`

/** The issue form's draft, the revealed token, and the read that pays for giving it up. */
export const DRAFT_KIND = "/issue/draft/kind"
export const DRAFT_ID = "/issue/draft/id"
export const DRAFT_NAME = "/issue/draft/name"
export const DRAFT_DAYS = "/issue/draft/days"
export const ISSUE_RESULT = "/issue/result"
export const ISSUE_DISMISSED = "/issue/dismissed"

/**
 * What a press on a principal answered. One path for both directions of the
 * flag, because they are one operation and the row answers one question; and a
 * second path for a revocation, because §9.4 writes a refusal beside the control
 * that caused it and the two controls are in two different tables.
 */
export const PRINCIPAL_RESULT = "/principals/result"
export const REVOKE_RESULT = "/principals/revoked"

/**
 * An entered screen's parameters. A door carries the choice here, and the
 * screen's own read takes it from here — which is what makes a link pasted into
 * the address bar render the same answer as a press (`screen.ts`).
 */
export const NAV_AGENT = `${NAV_ROOT}/agent`
export const NAV_TOOL = `${NAV_ROOT}/tool`
export const NAV_SERVER = `${NAV_ROOT}/serverId`
