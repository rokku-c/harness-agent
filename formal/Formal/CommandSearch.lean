/-
  Narrowing the palette's rows to a query, and ordering what is left —
  `apps/effect-server/src/client/console-command-search.ts` (`flows.md` §6.4).

  Two rules live in that file and both are the kind whose wrong answer is silent.

  **The query narrows.** Every word must appear, and that is a claim about how the
  terms *compose*: it says one more term can only take rows away. Read as "any
  term" — or as alternating terms, or as a score with a cutoff — typing widens the
  list instead, and nothing reports it: the palette simply offers more the more the
  operator types, which reads as a search that has not finished yet. The proof
  below is `matches_cons`, and its contrapositive `not_matches_cons` is the half
  the operator feels.

  **A query with nothing in it is not a query.** The composition is over an empty
  list of terms, so it holds of every row, and the palette opens on the full list
  rather than on a blank pane. That is also what an all-whitespace query is, since
  the terms are the *split* of the trimmed query.

  **A row is found by any part of what it is matched against.** `textOf` folds the
  label, the caption, the address and the key into one string; a term that occurs
  in any part occurs in the whole, which is what makes an operation findable by its
  address and a command by the key it is bound to. Drop a part from the fold and
  the row is quietly unfindable by it.

  **The order is a stable partition.** The open app's rows go first — that is what
  "scoped first" is — and each half keeps the order the rows were in, because each
  half is a *filter* of the rows and not a sort of them. `filterCommands_mem` is
  the half that can be lost outright: the partition neither drops a row nor offers
  one twice.

  Idealisation: a row is its matched string and the app it belongs to, which is
  what the search reads (`Row`); the query is the term list the split produced
  rather than the raw text, so the trimming and the lowercasing are outside the
  model and the empty list *is* the empty query. Occurrence is `Infix` on
  character lists, with reflexivity and transitivity proved rather than assumed —
  transitivity is exactly what lets a term found in one part be a term found in
  the fold. Decidability is classical here where the implementation asks
  `String.includes`, because the model's occurrence relation is a proposition and
  what is proved about it is the composition, not the scanning.
-/

open Classical

namespace CommandSearch

/-- A string, as the model needs it. -/
abbrev Text := List Char

/-- The query: one term per word, the empties already dropped. -/
abbrev Terms := List Text

/-- One occurrence of `u` inside `v`. -/
def Infix (u v : Text) : Prop := ∃ p s : Text, v = p ++ u ++ s

theorem infix_refl (u : Text) : Infix u u := ⟨[], [], by simp⟩

/-- Occurrence composes, which is the whole reason a part can be named: a term
    that occurs in a part occurs in whatever that part was folded into. -/
theorem infix_trans {u v w : Text} (h₁ : Infix u v) (h₂ : Infix v w) : Infix u w := by
  obtain ⟨p₁, s₁, rfl⟩ := h₁
  obtain ⟨p₂, s₂, rfl⟩ := h₂
  exact ⟨p₂ ++ p₁, s₁ ++ s₂, by simp [List.append_assoc]⟩

/-- A palette row, as the search reads it: the one string it is matched against,
    and the app it belongs to, which is what the scoping reads. -/
structure Row where
  text : Text
  owner : Option String

/-- Every term appears somewhere in the row's text. -/
def Matches (x : Text) (terms : Terms) : Prop := ∀ t ∈ terms, Infix t x

/-- A query with nothing in it matches everything: the palette opens on the whole
    list rather than on a blank pane. -/
theorem matches_nil (x : Text) : Matches x [] := by simp [Matches]

/-- The composing rule, in the direction that matters: one more term takes rows
    away and never adds one. -/
theorem matches_cons {x : Text} {t : Text} {terms : Terms} (h : Matches x (t :: terms)) :
    Matches x terms := fun u hu => h u (List.mem_cons_of_mem t hu)

/-- The same thing as the operator meets it: a row the shorter query already
    dropped is not brought back by typing more. Composing the terms with anything
    but "every one of them" loses this, and the list then grows as they type. -/
theorem not_matches_cons {x : Text} {t : Text} {terms : Terms} (h : ¬ Matches x terms) :
    ¬ Matches x (t :: terms) := fun hc => h (matches_cons hc)

/-- What a row is matched against, as `textOf` builds it. -/
def textOf (label caption address shortcut : Text) : Text :=
  label ++ caption ++ address ++ shortcut

/-- Every part of the fold is in the fold. This is why an operation is findable by
    its address and a command by the key it is bound to: drop a part and the row
    becomes quietly unfindable by it. -/
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

/-- The rows a query keeps, in the order they were in. -/
noncomputable def matching (rows : List Row) (terms : Terms) : List Row :=
  rows.filter (fun r => decide (Matches r.text terms))

/-- Whether a row belongs to the app the palette is scoped to. -/
def inScope (scope : String) (r : Row) : Bool := decide (r.owner = some scope)

theorem inScope_eq (scope : String) (r : Row) : (inScope scope r = true) ↔ r.owner = some scope := by
  by_cases h : r.owner = some scope <;> simp [inScope, h]

theorem not_inScope_eq (scope : String) (r : Row) :
    (Bool.not (inScope scope r) = true) ↔ r.owner ≠ some scope := by
  by_cases h : r.owner = some scope <;> simp [inScope, h]

/-- The rows for a query, as the palette builds them: the open app's own rows
    first, then the rest. -/
noncomputable def filterCommands (rows : List Row) (terms : Terms) (scope : Option String) : List Row :=
  match scope with
  | none => matching rows terms
  | some o =>
    (matching rows terms).filter (inScope o) ++
    (matching rows terms).filter (fun r => Bool.not (inScope o r))

/-- Nothing is lost and nothing is invented by the match. -/
theorem matching_mem {r : Row} {rows : List Row} {terms : Terms} :
    r ∈ matching rows terms ↔ r ∈ rows ∧ Matches r.text terms := by
  simp [matching, List.mem_filter]

theorem matching_narrows {r : Row} {rows : List Row} {t : Text} {terms : Terms}
    (h : r ∈ matching rows (t :: terms)) : r ∈ matching rows terms := by
  rw [matching_mem] at h ⊢
  exact ⟨h.1, matches_cons h.2⟩

/-- The empty query keeps the whole list. -/
theorem matching_nil (rows : List Row) : matching rows [] = rows := by
  induction rows with
  | nil => rfl
  | cons r rest ih =>
    rw [matching, List.filter_cons_of_pos (by simp [Matches])]
    exact congrArg (List.cons r) ih

/-- The partition is a reordering and not a second filter: every row the match
    kept is offered exactly once, with its app deciding which half it lands in. -/
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

/-- A filter applied twice is itself, which is what makes a half of the partition
    the rows' own order rather than a new one. -/
theorem filter_filter_self (l : List Row) (p : Row → Bool) : (l.filter p).filter p = l.filter p := by
  induction l with
  | nil => rfl
  | cons a t ih => cases h : p a <;> simp [List.filter, h, ih]

/-- And a filter applied to the complement of its own predicate is empty. -/
theorem filter_not_filter (l : List Row) (p : Row → Bool) :
    (l.filter (fun r => Bool.not (p r))).filter p = [] := by
  induction l with
  | nil => rfl
  | cons a t ih => cases h : p a <;> simp [List.filter, h, ih]

/-- The same the other way round: the predicate's own rows, filtered by the
    complement, are empty too. Each half of the partition is one of these two, so
    neither half can leak into the other. -/
theorem filter_self_not (l : List Row) (p : Row → Bool) :
    (l.filter p).filter (fun r => Bool.not (p r)) = [] := by
  induction l with
  | nil => rfl
  | cons a t ih => cases h : p a <;> simp [List.filter, h, ih]

/-- Each half of the output is exactly that half of what the match kept, in the
    order it was in. So §6.4's group order survives inside both halves — which is
    what a sort would lose and a stable partition does not. -/
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
