/-
  ONE IDENTITY, AND THE CONFIG THAT PRESENTS IT — `agentd/src/adapter.ts`,
  `agentd/src/control-agent-ops.ts`.

  An agent reaches the platform's tool door through a config the center plans for
  it. That config used to carry `headers: { "x-agent-id": <the agent> }`, which is
  a caller telling the door who it is — the defect `Formal/DoorAuth.lean` removes
  at the door, still being written one layer down at the config. What crosses now
  is a **credential and nothing else**: the door names a caller from what it
  verified, so what the config presents decides the name and what the config says
  about itself decides nothing (`what_a_caller_asserts_decides_nothing`). The
  control is the shape the old config had, and it is one credential named two
  ways — which is what a door reading an assertion lets anyone do.

  **The credential is declared against the identity it is for.** The center binds
  an agent by its id and the door resolves a credential to a principal key, so
  the two are one string or the agent is a set of bindings nothing reaches. The
  center's half of that is enforced where an identity is declared — an id that is
  not `kind:id` is refused — and what the door does with the one it verifies is
  `carries`: nothing, unless the credential names a principal a set is bound to.

  **The credential a plan carries is made from what the center holds, not from a
  reading** (`a_plan_offered_its_own_receipt_reports_nothing`). This is the
  property that decided the design. The gateway hands out a fresh plaintext token
  per issue and stores only its hash, so a center that asked per plan would plan
  a different header every time: every plan would report an identity change, the
  apply would never settle, and every reading would leave another live credential
  for one agent (`a_credential_read_per_plan_never_settles`). Holding it is not a
  copy of the gateway's record — that record is a hash and a revocation, and the
  plaintext exists wherever it is used, which for an agent is a config file.

  Idealisation: a credential is its own identity (`Option Nat`) and a principal is
  a number; the `Bearer ` a header spells around one is presentation, and
  `Formal/DoorAuth.lean` is where a request's headers are read as that one thing.
  The stores are lists read by first match, which is what a table with a unique
  key is.
-/

namespace Credential

/- What the door sees, and the one field it reads. -/

/-- A request as the door has it: the credential it presents, and whatever it
asserted about itself. -/
structure Request where
  credential : Option Nat
  asserted : Option Nat
deriving DecidableEq, Repr

/-- The credentials a store can verify, and the principal each resolves to. -/
def resolves : List (Nat × Nat) → Nat → Option Nat
  | [], _ => none
  | (token, principal) :: rest, presented =>
    if token = presented then some principal else resolves rest presented

/-- What the door holds: credentials, and the sets bound to each principal one
resolves to. -/
structure Store where
  tokens : List (Nat × Nat)
  bindings : List (Nat × List Nat)
deriving DecidableEq, Repr

/-- One store: credential `1` names principal `10` and `2` names `20`, and only
`10` has a set. -/
def store : Store := { tokens := [(1, 10), (2, 20)], bindings := [(10, [7])] }

/-- The principal the door names. The credential is the only field it reads. -/
def named (store : Store) (request : Request) : Option Nat :=
  match request.credential with
  | none => none
  | some presented => resolves store.tokens presented

/-- The identity a config claims, if the door read one. Not a definition of the
door — the shape the old config had, kept here so the control can be run. -/
def namedByClaim (_store : Store) (request : Request) : Option Nat := request.asserted

/-- Two requests carrying the *same* credential are one caller, however they
describe themselves. -/
theorem what_a_caller_asserts_decides_nothing (store : Store) (a b : Request)
    (presented : a.credential = b.credential) : named store a = named store b := by
  simp [named, presented]

/-- The control: a door that read the claim would name one credential two ways,
so a caller could carry another agent's sets by typing its id. -/
theorem a_door_that_read_the_claim_names_one_credential_twice :
    namedByClaim store { credential := some 1, asserted := some 10 } = some 10 ∧
      namedByClaim store { credential := some 1, asserted := some 20 } = some 20 := by
  decide

/- The sets, read at the key the credential named. -/

/-- The sets bound to a principal, by first match. -/
def boundIn : List (Nat × List Nat) → Nat → List Nat
  | [], _ => []
  | (principal, sets) :: rest, wanted =>
    if principal = wanted then sets else boundIn rest wanted

/-- The sets the door would carry for a request: none, unless the credential
verifies and a set is bound to the principal it names. -/
def carries (store : Store) (request : Request) : Bool :=
  match named store request with
  | none => false
  | some principal => !(boundIn store.bindings principal).isEmpty

/-- Presenting `1` while claiming to be `20` is named `10`. The claim is not
overridden, it is never read. -/
theorem an_asserted_id_does_not_rename_a_caller :
    named store { credential := some 1, asserted := some 20 } = some 10 := by
  decide

/-- And the sets it carries are the ones bound to `10`. -/
theorem the_binding_is_read_at_the_key_the_credential_names :
    carries store { credential := some 1, asserted := some 20 } = true := by
  decide

/-- No credential, nothing carried — whatever the request said about itself. -/
theorem nobody_reaches_the_door_without_a_credential (asserted : Option Nat) :
    carries store { credential := none, asserted := asserted } = false := by
  simp [carries, named]

/-- A credential the door cannot verify names nobody, so it carries nothing. -/
theorem an_unverifiable_credential_carries_nothing (asserted : Option Nat) :
    carries store { credential := some 3, asserted := asserted } = false := by
  simp [carries, named, resolves, store]

/-- A credential that verifies for a principal no set is bound to carries nothing.
The refusal is about the binding and it is the true one about that agent — an
identity is a fact before it reaches anything. -/
theorem a_verified_but_unbound_identity_carries_nothing :
    named store { credential := some 2, asserted := none } = some 20 ∧
      carries store { credential := some 2, asserted := none } = false := by
  decide

/- What a plan carries, and why it is made from the state. -/

/-- One agent's config, as the adapter plans it. -/
structure Plan where
  url : Nat
  credential : Option Nat
  revision : Nat
deriving DecidableEq, Repr

/-- The plan, as a function of what the center holds. Nothing here reads a store:
that is the whole of what makes a receipt usable as the next plan's input. -/
def planned (url : Nat) (held : Option Nat) (revision : Nat) : Plan := ⟨url, held, revision⟩

/-- The four things a plan carries, as the diff names them. -/
inductive Change where
  | endpoint
  | credential
  | revision
  | sets
deriving DecidableEq, Repr

/-- The diff an operator reads. -/
def changesOf (next previous : Plan) (nextSets previousSets : List Nat) : List Change :=
  (if next.url = previous.url then [] else [Change.endpoint])
    ++ (if next.credential = previous.credential then [] else [Change.credential])
    ++ (if next.revision = previous.revision then [] else [Change.revision])
    ++ (if nextSets = previousSets then [] else [Change.sets])

/-- A plan offered its own receipt reports nothing: it was made from the state the
receipt was made from. -/
theorem a_plan_offered_its_own_receipt_reports_nothing (url : Nat) (held : Option Nat)
    (revision : Nat) (sets : List Nat) :
    changesOf (planned url held revision) (planned url held revision) sets sets = [] := by
  simp [changesOf, planned]

/-- The control: a credential obtained per reading. The header is no longer a
function of the state, so every plan after the first reports the credential and
the apply never settles — and each reading is another live credential for one
identity. -/
def rotating (reading : Nat) (url revision : Nat) : Plan := ⟨url, some reading, revision⟩

/-- Read per plan, the credential is reported on every plan. -/
theorem a_credential_read_per_plan_never_settles (url revision : Nat) (sets : List Nat) :
    changesOf (rotating 2 url revision) (rotating 1 url revision) sets sets = [Change.credential] := by
  simp [changesOf, rotating]

/-- And what did not move is not reported: the diff names the fields that changed
and no others, so an operator reading "update revision" is not being told the
credential moved too. -/
theorem only_what_moved_is_reported (url : Nat) (held : Option Nat) (sets : List Nat) :
    changesOf (planned url held 7) (planned url held 8) sets sets = [Change.revision] := by
  simp [changesOf, planned]

end Credential
