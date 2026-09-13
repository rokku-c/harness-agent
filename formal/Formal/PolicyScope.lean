/-
  The DERIVED SCOPE — `packages/script/src/policy.ts`, `restrictPolicy`.

  A root agent derives a child by naming a scope, and the scope is inherited
  wholesale except for that one list. The derivation intersected the list
  whichever mode the parent was in. Under `allowlist` that is narrowing, and
  under `denylist` it is the opposite: the list is what is *excluded*, so
  intersecting it drops the parent's own exclusions and hands the child every
  tool the parent was denied — the policy still reads as valid, the visible
  set is merely larger, and nothing anywhere says so.

  `derive` is the reading now. What makes the two modes one rule rather than
  two is `admits`: the same name list means visible names in one mode and
  excluded names in the other, and narrowing is `⊆` on what `admits` returns
  either way — so the modes differ in the operation, not in the claim.

  The idealisation is the scope alone: the file computes a name list and
  `closure.ts` turns it into the tools an agent reaches. Lists here drop
  duplicates and order, which the rule does not turn on; membership is what
  the name list is for.
-/

namespace PolicyScope

/-- Which way a scope's name list reads. -/
inductive Mode where
  | allowlist
  | denylist
deriving DecidableEq, Repr

/-- One agent's api scope: the mode, and the list it reads in that mode. -/
structure Scope where
  mode : Mode
  names : List Nat
deriving DecidableEq, Repr

/-- Whether this scope admits a tool. An allowlist admits what it names; a
    denylist admits everything it does not. -/
def admits (s : Scope) (tool : Nat) : Bool :=
  match s.mode with
  | Mode.allowlist => s.names.contains tool
  | Mode.denylist => !s.names.contains tool

/-- The derivation as the file had it: intersect, whichever the mode. -/
def intersectScope (parent : Scope) (named : List Nat) : Scope :=
  { parent with names := parent.names.filter named.contains }

/-- The derivation now: keep less where the names are what is visible, exclude
    more where they are what is excluded. -/
def derive (parent : Scope) (named : List Nat) : Scope :=
  { parent with names := match parent.mode with
    | Mode.denylist => parent.names ++ named
    | Mode.allowlist => parent.names.filter named.contains }

/--
The bug. The parent is a denylist that blocks tool 4 and admits everything
else; the child names tool 1. Read as an intersection the child's list is
empty — no exclusions at all — so the child admits the tool the parent was
denied, and the derivation reported success.
-/
theorem the_intersection_hands_the_child_the_blocked_tool :
    admits (intersectScope { mode := Mode.denylist, names := [4] } [1]) 4 = true := by
  decide

/-- The parent did not admit it, so the two disagree on the same tool. -/
theorem the_parent_did_not_admit_it :
    admits { mode := Mode.denylist, names := [4] } 4 = false := by
  decide

/-- The fix: the child's exclusions carry the parent's, so tool 4 stays out. -/
theorem the_derivation_keeps_the_parents_exclusions :
    admits (derive { mode := Mode.denylist, names := [4] } [1]) 4 = false := by
  decide

/-- And what the child itself named is excluded too, which is what deriving it
    with that list was for. -/
theorem the_derivation_adds_the_childs_own_exclusions :
    admits (derive { mode := Mode.denylist, names := [4] } [1]) 1 = false := by
  decide

/-- Under an allowlist the same list still intersects, so the child keeps only
    what both named. -/
theorem the_allowlist_derivation_still_intersects :
    admits (derive { mode := Mode.allowlist, names := [1, 2] } [2, 3]) 1 = false
      ∧ admits (derive { mode := Mode.allowlist, names := [1, 2] } [2, 3]) 2 = true
      ∧ admits (derive { mode := Mode.allowlist, names := [1, 2] } [2, 3]) 3 = false := by
  decide

/--
The claim both modes make, in one statement: a derived child admits no tool its
parent did not. This is the invariant the file's comment asserts, and the
reason the intersection is the wrong operation rather than merely a different
one.
-/
theorem a_derived_scope_admits_nothing_new (parent : Scope) (named : List Nat) (tool : Nat)
    (h : admits (derive parent named) tool = true) : admits parent tool = true := by
  cases hm : parent.mode <;> simp [admits, derive, hm] at h ⊢ <;> exact h.1

/--
The control: the claim is not vacuous. A tool the parent admitted that the
child did not name stays admitted — excluding everything would satisfy
"admits nothing new" while deriving an agent that can do nothing, so the rule
has to be the difference between the two scopes and not a collapse.
-/
theorem the_derivation_keeps_what_neither_side_excluded :
    admits (derive { mode := Mode.denylist, names := [4] } [1]) 9 = true := by
  decide

/-- And matches its parent on it, which is what "inherits the rest" means. -/
theorem the_two_agree_on_what_neither_excluded :
    admits (derive { mode := Mode.denylist, names := [4] } [1]) 9
      = admits { mode := Mode.denylist, names := [4] } 9 := by
  decide

end PolicyScope
