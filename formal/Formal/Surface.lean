/-
  An app's tool surface, and how two of them are adjudicated —
  `packages/effect-apps/src/registration/surface.ts`.

  The file decides whether replacing one generation of an app by another is
  allowed. Both of its rules fail silently when they are wrong: the upgrade reads
  as compatible and the callers of a tool nobody serves any more find out at call
  time, one 404 at a time.

  **A tool that disappears is a removal.** The loop pairs the tools both
  generations serve and adjudicates each pair; the sweep then reports what is left
  of the old surface. That the two halves partition the old surface — nothing is
  both adjudicated and swept, and nothing that was dropped goes unswept — is
  `every_tool_gets_one_verdict`. Leave the sweep out and the tool that disappeared
  is not looked at at all:
  `dropping_the_removal_sweep_lets_an_upgrade_that_loses_a_tool_pass`.

  **Additions are not a violation.** Nothing that could already call the app breaks
  because a new tool appeared, so a name only the new generation serves reaches no
  verdict — `an_added_tool_is_not_a_verdict`.

  **Both sides come from the same place.** The surface is read back from the live
  registry rather than from the descriptor, and "a generation is only comparable to
  another if both sides come from the same place". Compare the old registry against
  the new *descriptor* instead and a tool the new registry refused reads as
  present: `reading_the_descriptor_instead_of_the_registry_misses_a_dropped_tool`.

  Idealisation: a tool is its name, and the pairing is by name. What the shared
  adjudicator says about one paired tool is `Compat.lean`'s subject; this is the
  pairing and the sweep around it.
-/

namespace EffectApps

/-- An app's tool surface, as far as the adjudicator is concerned: the names it
serves. -/
abbrev Surface := List String

/-- What the adjudicator does with one tool name. `compared` is the shared
four-level adjudication, `removed` the schema-level violation the sweep reports,
and `ignored` is an addition — not a verdict at all, since nothing that could
already call the app breaks. -/
inductive Verdict where
  | compared
  | removed
  | ignored
deriving DecidableEq, Repr

/-- Which of the three a name gets: the pairing loop looks at what both surfaces
carry, and the sweep at what the old one carries alone. -/
def verdict (before after : Surface) (n : String) : Verdict :=
  if n ∈ before then (if n ∈ after then Verdict.compared else Verdict.removed)
  else Verdict.ignored

/-- The whole of the adjudicator's classification: every name of the old surface
is either adjudicated or swept, never both, and a name it did not carry is not
reached at all. The second conjunct is the one a dropped tool depends on — the map
the loop carries is left holding it, so the sweep is what reports it. -/
theorem every_tool_gets_one_verdict (before after : Surface) (n : String) :
    (verdict before after n = Verdict.compared ↔ n ∈ before ∧ n ∈ after) ∧
    (verdict before after n = Verdict.removed ↔ n ∈ before ∧ n ∉ after) ∧
    (verdict before after n = Verdict.ignored ↔ n ∉ before) := by
  by_cases hb : n ∈ before <;> by_cases ha : n ∈ after <;> simp [verdict, hb, ha]

/-- A tool the new generation no longer serves is a schema-level removal. -/
theorem a_dropped_tool_is_a_removal (before after : Surface) (n : String)
    (was : n ∈ before) (gone : n ∉ after) : verdict before after n = Verdict.removed := by
  simp [verdict, was, gone]

/-- A tool both generations serve is adjudicated, and the sweep does not also
report it removed: the map the loop carries has had it deleted. -/
theorem a_tool_both_generations_serve_is_adjudicated (before after : Surface) (n : String)
    (was : n ∈ before) (serves : n ∈ after) :
    verdict before after n = Verdict.compared ∧ verdict before after n ≠ Verdict.removed := by
  refine ⟨by simp [verdict, was, serves], ?_⟩
  simp [verdict, was, serves]

/-- An added tool reaches no verdict, so an upgrade that only adds is compatible
whatever the policy says. -/
theorem an_added_tool_is_not_a_verdict (before after : Surface) (n : String)
    (added : n ∉ before) :
    verdict before after n = Verdict.ignored ∧ verdict before after n ≠ Verdict.compared ∧
    verdict before after n ≠ Verdict.removed := by
  refine ⟨by simp [verdict, added], ?_, ?_⟩ <;> simp [verdict, added]

/-- The pairing loop without the sweep: only tools both generations serve are
looked at, and a tool that disappeared is not looked at at all. -/
def verdictWithoutTheSweep (before after : Surface) (n : String) : Verdict :=
  if n ∈ before then (if n ∈ after then Verdict.compared else Verdict.ignored)
  else Verdict.ignored

/-- The control, on one upgrade. The old generation served `deploy` and the new one
does not; the sweep reports it and the pairing loop alone does not, so without the
sweep the report comes back compatible and every caller of `deploy` is broken by an
upgrade the adjudicator passed. -/
theorem dropping_the_removal_sweep_lets_an_upgrade_that_loses_a_tool_pass :
    verdictWithoutTheSweep ["build", "deploy"] ["build"] "deploy" = Verdict.ignored ∧
    verdict ["build", "deploy"] ["build"] "deploy" = Verdict.removed := by
  decide

/-- One generation of an app as the adjudicator can see it: what its descriptor
says it exposes, and what the live registry actually serves. A tool can be said and
not served — the registry refused the name — or served and not said. -/
structure Revision where
  said : Surface
  served : Surface
deriving DecidableEq, Repr

/-- The generation before the swap: it served what it said. -/
def beforeSwap : Revision := { said := ["build", "deploy"], served := ["build", "deploy"] }

/-- The generation after: it still declares `deploy`, but the registry refused the
name, so nothing serves it. -/
def afterSwap : Revision := { said := ["build", "deploy"], served := ["build"] }

/-- Why both sides have to come from the same place. Read back from the registries,
the swap is a removal and the policy gets to rule on it; read against the new
descriptor, `deploy` is compared with itself and reported unchanged — the one
answer that is wrong, and the one nothing contradicts. -/
theorem reading_the_descriptor_instead_of_the_registry_misses_a_dropped_tool :
    verdict beforeSwap.served afterSwap.served "deploy" = Verdict.removed ∧
    verdict beforeSwap.served afterSwap.said "deploy" = Verdict.compared := by
  decide

end EffectApps
