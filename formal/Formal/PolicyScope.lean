namespace PolicyScope

inductive Mode where
  | allowlist
  | denylist
deriving DecidableEq, Repr

structure Scope where
  mode : Mode
  names : List Nat
deriving DecidableEq, Repr

def admits (s : Scope) (tool : Nat) : Bool :=
  match s.mode with
  | Mode.allowlist => s.names.contains tool
  | Mode.denylist => !s.names.contains tool

def intersectScope (parent : Scope) (named : List Nat) : Scope :=
  { parent with names := parent.names.filter named.contains }

def derive (parent : Scope) (named : List Nat) : Scope :=
  { parent with names := match parent.mode with
    | Mode.denylist => parent.names ++ named
    | Mode.allowlist => parent.names.filter named.contains }

theorem the_intersection_hands_the_child_the_blocked_tool :
    admits (intersectScope { mode := Mode.denylist, names := [4] } [1]) 4 = true := by
  decide

theorem the_parent_did_not_admit_it :
    admits { mode := Mode.denylist, names := [4] } 4 = false := by
  decide

theorem the_derivation_keeps_the_parents_exclusions :
    admits (derive { mode := Mode.denylist, names := [4] } [1]) 4 = false := by
  decide

theorem the_derivation_adds_the_childs_own_exclusions :
    admits (derive { mode := Mode.denylist, names := [4] } [1]) 1 = false := by
  decide

theorem the_allowlist_derivation_still_intersects :
    admits (derive { mode := Mode.allowlist, names := [1, 2] } [2, 3]) 1 = false
      ∧ admits (derive { mode := Mode.allowlist, names := [1, 2] } [2, 3]) 2 = true
      ∧ admits (derive { mode := Mode.allowlist, names := [1, 2] } [2, 3]) 3 = false := by
  decide

theorem a_derived_scope_admits_nothing_new (parent : Scope) (named : List Nat) (tool : Nat)
    (h : admits (derive parent named) tool = true) : admits parent tool = true := by
  cases hm : parent.mode <;> simp [admits, derive, hm] at h ⊢ <;> exact h.1

theorem the_derivation_keeps_what_neither_side_excluded :
    admits (derive { mode := Mode.denylist, names := [4] } [1]) 9 = true := by
  decide

theorem the_two_agree_on_what_neither_excluded :
    admits (derive { mode := Mode.denylist, names := [4] } [1]) 9
      = admits { mode := Mode.denylist, names := [4] } 9 := by
  decide

end PolicyScope
