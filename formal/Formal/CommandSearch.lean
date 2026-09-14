open Classical

namespace CommandSearch

abbrev Text := List Char

abbrev Terms := List Text

def Infix (u v : Text) : Prop := ∃ p s : Text, v = p ++ u ++ s

theorem infix_refl (u : Text) : Infix u u := ⟨[], [], by simp⟩

theorem infix_trans {u v w : Text} (h₁ : Infix u v) (h₂ : Infix v w) : Infix u w := by
  obtain ⟨p₁, s₁, rfl⟩ := h₁
  obtain ⟨p₂, s₂, rfl⟩ := h₂
  exact ⟨p₂ ++ p₁, s₁ ++ s₂, by simp [List.append_assoc]⟩

structure Row where
  text : Text
  owner : Option String

def Matches (x : Text) (terms : Terms) : Prop := ∀ t ∈ terms, Infix t x

theorem matches_nil (x : Text) : Matches x [] := by simp [Matches]

theorem matches_cons {x : Text} {t : Text} {terms : Terms} (h : Matches x (t :: terms)) :
    Matches x terms := fun u hu => h u (List.mem_cons_of_mem t hu)

theorem not_matches_cons {x : Text} {t : Text} {terms : Terms} (h : ¬ Matches x terms) :
    ¬ Matches x (t :: terms) := fun hc => h (matches_cons hc)

def textOf (label caption address shortcut : Text) : Text :=
  label ++ caption ++ address ++ shortcut

theorem textOf_parts (label caption address shortcut : Text) :
    Infix label (textOf label caption address shortcut) ∧
    Infix caption (textOf label caption address shortcut) ∧
    Infix address (textOf label caption address shortcut) ∧
    Infix shortcut (textOf label caption address shortcut) := by
  refine ⟨⟨[], caption ++ address ++ shortcut, ?_⟩,
          ⟨label, address ++ shortcut, ?_⟩,
          ⟨label ++ caption, shortcut, ?_⟩,
          ⟨label ++ caption ++ address, [], ?_⟩⟩
  all_goals simp [textOf, List.append_assoc]

noncomputable def matching (rows : List Row) (terms : Terms) : List Row :=
  rows.filter (fun r => decide (Matches r.text terms))

def inScope (scope : String) (r : Row) : Bool := decide (r.owner = some scope)

theorem inScope_eq (scope : String) (r : Row) : (inScope scope r = true) ↔ r.owner = some scope := by
  by_cases h : r.owner = some scope <;> simp [inScope, h]

theorem not_inScope_eq (scope : String) (r : Row) :
    (Bool.not (inScope scope r) = true) ↔ r.owner ≠ some scope := by
  by_cases h : r.owner = some scope <;> simp [inScope, h]

noncomputable def filterCommands (rows : List Row) (terms : Terms) (scope : Option String) : List Row :=
  match scope with
  | none => matching rows terms
  | some o =>
    (matching rows terms).filter (inScope o) ++
    (matching rows terms).filter (fun r => Bool.not (inScope o r))

theorem matching_mem {r : Row} {rows : List Row} {terms : Terms} :
    r ∈ matching rows terms ↔ r ∈ rows ∧ Matches r.text terms := by
  simp [matching, List.mem_filter]

theorem matching_narrows {r : Row} {rows : List Row} {t : Text} {terms : Terms}
    (h : r ∈ matching rows (t :: terms)) : r ∈ matching rows terms := by
  rw [matching_mem] at h ⊢
  exact ⟨h.1, matches_cons h.2⟩

theorem matching_nil (rows : List Row) : matching rows [] = rows := by
  induction rows with
  | nil => rfl
  | cons r rest ih =>
    rw [matching, List.filter_cons_of_pos (by simp [Matches])]
    exact congrArg (List.cons r) ih

theorem filterCommands_mem {r : Row} {rows : List Row} {terms : Terms} {scope : Option String} :
    r ∈ filterCommands rows terms scope ↔ r ∈ rows ∧ Matches r.text terms := by
  cases scope with
  | none => simp [filterCommands, matching_mem]
  | some o =>
    simp only [filterCommands, List.mem_append, List.mem_filter, matching_mem]
    constructor
    · rintro (⟨hm, _⟩ | ⟨hm, _⟩) <;> exact hm
    · intro h
      by_cases ho : r.owner = some o
      · exact Or.inl ⟨h, (inScope_eq o r).mpr ho⟩
      · exact Or.inr ⟨h, (not_inScope_eq o r).mpr ho⟩

theorem filter_filter_self (l : List Row) (p : Row → Bool) : (l.filter p).filter p = l.filter p := by
  induction l with
  | nil => rfl
  | cons a t ih => cases h : p a <;> simp [List.filter, h, ih]

theorem filter_not_filter (l : List Row) (p : Row → Bool) :
    (l.filter (fun r => Bool.not (p r))).filter p = [] := by
  induction l with
  | nil => rfl
  | cons a t ih => cases h : p a <;> simp [List.filter, h, ih]

theorem filter_self_not (l : List Row) (p : Row → Bool) :
    (l.filter p).filter (fun r => Bool.not (p r)) = [] := by
  induction l with
  | nil => rfl
  | cons a t ih => cases h : p a <;> simp [List.filter, h, ih]

theorem filterCommands_halves (rows : List Row) (terms : Terms) (o : String) :
    (filterCommands rows terms (some o)).filter (inScope o)
        = (matching rows terms).filter (inScope o) ∧
    (filterCommands rows terms (some o)).filter (fun r => Bool.not (inScope o r))
        = (matching rows terms).filter (fun r => Bool.not (inScope o r)) := by
  have both : filterCommands rows terms (some o)
      = (matching rows terms).filter (inScope o)
        ++ (matching rows terms).filter (fun r => Bool.not (inScope o r)) := rfl
  constructor
  · rw [both, List.filter_append, filter_filter_self, filter_not_filter, List.append_nil]
  · rw [both, List.filter_append, filter_self_not, filter_filter_self, List.nil_append]

end CommandSearch
