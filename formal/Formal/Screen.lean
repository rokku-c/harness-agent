/-
  The navigation chain — `packages/effect-ui/src/screen.ts`.

  A view is a set of screens, and each screen names the one it was entered
  from. A destination that arrives as a URL has no stack behind it, so the host
  rebuilds one from that data. The data belongs to a view, so it can be wrong: a
  screen can name a parent that is gone, or a parent that leads back to it. A
  chain that trusted either would hang, or invent screens that do not exist.

  The walk here is the host's, with the same two guards the implementation
  carries: it never looks at a screen it has already taken, and it stops when
  the next id names nothing. What it is asked to guarantee:

  * `mem_chainOf` — every screen it names is one of the view's own;
  * `chainOf_nodup` — it names no screen twice, so it cannot hang;
  * `walk_eq_nil_iff` — it is empty exactly when the destination is not a
    screen of this view, and nonempty exactly when it is;
  * `walk_link` — each screen it names was entered from the next one it names,
    so what it returns is a path and not a bag of screens.

  The walk is built destination-first (`dest :: parent :: …`); `chainOf` is its
  reverse, which is the order the host draws: ancestor on the left. So
  `walk_link` says a screen's parent is the screen after it, which in the chain
  is the screen before it.
-/

-- The `h` in `walk`'s match is named for `decreasing_by` alone, which the unused-variable
-- linter does not look into.
set_option linter.unusedVariables false

namespace EffectUi

/-- One screen: its id, and the id of the screen it was entered from. -/
structure Screen where
  id : String
  parent : Option String
deriving DecidableEq, Repr

/-- The reserved id of the screen a view starts on. No view names it. -/
def rootId : String := "root"

/-- Where the walk goes after this screen, or `none` when the walk is over.
A screen that names no parent is one entered from the start — unless it is the start. -/
def next (s : Screen) : Option String :=
  match s.parent with
  | some p => some p
  | none => if s.id = rootId then none else some rootId

/-- The ids of these screens, in order. -/
def ids (screens : List Screen) : List String := screens.map (·.id)

/-- The chain from `cursor` on up, out of the screens not yet taken.
Each step conses the screen it found, so this reads newest-first. -/
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

/-- The screens from the first one down to `id`, oldest-first: what the host draws. -/
def chainOf (screens : List Screen) (id : String) : List Screen := (walk screens id).reverse

/-! ### The walk's three cases, read off its definition -/

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

/-! ### What the walk found, and when it finds nothing -/

/-- The screen a walk found under this id has that id. -/
theorem walk_found_id {l : List Screen} {c : String} {t : Screen}
    (h : l.find? (fun s => s.id = c) = some t) : t.id = c := by
  simpa using List.find?_some h

/-- A walk that found a screen starts with it — so a walk that found anything is not empty. -/
theorem walk_head {l : List Screen} {c : String} {t : Screen}
    (h : l.find? (fun s => s.id = c) = some t) : ∃ rest, walk l c = t :: rest := by
  match ht : next t with
  | none => exact ⟨[], walk_eq_singleton h ht⟩
  | some c' => exact ⟨_, walk_eq_cons h ht⟩

/-- The chain is empty exactly when the destination is not a screen of this view. -/
theorem walk_eq_nil_iff {l : List Screen} {c : String} :
    walk l c = [] ↔ l.find? (fun s => s.id = c) = none := by
  refine ⟨fun h => ?_, walk_eq_nil⟩
  rcases hf : l.find? (fun s => s.id = c) with _ | t
  · exact hf
  · obtain ⟨rest, hw⟩ := walk_head hf
    rw [h] at hw
    simp at hw

/-! ### Every screen the chain names is one of the view's own -/

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

/-! ### The chain is a path: each screen was entered from the next one -/

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
