import { AgentContext, type Content } from "./core.js"

/**
 * An immutable, JSON-serializable snapshot of an AgentContext's ordered
 * entries. Snapshots are pure observations (Context -> structured value):
 * run position, binding commits and driver sessions are NOT captured -
 * fromSnapshot is a value rebuild, never a resume. Consumers who want to
 * resume a run compose it from the existing resume surfaces themselves
 * (codex resume passthrough, IR recompilation).
 *
 * `version` is the seam for Content-union growth (#13/#16, P12 Signal): when
 * Content gains a member, version bumps and consumers can branch. Subsets are
 * consumer-side projections (YAGNI - not modeled here).
 */
export interface ContextSnapshot {
  readonly version: 1
  readonly entries: ReadonlyArray<Content>
}

/**
 * Pure observation: projects the context's ordered entries into a snapshot.
 * The slice gives an immutable projection - mutating the snapshot array never
 * touches the source context. The primary shape is the structured entries
 * array, not a JSON round-trip string (JSON serializability is a documented
 * contract - Content values serialize by construction - but not the default
 * form; the JSON round-trip property is exercised by tests).
 */
export const snapshotContext = (context: AgentContext): ContextSnapshot => ({
  version: 1,
  entries: context.entries.slice()
})

/**
 * Pure value rebuild (deliberately NOT named restore/resume - no continuation
 * semantics): constructs a fresh AgentContext from the snapshot entries. Run
 * position, binding commits and driver sessions are not included, so the
 * rebuilt context is a value, not a resumed run.
 */
export const fromSnapshot = (snapshot: ContextSnapshot): AgentContext =>
  new AgentContext(snapshot.entries)
