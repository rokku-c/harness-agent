namespace Credential


structure Request where
  credential : Option Nat
  asserted : Option Nat
deriving DecidableEq, Repr

def resolves : List (Nat × Nat) → Nat → Option Nat
  | [], _ => none
  | (token, principal) :: rest, presented =>
    if token = presented then some principal else resolves rest presented

structure Store where
  tokens : List (Nat × Nat)
  bindings : List (Nat × List Nat)
deriving DecidableEq, Repr

def store : Store := { tokens := [(1, 10), (2, 20)], bindings := [(10, [7])] }

def named (store : Store) (request : Request) : Option Nat :=
  match request.credential with
  | none => none
  | some presented => resolves store.tokens presented

def namedByClaim (_store : Store) (request : Request) : Option Nat := request.asserted

theorem what_a_caller_asserts_decides_nothing (store : Store) (a b : Request)
    (presented : a.credential = b.credential) : named store a = named store b := by
  simp [named, presented]

theorem a_door_that_read_the_claim_names_one_credential_twice :
    namedByClaim store { credential := some 1, asserted := some 10 } = some 10 ∧
      namedByClaim store { credential := some 1, asserted := some 20 } = some 20 := by
  decide


def boundIn : List (Nat × List Nat) → Nat → List Nat
  | [], _ => []
  | (principal, sets) :: rest, wanted =>
    if principal = wanted then sets else boundIn rest wanted

def carries (store : Store) (request : Request) : Bool :=
  match named store request with
  | none => false
  | some principal => !(boundIn store.bindings principal).isEmpty

theorem an_asserted_id_does_not_rename_a_caller :
    named store { credential := some 1, asserted := some 20 } = some 10 := by
  decide

theorem the_binding_is_read_at_the_key_the_credential_names :
    carries store { credential := some 1, asserted := some 20 } = true := by
  decide

theorem nobody_reaches_the_door_without_a_credential (asserted : Option Nat) :
    carries store { credential := none, asserted := asserted } = false := by
  simp [carries, named]

theorem an_unverifiable_credential_carries_nothing (asserted : Option Nat) :
    carries store { credential := some 3, asserted := asserted } = false := by
  simp [carries, named, resolves, store]

theorem a_verified_but_unbound_identity_carries_nothing :
    named store { credential := some 2, asserted := none } = some 20 ∧
      carries store { credential := some 2, asserted := none } = false := by
  decide


structure Plan where
  url : Nat
  credential : Option Nat
  revision : Nat
deriving DecidableEq, Repr

def planned (url : Nat) (held : Option Nat) (revision : Nat) : Plan := ⟨url, held, revision⟩

inductive Change where
  | endpoint
  | credential
  | revision
  | sets
deriving DecidableEq, Repr

def changesOf (next previous : Plan) (nextSets previousSets : List Nat) : List Change :=
  (if next.url = previous.url then [] else [Change.endpoint])
    ++ (if next.credential = previous.credential then [] else [Change.credential])
    ++ (if next.revision = previous.revision then [] else [Change.revision])
    ++ (if nextSets = previousSets then [] else [Change.sets])

theorem a_plan_offered_its_own_receipt_reports_nothing (url : Nat) (held : Option Nat)
    (revision : Nat) (sets : List Nat) :
    changesOf (planned url held revision) (planned url held revision) sets sets = [] := by
  simp [changesOf, planned]

def rotating (reading : Nat) (url revision : Nat) : Plan := ⟨url, some reading, revision⟩

theorem a_credential_read_per_plan_never_settles (url revision : Nat) (sets : List Nat) :
    changesOf (rotating 2 url revision) (rotating 1 url revision) sets sets = [Change.credential] := by
  simp [changesOf, rotating]

theorem only_what_moved_is_reported (url : Nat) (held : Option Nat) (sets : List Nat) :
    changesOf (planned url held 7) (planned url held 8) sets sets = [Change.revision] := by
  simp [changesOf, planned]

end Credential
