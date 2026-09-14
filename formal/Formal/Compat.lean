namespace EffectCompat

inductive Level where
  | schema
  | deps
  | description
  | behavior
deriving DecidableEq, Repr

inductive Mode where
  | ignore
  | warn
  | strict
deriving DecidableEq, Repr

abbrev Changed := Level → Bool

abbrev Policy := Level → Mode

abbrev Override := Level → Option Mode

def noOverride : Override := fun _ => none

def levels : List Level := [Level.schema, Level.deps, Level.description, Level.behavior]

def isStrict : Mode → Bool
  | Mode.strict => true
  | _ => false

def modeFrom (o : Override) (p : Policy) (l : Level) : Mode := (o l).getD (p l)

def refuses (c : Changed) (o : Override) (p : Policy) (l : Level) : Bool :=
  c l && isStrict (modeFrom o p l)

def ok (c : Changed) (o : Override) (p : Policy) : Bool :=
  !(levels.any (refuses c o p))

def reported (c : Changed) : List Level := levels.filter c


theorem mem_levels (l : Level) : l ∈ levels := by
  cases l <;> simp [levels]

theorem reported_is_exactly_what_changed (c : Changed) (l : Level) :
    l ∈ reported c ↔ c l = true := by
  simp [reported, mem_levels l]


theorem refuses_iff (c : Changed) (o : Override) (p : Policy) (l : Level) :
    refuses c o p l = true ↔ c l = true ∧ modeFrom o p l = Mode.strict := by
  cases hc : c l <;> cases hm : modeFrom o p l <;> simp [refuses, isStrict, hc, hm]

theorem an_override_decides_the_level_it_names (o : Override) (p : Policy) (l : Level)
    (m : Mode) (h : o l = some m) : modeFrom o p l = m := by
  simp [modeFrom, h]

theorem ok_iff_a_changed_level_is_strict (c : Changed) (o : Override) (p : Policy) :
    ok c o p = true ↔ ∀ l, c l = true → modeFrom o p l ≠ Mode.strict := by
  rw [ok, Bool.not_eq_true', List.any_eq_false]
  constructor
  · intro h l hc hm
    exact absurd ((refuses_iff c o p l).mpr ⟨hc, hm⟩) (by simp [h l (mem_levels l)])
  · intro h l _
    rw [refuses_iff]
    exact fun hcon => h l hcon.1 hcon.2

theorem an_unchanged_level_cannot_refuse (c : Changed) (o : Override) (p : Policy)
    (l : Level) (m : Mode) (h : c l = false) :
    ok c o p = ok c o (fun l' => if l' = l then m else p l') := by
  have hfun : refuses c o p = refuses c o (fun l' => if l' = l then m else p l') := by
    funext l'
    by_cases hl : l' = l
    · subst hl
      simp [refuses, h]
    · simp [refuses, modeFrom, hl]
  simp [ok, hfun]

theorem ignoring_everything_accepts_every_diff (c : Changed) :
    ok c noOverride (fun _ => Mode.ignore) = true := by
  rw [ok_iff_a_changed_level_is_strict]
  intro l _ hm
  simp [modeFrom, noOverride] at hm

theorem the_strictest_policy_refuses_iff_something_changed (c : Changed) :
    ok c noOverride (fun _ => Mode.strict) = true ↔ ∀ l, c l = false := by
  rw [ok_iff_a_changed_level_is_strict]
  constructor
  · intro h l
    by_cases hc : c l = true
    · exact absurd (by simp [modeFrom, noOverride]) (h l hc)
    · simpa [Bool.not_eq_true] using hc
  · intro h l hc
    exact absurd (h l ▸ hc) (by simp)

end EffectCompat
