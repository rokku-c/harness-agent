namespace Visibility

abbrev Deps := Nat → List Nat

inductive Doomed (deps : Deps) (bound : List Nat) : Nat → Prop
  | unmetDep {t d : Nat} : t ∈ bound → d ∈ deps t → d ∉ bound → Doomed deps bound t
  | needsDoomed {t d : Nat} : t ∈ bound → d ∈ deps t → Doomed deps bound d → Doomed deps bound t

def Visible (deps : Deps) (bound : List Nat) (t : Nat) : Prop :=
  t ∈ bound ∧ ¬ Doomed deps bound t

def Closed (deps : Deps) (v : Nat → Prop) : Prop :=
  ∀ t, v t → ∀ d, d ∈ deps t → v d

theorem a_bound_is_not_closed :
    ¬ Closed (fun t => if t = 1 then [2] else []) (fun t => t ∈ [1]) := by
  intro h
  have h2 : (2 : Nat) ∈ [1] := h 1 (by simp) 2 (by simp)
  exact absurd h2 (by decide)

theorem the_seed_is_doomed :
    Doomed (fun t => if t = 1 then [2] else []) [1] 1 :=
  Doomed.unmetDep (d := 2) (by simp) (by simp) (by simp)

theorem the_orphan_is_not_visible :
    ¬ Visible (fun t => if t = 1 then [2] else []) [1] 1 :=
  fun h => h.2 the_seed_is_doomed

theorem the_visible_set_is_closed (deps : Deps) (bound : List Nat) (t d : Nat)
    (ht : Visible deps bound t) (hd : d ∈ deps t) : Visible deps bound d := by
  refine ⟨?_, ?_⟩
  · by_cases inside : d ∈ bound
    · exact inside
    · exact absurd (Doomed.unmetDep ht.1 hd inside) ht.2
  · intro doomed
    exact ht.2 (Doomed.needsDoomed ht.1 hd doomed)

theorem both_modes_reach_the_same_invariant (deps : Deps) (allow denied : List Nat) :
    Closed deps (Visible deps allow) ∧ Closed deps (Visible deps denied) :=
  ⟨fun t ht d hd => the_visible_set_is_closed deps allow t d ht hd,
   fun t ht d hd => the_visible_set_is_closed deps denied t d ht hd⟩

theorem closing_names_nothing_new (deps : Deps) (bound : List Nat) (t : Nat)
    (h : Visible deps bound t) : t ∈ bound :=
  h.1

theorem a_dependency_inside_the_bound_dooms_nothing (deps : Deps) (bound : List Nat)
    (hclosed : ∀ t, t ∈ bound → ∀ d, d ∈ deps t → d ∈ bound) (t : Nat) :
    ¬ Doomed deps bound t := by
  intro doomed
  induction doomed with
  | unmetDep htb hd hout => exact hout (hclosed _ htb _ hd)
  | needsDoomed _ _ _ ih => exact ih

theorem a_bound_that_is_already_closed_keeps_what_it_names :
    Visible (fun _ => ([] : List Nat)) [1, 2] 1 ∧ Visible (fun _ => ([] : List Nat)) [1, 2] 2 := by
  have hclosed : ∀ t, t ∈ [1, 2] → ∀ d, d ∈ (fun _ => ([] : List Nat)) t → d ∈ [1, 2] := by
    intro _ _ d hd
    simp at hd
  exact ⟨⟨by simp, a_dependency_inside_the_bound_dooms_nothing _ _ hclosed 1⟩,
    ⟨by simp, a_dependency_inside_the_bound_dooms_nothing _ _ hclosed 2⟩⟩

theorem an_excluded_dependency_takes_its_dependents_along :
    ¬ Visible (fun t => if t = 1 then [2] else []) [1] 1
      ∧ ¬ Visible (fun t => if t = 2 then [1] else []) [2] 2 :=
  ⟨the_orphan_is_not_visible,
    fun h => h.2 (Doomed.unmetDep (d := 1) (by simp) (by simp) (by simp))⟩

end Visibility
