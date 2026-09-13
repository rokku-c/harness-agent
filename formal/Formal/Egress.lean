/-
  Egress exit selection — `packages/effect-network/src/policy.ts`.

  A write leaves this node through exactly one exit, and the app declares which
  it prefers: local-first, main-first, local-only, main-only. `chooseExit`
  resolves that preference against what is reachable right now and answers with
  the exit to use; when the preference cannot be met it throws 503 instead of
  quietly using something else.

  The claim the implementation makes in a comment — "Availability selection
  happens before sending. There is intentionally no retry path." — is what this
  proves:

  * `the_label_names_a_reachable_node` — whatever `route` answers names an exit
    that was reachable at selection time. The wrong answer here is silent: a
    write leaves by the wrong door and only the far end notices.
  * `route_from_a_peer_is_the_selected_exit` and
    `route_on_the_main_node_is_the_local_exit` — the answer is the node the
    *policy* chose, or on the main node the one label that names it: on the
    main node the local exit and the main exit are the same place, so a
    main-only policy correctly answers `local` there.
  * `a_main_only_policy_does_not_borrow_the_local_exit` and
    `a_local_only_policy_does_not_borrow_the_main_exit` — when the policy's own
    list is exhausted the answer is failure, even though another exit is
    reachable. `local-only` with the main node up and this node's egress down
    does not become `main-first`.

  And the four policies do not read each other's exits: `local-only`'s answer
  does not depend on whether a main node exists at all.

  Idealisation: the throw is `none` (the 503 and its message belong to the
  transport), `options.localAvailable !== false` is a Bool, and
  `options.main !== undefined` is `mainDefined`.

  Upstream selection is a different layer (which peer to ask, not which exit to
  leave by) and is not modelled.
-/

namespace EffectEgress

/-- What the app declares it prefers. -/
inductive Policy where
  | localFirst
  | mainFirst
  | localOnly
  | mainOnly
deriving DecidableEq, Repr

/-- The two exits a write can leave by. -/
inductive Exit where
  | local
  | main
deriving DecidableEq, Repr

/-- Whether this node *is* the main node or a peer of it. -/
inductive Role where
  | main
  | peer
deriving DecidableEq, Repr

/-- What the caller knows: `localAvailable` is `options.localAvailable !== false`,
`mainDefined` is `options.main !== undefined`. -/
structure Options where
  localAvailable : Bool
  mainDefined : Bool
  role : Role
deriving DecidableEq, Repr

/-- The exported policy list, which is also the whole enumeration of the type. -/
def policies : List Policy :=
  [Policy.localFirst, Policy.mainFirst, Policy.localOnly, Policy.mainOnly]

theorem every_policy_is_declared (p : Policy) : p ∈ policies := by
  cases p <;> simp [policies]

/-- Is this exit reachable? On the main node the main exit *is* the local one. -/
def available (o : Options) : Exit → Bool
  | .local => o.localAvailable
  | .main => match o.role with
    | .main => o.localAvailable
    | .peer => o.mainDefined

/-- The exits a policy accepts, best first. -/
def candidates : Policy → List Exit
  | .localOnly => [Exit.local]
  | .mainOnly => [Exit.main]
  | .localFirst => [Exit.local, Exit.main]
  | .mainFirst => [Exit.main, Exit.local]

/-- The selection: the first acceptable exit that is reachable, if any. -/
def selected (o : Options) (p : Policy) : Option Exit := (candidates p).find? (available o)

/-- What the caller is handed; `none` is the 503. -/
def route (o : Options) (p : Policy) : Option Exit :=
  (selected o p).map fun e => if e = Exit.main ∧ o.role = Role.peer then Exit.main else Exit.local

theorem a_selection_is_reachable (o : Options) (p : Policy) (e : Exit)
    (h : selected o p = some e) : available o e = true :=
  List.find?_some h

theorem a_policy_with_nothing_reachable_fails (o : Options) (p : Policy)
    (h : ∀ c, c ∈ candidates p → available o c = false) : selected o p = none :=
  List.find?_eq_none.mpr fun c hc => by rw [h c hc]; exact Bool.false_ne_true

theorem route_from_a_peer_is_the_selected_exit (o : Options) (h : o.role = Role.peer)
    (p : Policy) : route o p = selected o p := by
  rcases o with ⟨l, m, r⟩
  cases l <;> cases m <;> cases r <;> cases p <;>
    simp_all [route, selected, candidates, available, List.find?_cons]

theorem route_on_the_main_node_is_the_local_exit (o : Options) (h : o.role = Role.main)
    (p : Policy) : route o p = (selected o p).map (fun _ => Exit.local) := by
  rcases o with ⟨l, m, r⟩
  cases l <;> cases m <;> cases r <;> cases p <;>
    simp_all [route, selected, candidates, available]

theorem the_label_names_a_reachable_node (o : Options) (p : Policy) (x : Exit)
    (h : route o p = some x) : available o x = true := by
  rcases o with ⟨l, m, r⟩
  cases l <;> cases m <;> cases r <;> cases p <;> cases x <;>
    simp_all [route, selected, candidates, available]

theorem local_only_takes_the_local_exit (o : Options) :
    route o Policy.localOnly = if o.localAvailable then some Exit.local else none := by
  rcases o with ⟨l, m, r⟩
  cases l <;> cases m <;> cases r <;> simp_all [route, selected, candidates, available]

theorem local_only_never_leaves_the_node (o : Options) (h : o.role = Role.peer) :
    route o Policy.localOnly ≠ some Exit.main := by
  rcases o with ⟨l, m, r⟩
  cases l <;> cases m <;> cases r <;> simp_all [route, selected, candidates, available]

theorem local_only_does_not_read_the_main_node (o : Options) (m : Bool) :
    route { o with mainDefined := m } Policy.localOnly = route o Policy.localOnly := by
  rcases o with ⟨l, _, r⟩
  cases l <;> cases m <;> cases r <;> simp_all [route, selected, candidates, available]

theorem main_only_on_the_main_node_is_the_local_exit (o : Options) (h : o.role = Role.main) :
    route o Policy.mainOnly = if o.localAvailable then some Exit.local else none := by
  rcases o with ⟨l, m, r⟩
  cases l <;> cases m <;> cases r <;> simp_all [route, selected, candidates, available]

theorem main_only_from_a_peer_reaches_the_main_node (o : Options) (h : o.role = Role.peer) :
    route o Policy.mainOnly = if o.mainDefined then some Exit.main else none := by
  rcases o with ⟨l, m, r⟩
  cases l <;> cases m <;> cases r <;> simp_all [route, selected, candidates, available]

theorem local_first_is_local_while_local_is_reachable (o : Options)
    (h : o.localAvailable = true) : route o Policy.localFirst = some Exit.local := by
  rcases o with ⟨l, m, r⟩
  cases l <;> cases m <;> cases r <;> simp_all [route, selected, candidates, available]

theorem main_first_is_main_while_main_is_reachable (o : Options) (hr : o.role = Role.peer)
    (h : o.mainDefined = true) : route o Policy.mainFirst = some Exit.main := by
  rcases o with ⟨l, m, r⟩
  cases l <;> cases m <;> cases r <;> simp_all [route, selected, candidates, available]

theorem a_main_only_policy_does_not_borrow_the_local_exit (o : Options)
    (hr : o.role = Role.peer) (hm : o.mainDefined = false) (hl : o.localAvailable = true) :
    route o Policy.mainOnly = none := by
  rcases o with ⟨l, m, r⟩
  cases l <;> cases m <;> cases r <;> simp_all [route, selected, candidates, available]

theorem a_local_only_policy_does_not_borrow_the_main_exit (o : Options)
    (hl : o.localAvailable = false) (hm : o.mainDefined = true) :
    route o Policy.localOnly = none := by
  rcases o with ⟨l, m, r⟩
  cases l <;> cases m <;> cases r <;> simp_all [route, selected, candidates, available]

end EffectEgress
