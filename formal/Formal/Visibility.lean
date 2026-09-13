/-
  VISIBILITY = DEPENDENCY CLOSURE — `packages/script/src/closure.ts`.

  The file's claim is an invariant: everything visible has its dependencies
  visible. Both modes named a set and stopped there — an allowlist expanded from
  its seed along deps, a denylist took the registry less what was excluded — and
  neither of those sets is closed. A seed can name a tool whose dependency the
  registry does not have, and an exclusion can cut a chain in half; the tool stays
  visible while the thing it calls does not, and the agent finds out at the call,
  with the tool set having read as valid throughout.

  `bound` is whatever set the mode names, and `Doomed` is what cannot stay: a
  name with a dependency the bound does not have, or a name that needs something
  already doomed. Visibility is the bound less the doomed, which is the greatest
  closed subset of it — so the two modes do converge, on the invariant rather
  than on the set, which is what the comment meant and did not say.

  The idealisation is the dependency function alone: a dependency that is out of
  the bound is out whether the registry never had it or the policy took it away,
  and the rule does not turn on which.
-/

namespace Visibility

/-- What a tool declares it needs. A name the registry lacks declares nothing. -/
abbrev Deps := Nat → List Nat

/--
A name the bound cannot keep. The least such set is what the loop in the file
walks to: it drops a tool whose dependency is outside the set, then drops what
that orphaned, until nothing more changes.
-/
inductive Doomed (deps : Deps) (bound : List Nat) : Nat → Prop
  | unmetDep {t d : Nat} : t ∈ bound → d ∈ deps t → d ∉ bound → Doomed deps bound t
  | needsDoomed {t d : Nat} : t ∈ bound → d ∈ deps t → Doomed deps bound d → Doomed deps bound t

/-- Visible: the bound names it and it is not doomed. -/
def Visible (deps : Deps) (bound : List Nat) (t : Nat) : Prop :=
  t ∈ bound ∧ ¬ Doomed deps bound t

/-- The invariant the file asserts: nothing visible needs anything invisible. -/
def Closed (deps : Deps) (v : Nat → Prop) : Prop :=
  ∀ t, v t → ∀ d, d ∈ deps t → v d

/--
The bug, as a witness: a mode names a bound and stops. This bound names tool 1,
which declares it needs tool 2, and 2 is not in the bound — so the set is not
closed, and an allowlist that seeded tool 1 reached exactly this.
-/
theorem a_bound_is_not_closed :
    ¬ Closed (fun t => if t = 1 then [2] else []) (fun t => t ∈ [1]) := by
  intro h
  have h2 : (2 : Nat) ∈ [1] := h 1 (by simp) 2 (by simp)
  exact absurd h2 (by decide)

/-- The same bound under the file's own reading: tool 1 is doomed, because the
    dependency it declares is a name the bound does not have. -/
theorem the_seed_is_doomed :
    Doomed (fun t => if t = 1 then [2] else []) [1] 1 :=
  Doomed.unmetDep (d := 2) (by simp) (by simp) (by simp)

/-- And so the tool the operator asked for is not visible. This is the cost of
    the fix, stated rather than left to be found: an allowlist that names a tool
    whose dependency is absent reaches nothing, which is what makes it agree with
    the denylist that would have taken that dependency away. -/
theorem the_orphan_is_not_visible :
    ¬ Visible (fun t => if t = 1 then [2] else []) [1] 1 :=
  fun h => h.2 the_seed_is_doomed

/--
The fix: what the bound keeps is closed. A visible tool's dependency is in the
bound — otherwise the tool would be doomed by the first rule — and is not itself
doomed, because the second rule would then make the tool doomed too.
-/
theorem the_visible_set_is_closed (deps : Deps) (bound : List Nat) (t d : Nat)
    (ht : Visible deps bound t) (hd : d ∈ deps t) : Visible deps bound d := by
  refine ⟨?_, ?_⟩
  · by_cases inside : d ∈ bound
    · exact inside
    · exact absurd (Doomed.unmetDep ht.1 hd inside) ht.2
  · intro doomed
    exact ht.2 (Doomed.needsDoomed ht.1 hd doomed)

/--
The claim both modes make, in one statement: whichever set a mode names, what it
ends up with is closed. This is the invariant the file's comment asserts, and the
reason closing is the operation the two modes share rather than a step only the
denylist takes.
-/
theorem both_modes_reach_the_same_invariant (deps : Deps) (allow denied : List Nat) :
    Closed deps (Visible deps allow) ∧ Closed deps (Visible deps denied) :=
  ⟨fun t ht d hd => the_visible_set_is_closed deps allow t d ht hd,
   fun t ht d hd => the_visible_set_is_closed deps denied t d ht hd⟩

/-- Closing only takes names away: nothing visible was outside the bound. -/
theorem closing_names_nothing_new (deps : Deps) (bound : List Nat) (t : Nat)
    (h : Visible deps bound t) : t ∈ bound :=
  h.1

/--
The control: no derivation dooms a tool when the bound holds every dependency of
its members. Without this, "nothing visible needs anything invisible" is satisfied
by a set that keeps too little, and the rule would be a collapse rather than a
closure. The bound each constructor carries is what the rule needs — a tool is
doomed by a dependency it declares, never by a dependency it might have had.
-/
theorem a_dependency_inside_the_bound_dooms_nothing (deps : Deps) (bound : List Nat)
    (hclosed : ∀ t, t ∈ bound → ∀ d, d ∈ deps t → d ∈ bound) (t : Nat) :
    ¬ Doomed deps bound t := by
  intro doomed
  induction doomed with
  | unmetDep htb hd hout => exact hout (hclosed _ htb _ hd)
  | needsDoomed _ _ _ ih => exact ih

/-- And the bound such a rule keeps is the whole bound: a set of tools that
    declare nothing loses nothing, so `Visible` is not the empty set wearing an
    invariant. -/
theorem a_bound_that_is_already_closed_keeps_what_it_names :
    Visible (fun _ => ([] : List Nat)) [1, 2] 1 ∧ Visible (fun _ => ([] : List Nat)) [1, 2] 2 := by
  have hclosed : ∀ t, t ∈ [1, 2] → ∀ d, d ∈ (fun _ => ([] : List Nat)) t → d ∈ [1, 2] := by
    intro _ _ d hd
    simp at hd
  exact ⟨⟨by simp, a_dependency_inside_the_bound_dooms_nothing _ _ hclosed 1⟩,
    ⟨by simp, a_dependency_inside_the_bound_dooms_nothing _ _ hclosed 2⟩⟩

/-- The other control: excluding a name takes everything that needed it along,
    which is the transitive removal the denylist mode documented and the reason
    the two modes now answer alike. -/
theorem an_excluded_dependency_takes_its_dependents_along :
    ¬ Visible (fun t => if t = 1 then [2] else []) [1] 1
      ∧ ¬ Visible (fun t => if t = 2 then [1] else []) [2] 2 :=
  ⟨the_orphan_is_not_visible,
    fun h => h.2 (Doomed.unmetDep (d := 1) (by simp) (by simp) (by simp))⟩

end Visibility
