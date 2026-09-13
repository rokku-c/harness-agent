/-
  Stratified coverage — `packages/effect-authz/src/match.ts`.

  `covers(grant, target)` answers "does a grant written this way reach this
  resource?", and the file's header states the three rules it resolves in order.
  Two of them are all that stands between a grant and a wider reach than it was
  written for, and both are silent when read the other way: the verdict comes back
  `allow`, and nothing anywhere says the grant reached further than intended.

  **`*` pins the depth** — `a_star_pins_the_length`. Rule 3 lets a literal-only
  grant inherit downward, `ops::board` reaching `ops::board::main`, and what keeps
  that from being a hole is that a grant containing `*` is not literal-only. Read
  without the guard and `ops::*` reaches every depth below it:
  `dropping_the_depth_pin_lets_a_star_grant_reach_every_depth`.

  **A terminal `**` requires one more segment** — `a_rest_grant_covers_only_strictly_deeper_targets`,
  with `a_rest_grant_covers_every_aligned_target_below_it` for the other direction,
  since a rest that covered nothing would be a rule that does not work rather than
  one that is too wide. Read as "at least as deep" it also covers its own head:
  `reading_the_rest_as_inclusive_lets_a_container_cover_itself`.

  **A named scheme covers only its own** — rule 1, and a grant with no scheme
  reaches every scheme rather than defaulting to one.

  Idealisation: a resource is its text split into segments, which is what
  `parseResource` produces. How `ui://ops/board` is spelled and split is that
  file's subject; the segments below are what `covers` is given.
-/

namespace EffectAuthz

/-- One resource: the scheme it names, if any, and the segments after it. -/
structure Resource where
  scheme : String
  segments : List String
deriving DecidableEq, Repr

/-- A resource with no scheme — the shape most grants are written in, and the one
that reaches every scheme. -/
def plain (segments : List String) : Resource := { scheme := "", segments }

/-- Rule 2 on its own: segments align from the left, `*` consuming exactly one. -/
def alignsAt (grant target : List String) : Bool :=
  (grant.zip target).all (fun pair => decide (pair.1 = "*") || decide (pair.1 = pair.2))

/-- A grant split the way rule 3 reads it: a terminal `**` is a depth suffix, and
what precedes it is the head rules 1 and 2 apply to. -/
def split (segments : List String) : List String × Bool :=
  match segments.getLast? with
  | some last => if last = "**" then (segments.dropLast, true) else (segments, false)
  | none => (segments, false)

/-- Rules 2 and 3, on a grant already split. `rest` says the grant ended in `**`.
The guard chain the file writes as early returns, written as the conjunction it is:
no target shorter than the head, segments aligned, and then the depth rule — an
exact-length match, a literal-only grant reaching below itself, or a `**` needing
one more segment. -/
def coversSplit (head target : List String) (rest : Bool) : Bool :=
  decide (head.length ≤ target.length) && alignsAt head target &&
  (if rest then decide (head.length < target.length)
   else if head.length = target.length then true else !head.contains "*")

/-- `covers(grant, target)`: rule 1, then rules 2 and 3 on the split grant. -/
def covers (grant target : Resource) : Bool :=
  if grant.scheme ≠ "" ∧ grant.scheme ≠ target.scheme then false
  else
    let parts := split grant.segments
    coversSplit parts.1 target.segments parts.2

/-- Rule 1: a grant that names a scheme reaches only resources of that scheme. -/
theorem a_named_grant_covers_only_its_own_scheme (grant target : Resource)
    (named : grant.scheme ≠ "") (other : grant.scheme ≠ target.scheme) :
    covers grant target = false := by
  simp [covers, named, other]

/-- Rule 1's other half: a grant with no scheme ignores the target's scheme rather
than defaulting to one, so the same segments cover `ops::…` and `ui://ops/…`. -/
theorem a_grant_without_a_scheme_reaches_every_scheme (segments : List String) (target : Resource) :
    covers (plain segments) target = coversSplit (split segments).1 target.segments (split segments).2 := by
  simp [covers, plain]

/-- The depth pin. A grant containing `*` covers a deeper target only when the
target is not deeper at all — no target below it is reached, whatever it holds. -/
theorem a_star_pins_the_length (head target : List String) (star : "*" ∈ head)
    (deeper : head.length < target.length) (aligned : alignsAt head target = true) :
    coversSplit head target false = false := by
  have le : head.length ≤ target.length := Nat.le_of_lt deeper
  have ne : head.length ≠ target.length := Nat.ne_of_lt deeper
  simp [coversSplit, le, aligned, ne, star]

/-- A `**` grant covers every aligned target strictly below it. -/
theorem a_rest_grant_covers_every_aligned_target_below_it (head target : List String)
    (deeper : head.length < target.length) (aligned : alignsAt head target = true) :
    coversSplit head target true = true := by
  have le : head.length ≤ target.length := Nat.le_of_lt deeper
  simp [coversSplit, le, aligned, deeper]

/-- A `**` grant covers nothing that is not strictly below its head — its own head
included. This is the direction that is a hole when it is read as "at least as
deep". -/
theorem a_rest_grant_covers_only_strictly_deeper_targets (head target : List String)
    (covered : coversSplit head target true = true) : head.length < target.length := by
  simp only [coversSplit, if_true, Bool.and_eq_true, decide_eq_true_eq] at covered
  exact covered.2

/-- Rule 3 read without the depth pin: a grant covers anything at least as deep as
its head, with `*` counted like any other segment. -/
def coversSplitWithoutThePin (head target : List String) (_rest : Bool) : Bool :=
  alignsAt head target && decide (head.length ≤ target.length)

/-- The control. `ops::*` was written to reach the resources directly under `ops`;
read without the pin it reaches every depth below, and the verdict is `allow` with
nothing to say the grant went further than it was written to. -/
theorem dropping_the_depth_pin_lets_a_star_grant_reach_every_depth :
    coversSplitWithoutThePin ["ops", "*"] ["ops", "board", "main"] false = true ∧
    coversSplit ["ops", "*"] ["ops", "board", "main"] false = false := by
  decide

/-- Rule 3's `**` read as "at least as deep" instead of "deeper" — one symbol
apart from the rule above. -/
def coversSplitWithInclusiveRest (head target : List String) (rest : Bool) : Bool :=
  decide (head.length ≤ target.length) && alignsAt head target &&
  (if rest then decide (head.length ≤ target.length)
   else if head.length = target.length then true else !head.contains "*")

/-- The control: `ops::**` was written to reach the resources *under* `ops`; read
inclusively it covers `ops` itself, so a grant on a container is also a grant on
the container. -/
theorem reading_the_rest_as_inclusive_lets_a_container_cover_itself :
    coversSplitWithInclusiveRest ["ops"] ["ops"] true = true ∧
    coversSplit ["ops"] ["ops"] true = false := by
  decide

/-- The three rules end to end, on the grants the header writes out: `ops` reaches
a `ui://` resource it names no scheme for, `ops::board` reaches below itself, and
`ops::*` reaches exactly one level below itself and no further. -/
theorem the_three_rules_reach_exactly_what_the_header_says :
    covers (plain ["ops"]) { scheme := "ui", segments := ["ops", "board", "main"] } = true ∧
    covers (plain ["ops", "board"]) (plain ["ops", "board", "main"]) = true ∧
    covers (plain ["ops", "*"]) (plain ["ops", "board"]) = true ∧
    covers (plain ["ops", "*"]) (plain ["ops", "board", "main"]) = false ∧
    covers (plain ["ops", "**"]) (plain ["ops", "board", "main"]) = true ∧
    covers (plain ["ops", "**"]) (plain ["ops"]) = false := by
  decide

end EffectAuthz
