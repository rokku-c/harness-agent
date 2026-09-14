namespace EffectApps

abbrev Surface := List String

inductive Verdict where
  | compared
  | removed
  | ignored
deriving DecidableEq, Repr

def verdict (before after : Surface) (n : String) : Verdict :=
  if n ∈ before then (if n ∈ after then Verdict.compared else Verdict.removed)
  else Verdict.ignored

theorem every_tool_gets_one_verdict (before after : Surface) (n : String) :
    (verdict before after n = Verdict.compared ↔ n ∈ before ∧ n ∈ after) ∧
    (verdict before after n = Verdict.removed ↔ n ∈ before ∧ n ∉ after) ∧
    (verdict before after n = Verdict.ignored ↔ n ∉ before) := by
  by_cases hb : n ∈ before <;> by_cases ha : n ∈ after <;> simp [verdict, hb, ha]

theorem a_dropped_tool_is_a_removal (before after : Surface) (n : String)
    (was : n ∈ before) (gone : n ∉ after) : verdict before after n = Verdict.removed := by
  simp [verdict, was, gone]

theorem a_tool_both_generations_serve_is_adjudicated (before after : Surface) (n : String)
    (was : n ∈ before) (serves : n ∈ after) :
    verdict before after n = Verdict.compared ∧ verdict before after n ≠ Verdict.removed := by
  refine ⟨by simp [verdict, was, serves], ?_⟩
  simp [verdict, was, serves]

theorem an_added_tool_is_not_a_verdict (before after : Surface) (n : String)
    (added : n ∉ before) :
    verdict before after n = Verdict.ignored ∧ verdict before after n ≠ Verdict.compared ∧
    verdict before after n ≠ Verdict.removed := by
  refine ⟨by simp [verdict, added], ?_, ?_⟩ <;> simp [verdict, added]

def verdictWithoutTheSweep (before after : Surface) (n : String) : Verdict :=
  if n ∈ before then (if n ∈ after then Verdict.compared else Verdict.ignored)
  else Verdict.ignored

theorem dropping_the_removal_sweep_lets_an_upgrade_that_loses_a_tool_pass :
    verdictWithoutTheSweep ["build", "deploy"] ["build"] "deploy" = Verdict.ignored ∧
    verdict ["build", "deploy"] ["build"] "deploy" = Verdict.removed := by
  decide

structure Revision where
  said : Surface
  served : Surface
deriving DecidableEq, Repr

def beforeSwap : Revision := { said := ["build", "deploy"], served := ["build", "deploy"] }

def afterSwap : Revision := { said := ["build", "deploy"], served := ["build"] }

theorem reading_the_descriptor_instead_of_the_registry_misses_a_dropped_tool :
    verdict beforeSwap.served afterSwap.served "deploy" = Verdict.removed ∧
    verdict beforeSwap.served afterSwap.said "deploy" = Verdict.compared := by
  decide

end EffectApps
