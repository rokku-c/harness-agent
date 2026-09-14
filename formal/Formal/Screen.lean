set_option linter.unusedVariables false

namespace EffectUi

structure Screen where
  id : String
  parent : Option String
deriving DecidableEq, Repr

def rootId : String := "root"

def next (s : Screen) : Option String :=
  match s.parent with
  | some p => some p
  | none => if s.id = rootId then none else some rootId

def ids (screens : List Screen) : List String := screens.map (·.id)

def walk (remaining : List Screen) (cursor : String) : List Screen :=
  match h : remaining.find? (fun s => s.id = cursor) with
  | none => []
  | some s =>
    match next s with
    | none => [s]
    | some c => s :: walk (remaining.erase s) c
termination_by remaining.length
decreasing_by
  simp_wf
  have hmem : s ∈ remaining := List.mem_of_find?_eq_some h
  have hpos : 0 < remaining.length := List.length_pos_of_mem hmem
  have hlen : (remaining.erase s).length = remaining.length - 1 := List.length_erase_of_mem hmem
  omega

def chainOf (screens : List Screen) (id : String) : List Screen := (walk screens id).reverse


theorem walk_eq_nil {l : List Screen} {c : String} (h : l.find? (fun s => s.id = c) = none) :
    walk l c = [] := by
  rw [walk.eq_def]
  split
  · rfl
  · simp_all

theorem walk_eq_singleton {l : List Screen} {c : String} {s : Screen}
    (h : l.find? (fun x => x.id = c) = some s) (hn : next s = none) : walk l c = [s] := by
  rw [walk.eq_def]
  split <;> simp_all

theorem walk_eq_cons {l : List Screen} {c : String} {s : Screen} {c' : String}
    (h : l.find? (fun x => x.id = c) = some s) (hc : next s = some c') :
    walk l c = s :: walk (l.erase s) c' := by
  rw [walk.eq_def]
  split <;> simp_all


theorem walk_found_id {l : List Screen} {c : String} {t : Screen}
    (h : l.find? (fun s => s.id = c) = some t) : t.id = c := by
  simpa using List.find?_some h

theorem walk_head {l : List Screen} {c : String} {t : Screen}
    (h : l.find? (fun s => s.id = c) = some t) : ∃ rest, walk l c = t :: rest := by
  match ht : next t with
  | none => exact ⟨[], walk_eq_singleton h ht⟩
  | some c' => exact ⟨_, walk_eq_cons h ht⟩

theorem walk_eq_nil_iff {l : List Screen} {c : String} :
    walk l c = [] ↔ l.find? (fun s => s.id = c) = none := by
  refine ⟨fun h => ?_, walk_eq_nil⟩
  rcases hf : l.find? (fun s => s.id = c) with _ | t
  · exact hf
  · obtain ⟨rest, hw⟩ := walk_head hf
    rw [h] at hw
    simp at hw


theorem mem_walk : ∀ (l : List Screen) (c : String), ∀ s : Screen, s ∈ walk l c → s ∈ l := by
  intro l c
  refine walk.induct (motive := fun l c => ∀ s : Screen, s ∈ walk l c → s ∈ l) ?_ ?_ ?_ l c
  · intro l c hf s hs
    rw [walk_eq_nil hf] at hs
    exact absurd hs (by simp)
  · intro l c t hf _ s hs
    rw [walk_eq_singleton hf (by assumption)] at hs
    rw [List.mem_singleton] at hs
    rw [hs]
    exact List.mem_of_find?_eq_some hf
  · intro l c t hf c' hc ih s hs
    rw [walk_eq_cons hf hc] at hs
    rcases List.mem_cons.mp hs with rfl | hs
    · exact List.mem_of_find?_eq_some hf
    · exact List.mem_of_mem_erase (ih s hs)

theorem mem_chainOf {screens : List Screen} {id : String} {s : Screen}
    (hs : s ∈ chainOf screens id) : s ∈ screens :=
  mem_walk screens id s (List.mem_reverse.mp hs)


theorem walk_link : ∀ (l : List Screen) (c : String), ∀ (a b : Screen) (rest : List Screen),
    walk l c = a :: b :: rest → next a = some b.id := by
  intro l c
  refine walk.induct
    (motive := fun l c => ∀ (a b : Screen) (rest : List Screen),
      walk l c = a :: b :: rest → next a = some b.id) ?_ ?_ ?_ l c
  · intro l c hf a b rest h
    rw [walk_eq_nil hf] at h
    simp at h
  · intro l c t hf hn a b rest h
    rw [walk_eq_singleton hf hn] at h
    simp at h
  · intro l c t hf c' hc _ a b rest h
    rw [walk_eq_cons hf hc] at h
    obtain ⟨hsa, h2⟩ := List.cons.inj h
    subst hsa
    have hne : (l.erase t).find? (fun x => x.id = c') ≠ none := by
      intro hnone
      rw [walk_eq_nil hnone] at h2
      simp at h2
    rcases hsome : (l.erase t).find? (fun x => x.id = c') with _ | u
    · exact absurd hsome hne
    · obtain ⟨rest', hrest'⟩ := walk_head hsome
      rw [hrest'] at h2
      obtain ⟨hut, -⟩ := List.cons.inj h2
      rw [← hut, walk_found_id hsome, hc]

end EffectUi
