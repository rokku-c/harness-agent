namespace EffectAuthz

structure Resource where
  scheme : String
  segments : List String
deriving DecidableEq, Repr

def plain (segments : List String) : Resource := { scheme := "", segments }

def alignsAt (grant target : List String) : Bool :=
  (grant.zip target).all (fun pair => decide (pair.1 = "*") || decide (pair.1 = pair.2))

def split (segments : List String) : List String × Bool :=
  match segments.getLast? with
  | some last => if last = "**" then (segments.dropLast, true) else (segments, false)
  | none => (segments, false)

def coversSplit (head target : List String) (rest : Bool) : Bool :=
  decide (head.length ≤ target.length) && alignsAt head target &&
  (if rest then decide (head.length < target.length)
   else if head.length = target.length then true else !head.contains "*")

def covers (grant target : Resource) : Bool :=
  if grant.scheme ≠ "" ∧ grant.scheme ≠ target.scheme then false
  else
    let parts := split grant.segments
    coversSplit parts.1 target.segments parts.2

theorem a_named_grant_covers_only_its_own_scheme (grant target : Resource)
    (named : grant.scheme ≠ "") (other : grant.scheme ≠ target.scheme) :
    covers grant target = false := by
  simp [covers, named, other]

theorem a_grant_without_a_scheme_reaches_every_scheme (segments : List String) (target : Resource) :
    covers (plain segments) target = coversSplit (split segments).1 target.segments (split segments).2 := by
  simp [covers, plain]

theorem a_star_pins_the_length (head target : List String) (star : "*" ∈ head)
    (deeper : head.length < target.length) (aligned : alignsAt head target = true) :
    coversSplit head target false = false := by
  have le : head.length ≤ target.length := Nat.le_of_lt deeper
  have ne : head.length ≠ target.length := Nat.ne_of_lt deeper
  simp [coversSplit, le, aligned, ne, star]

theorem a_rest_grant_covers_every_aligned_target_below_it (head target : List String)
    (deeper : head.length < target.length) (aligned : alignsAt head target = true) :
    coversSplit head target true = true := by
  have le : head.length ≤ target.length := Nat.le_of_lt deeper
  simp [coversSplit, le, aligned, deeper]

theorem a_rest_grant_covers_only_strictly_deeper_targets (head target : List String)
    (covered : coversSplit head target true = true) : head.length < target.length := by
  simp only [coversSplit, if_true, Bool.and_eq_true, decide_eq_true_eq] at covered
  exact covered.2

def coversSplitWithoutThePin (head target : List String) (_rest : Bool) : Bool :=
  alignsAt head target && decide (head.length ≤ target.length)

theorem dropping_the_depth_pin_lets_a_star_grant_reach_every_depth :
    coversSplitWithoutThePin ["ops", "*"] ["ops", "board", "main"] false = true ∧
    coversSplit ["ops", "*"] ["ops", "board", "main"] false = false := by
  decide

def coversSplitWithInclusiveRest (head target : List String) (rest : Bool) : Bool :=
  decide (head.length ≤ target.length) && alignsAt head target &&
  (if rest then decide (head.length ≤ target.length)
   else if head.length = target.length then true else !head.contains "*")

theorem reading_the_rest_as_inclusive_lets_a_container_cover_itself :
    coversSplitWithInclusiveRest ["ops"] ["ops"] true = true ∧
    coversSplit ["ops"] ["ops"] true = false := by
  decide

theorem the_three_rules_reach_exactly_what_the_header_says :
    covers (plain ["ops"]) { scheme := "ui", segments := ["ops", "board", "main"] } = true ∧
    covers (plain ["ops", "board"]) (plain ["ops", "board", "main"]) = true ∧
    covers (plain ["ops", "*"]) (plain ["ops", "board"]) = true ∧
    covers (plain ["ops", "*"]) (plain ["ops", "board", "main"]) = false ∧
    covers (plain ["ops", "**"]) (plain ["ops", "board", "main"]) = true ∧
    covers (plain ["ops", "**"]) (plain ["ops"]) = false := by
  decide

end EffectAuthz
