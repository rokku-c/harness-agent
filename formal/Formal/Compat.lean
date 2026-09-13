/-
  The graded adjudication — `packages/effect-compat/src/assess.ts`.

  One mechanism decides whether a new version of a thing may replace the old
  one: script tools, kernel revisions, app generations. Four breaking-change
  levels (schema / deps / description / behavior) are each adjudicated with a
  mode (strict / warn / ignore), and a level adjudicated strict refuses the
  version. The file computes this as `strict.length === 0` over a list built by
  four `if`s, each reading its own level's mode, each gated on that level
  having changed.

  What that shape leaves unstated is everything an operator leans on. That a
  level which did not change is never adjudicated at all — so making `deps`
  strict cannot refuse a version that only touched a description. That the
  violation list is exactly the changed levels: a missed one is the silent
  failure this mechanism exists to prevent, and an invented one refuses an
  upgrade nothing was wrong with. That `ignore` everywhere really does accept
  everything, and that the strictest reading refuses a version exactly when
  something changed — which is what "there is nothing stricter than this" has
  to mean to be checkable at all.

  Modelling note: the diff itself (`schemaChanged`, `depsChanged`, the
  description comparison) is left out. Those are comparisons; what this models
  is what the adjudication does with their answers.

  One divergence is left, and it is a widening rather than a gap: `behavior` is
  typed `require-declaration | ignore` — it can never be `warn` — while this
  model gives every level the same three modes. The model therefore says
  something about more policies than the product can express, which is the safe
  direction for a statement of the form "nothing stricter than this refuses
  anything it should not".

  `assessChange` reads the override for all four levels, including behavior.
  That was not true when this module was written: it adjudicated behavior from
  `policy.behavior` alone while the override's type accepted a behavior entry,
  so a per-artifact override was silently ignored — a refusal that looked like a
  policy decision. `an_override_decides_the_level_it_names` is the rule the code
  now keeps.
-/

namespace EffectCompat

/-- A breaking-change level, named in the order the file assesses them. -/
inductive Level where
  | schema
  | deps
  | description
  | behavior
deriving DecidableEq, Repr

/-- How strictly a level is adjudicated. -/
inductive Mode where
  | ignore
  | warn
  | strict
deriving DecidableEq, Repr

/-- What a diff found: for each level, whether it changed. -/
abbrev Changed := Level → Bool

/-- The policy: the mode each level is adjudicated with. -/
abbrev Policy := Level → Mode

/-- A per-artifact override of the policy, at the levels it names. -/
abbrev Override := Level → Option Mode

/-- No artifact overrides anything: the policy alone decides. -/
def noOverride : Override := fun _ => none

/-- All four levels, so a statement about "every level" has something to case
on. -/
def levels : List Level := [Level.schema, Level.deps, Level.description, Level.behavior]

/-- Is this level being adjudicated strictly — the one mode that refuses. -/
def isStrict : Mode → Bool
  | Mode.strict => true
  | _ => false

/-- The mode a level is adjudicated with: the artifact's override where it has
one, the policy's otherwise. -/
def modeFrom (o : Override) (p : Policy) (l : Level) : Mode := (o l).getD (p l)

/-- Whether this level refuses the version. A level that did not change is not
adjudicated at all — which is what leaves its mode unreadable from the outcome,
and what `an_unchanged_level_cannot_refuse` below turns into a proof. -/
def refuses (c : Changed) (o : Override) (p : Policy) (l : Level) : Bool :=
  c l && isStrict (modeFrom o p l)

/-- The verdict: refused exactly when some level refuses. -/
def ok (c : Changed) (o : Override) (p : Policy) : Bool :=
  !(levels.any (refuses c o p))

/-- The levels reported as violations. -/
def reported (c : Changed) : List Level := levels.filter c

/-! ### What is reported -/

/-- Every level is one of the four. -/
theorem mem_levels (l : Level) : l ∈ levels := by
  cases l <;> simp [levels]

/-- The violations are exactly the changed levels: none is reported that did not
change — that would refuse an upgrade nothing was wrong with — and none that
did is missed. The missed one is the silent failure the mechanism exists to
prevent, and it is the half a reader cannot check by looking at a green run. -/
theorem reported_is_exactly_what_changed (c : Changed) (l : Level) :
    l ∈ reported c ↔ c l = true := by
  simp [reported, mem_levels l]

/-! ### What is refused -/

/-- A level refuses exactly when it changed and is adjudicated strict. -/
theorem refuses_iff (c : Changed) (o : Override) (p : Policy) (l : Level) :
    refuses c o p l = true ↔ c l = true ∧ modeFrom o p l = Mode.strict := by
  cases hc : c l <;> cases hm : modeFrom o p l <;> simp [refuses, isStrict, hc, hm]

/-- An artifact's override decides the level it names, whatever the policy says.
This is the whole of what the `compat` field is for, and it is why a per-level
override is worth having over one global policy: the artifact knows about a
level the operator does not. -/
theorem an_override_decides_the_level_it_names (o : Override) (p : Policy) (l : Level)
    (m : Mode) (h : o l = some m) : modeFrom o p l = m := by
  simp [modeFrom, h]

/-- The verdict, stated about the levels rather than about the list the file
builds: refused exactly when some level that changed is adjudicated strict. The
four `if`s and this say the same thing, with the order they were written in
factored out. -/
theorem ok_iff_a_changed_level_is_strict (c : Changed) (o : Override) (p : Policy) :
    ok c o p = true ↔ ∀ l, c l = true → modeFrom o p l ≠ Mode.strict := by
  rw [ok, Bool.not_eq_true', List.any_eq_false]
  constructor
  · intro h l hc hm
    exact absurd ((refuses_iff c o p l).mpr ⟨hc, hm⟩) (by simp [h l (mem_levels l)])
  · intro h l _
    rw [refuses_iff]
    exact fun hcon => h l hcon.1 hcon.2

/-- A level that did not change cannot refuse: its mode is never consulted, so
setting `deps` strict cannot refuse a version that only touched a description.
This is what makes the policy a per-level decision rather than one global one. -/
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

/-- `ignore` everywhere accepts every diff. Stated with no artifact overrides,
because an override is the one thing that outranks the policy: an artifact that
declares a level strict is adjudicated strictly however the policy reads. -/
theorem ignoring_everything_accepts_every_diff (c : Changed) :
    ok c noOverride (fun _ => Mode.ignore) = true := by
  rw [ok_iff_a_changed_level_is_strict]
  intro l _ hm
  simp [modeFrom, noOverride] at hm

/-- And the strictest reading refuses a version exactly when something changed
at all: under `strict` everywhere, the change set *is* the verdict. This is what
"no policy is stricter than this one" has to mean to be checkable. -/
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
