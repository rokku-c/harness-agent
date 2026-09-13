/**
 * Compatibility = graded adjudication (schema / deps / description / behavior
 * × strict / warn / ignore).
 *
 * Moved to @effect-agent/effect-compat — the script sandbox is no longer the
 * owner of the model, it is one user of it (apps and the kernel adjudicate with
 * the same functions). Re-exported here to keep this package's surface stable.
 *
 * See docs/script-sandbox.md §4/§5 and docs/architecture-rework.md §5.
 */
export {
  assessChange,
  assessRollback,
  assessUpgrade,
  schemaChanged,
  type AssessableTool,
  type UpgradeReport,
  type VersionLike,
  type Violation,
} from "@effect-agent/effect-compat"
