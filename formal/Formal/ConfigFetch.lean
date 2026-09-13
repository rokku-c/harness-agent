/-
  THE CONFIG A MACHINE FETCHES — `agentd/src/control-config-ops.ts`,
  `agentd/src/ops/gateway-op.ts`.

  `Formal/Credential.lean` proves what a plan is *made of*. This is the layer
  above it: the plan is not pushed to a console, it is **fetched by the machine
  that will write the file**, and that changes what the request may decide.

  Three things are the request's: whether it presents the node credential, which
  agent it asks about, and what it says it is already running. Two are the
  center's: the door's address and the credential held for that identity. The
  properties below are that split.

  **The report moves the diff, and nothing else.** A machine fetching with the
  config it already has gets the same bytes back and an empty diff
  (`what_a_machine_reported_does_not_move_the_config`,
  `a_machine_that_reported_its_own_config_is_told_nothing_moved`). This is what
  makes the comparison an *observation of the machine's own state* rather than an
  input to the answer — the defect one layer down would be a fetch that let a
  caller's claim decide what it was handed.

  **The request cannot name the door.** The address in the plan is the center's
  declaration (`a_caller_cannot_name_the_door`), so the identity the center bound
  and the door that will verify it are one fact and not two that happen to agree.

  **An agent is refused, never handed an empty header.** With nothing held there
  is no plan at all (`an_agent_that_holds_nothing_is_refused_not_handed_an_empty_header`),
  which is the refusal somebody can act on: an empty header would be turned away
  at the door, far from whoever could have issued one. The same for a center that
  was never told where the door is, and for a caller with no node credential —
  and the last of those is checked first, so a refusal about the request never
  reports the state of the fleet.

  Idealisation: a door is a number, a credential is its own identity (`Option
  Nat`), and "authorized" is a `Bool` the transport supplies — how the node
  credential is compared is `Formal/NodeGuard.lean`, and what the door does with
  a credential once presented is `Formal/Credential.lean`.
-/

import Formal.Credential

namespace ConfigFetch

open Credential

/-- Why a fetch handed over nothing. Each names the thing that was actually
missing, in the order they are checked. -/
inductive Refusal where
  | noNodeCredential
  | noDoorDeclared
  | noCredentialHeld
deriving DecidableEq, Repr

/-- What moved, as the diff names it, or the whole config when there was none. -/
inductive Verdict where
  | create
  | moved (change : Change)
deriving DecidableEq, Repr

/-- An answer: the config, or the reason there is none. -/
inductive Answer where
  | refused (why : Refusal)
  | served (config : Plan) (changes : List Verdict)
deriving DecidableEq, Repr

/-- The diff against what the machine reported, or `create` when it reported
nothing — a machine that has never run this agent has nothing to compare to. -/
def diffOf (next : Plan) (nextSets : List Nat) : Option Plan → List Nat → List Verdict
  | none, _ => [Verdict.create]
  | some previous, previousSets => (changesOf next previous nextSets previousSets).map Verdict.moved

/-- One fetch, as the center answers it. -/
def fetch (url : Option Nat) (held : Option Nat) (revision : Nat) (sets : List Nat)
    (reported : Option Plan) (reportedSets : List Nat) (nodeOpened : Bool) : Answer :=
  if nodeOpened then
    match url with
    | none => Answer.refused Refusal.noDoorDeclared
    | some address =>
      match held with
      | none => Answer.refused Refusal.noCredentialHeld
      | some _ =>
        let plan := planned address held revision
        Answer.served plan (diffOf plan sets reported reportedSets)
  else Answer.refused Refusal.noNodeCredential

/-- The config an answer hands over, when it hands one over. -/
def handed : Answer → Option Plan
  | Answer.refused _ => none
  | Answer.served config _ => some config

/-- What an answer reports as having moved. -/
def reportedChanges : Answer → List Verdict
  | Answer.refused _ => []
  | Answer.served _ changes => changes

/- The request decides the report, never the config. -/

/-- The same request twice over: what the machine said it runs moves the diff and
leaves the config alone. -/
theorem what_a_machine_reported_does_not_move_the_config (url held revision : Nat)
    (sets : List Nat) (a b : Option Plan) (aSets bSets : List Nat) :
    handed (fetch (some url) (some held) revision sets a aSets true) =
      handed (fetch (some url) (some held) revision sets b bSets true) := by
  simp [fetch, handed]

/-- Offered the config it is already running, a machine is told nothing moved. -/
theorem a_machine_that_reported_its_own_config_is_told_nothing_moved (url held revision : Nat)
    (sets : List Nat) :
    reportedChanges (fetch (some url) (some held) revision sets
      (some (planned url (some held) revision)) sets true) = [] := by
  simp [fetch, reportedChanges, diffOf, changesOf, planned]

/-- Offered nothing, a machine is told the config is new — which is a statement
about the machine, not about the plan. -/
theorem a_machine_that_reported_nothing_is_told_the_config_is_new (url held revision : Nat)
    (sets : List Nat) :
    reportedChanges (fetch (some url) (some held) revision sets none [] true) = [Verdict.create] := by
  simp [fetch, reportedChanges, diffOf]

/- The request does not name the door. -/

/-- A fetch for a declared door is handed a config naming that door, whatever it
asked with. The caller's `reported` is not a field of the answer. -/
theorem a_caller_cannot_name_the_door (held revision : Nat) (sets : List Nat)
    (reported : Option Plan) (reportedSets : List Nat) :
    handed (fetch (some 1) (some held) revision sets reported reportedSets true) =
      some (planned 1 (some held) revision) := by
  simp [fetch, handed]

/- Every way there is no config, and the order they are asked in. -/

/-- No node credential, nothing served — before the fleet's own state is read. -/
theorem nobody_fetches_a_config_without_the_node_credential (url held : Option Nat)
    (revision : Nat) (sets : List Nat) (reported : Option Plan) (reportedSets : List Nat) :
    fetch url held revision sets reported reportedSets false =
      Answer.refused Refusal.noNodeCredential := by
  simp [fetch]

/-- A center that was never told where the door is hands over nothing, for any
agent. -/
theorem a_center_that_declared_no_door_serves_nothing (held revision : Nat) (sets : List Nat)
    (reported : Option Plan) (reportedSets : List Nat) :
    handed (fetch none (some held) revision sets reported reportedSets true) = none := by
  simp [fetch, handed]

/-- An agent the center holds no credential for is refused, and is never handed a
config with an empty header in it. -/
theorem an_agent_that_holds_nothing_is_refused_not_handed_an_empty_header (url revision : Nat)
    (sets : List Nat) (reported : Option Plan) (reportedSets : List Nat) :
    fetch (some url) none revision sets reported reportedSets true =
      Answer.refused Refusal.noCredentialHeld := by
  simp [fetch]

end ConfigFetch
