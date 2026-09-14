import Formal.Credential

namespace ConfigFetch

open Credential

inductive Refusal where
  | noNodeCredential
  | noDoorDeclared
  | noCredentialHeld
deriving DecidableEq, Repr

inductive Verdict where
  | create
  | moved (change : Change)
deriving DecidableEq, Repr

inductive Answer where
  | refused (why : Refusal)
  | served (config : Plan) (changes : List Verdict)
deriving DecidableEq, Repr

def diffOf (next : Plan) (nextSets : List Nat) : Option Plan → List Nat → List Verdict
  | none, _ => [Verdict.create]
  | some previous, previousSets => (changesOf next previous nextSets previousSets).map Verdict.moved

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

def handed : Answer → Option Plan
  | Answer.refused _ => none
  | Answer.served config _ => some config

def reportedChanges : Answer → List Verdict
  | Answer.refused _ => []
  | Answer.served _ changes => changes


theorem what_a_machine_reported_does_not_move_the_config (url held revision : Nat)
    (sets : List Nat) (a b : Option Plan) (aSets bSets : List Nat) :
    handed (fetch (some url) (some held) revision sets a aSets true) =
      handed (fetch (some url) (some held) revision sets b bSets true) := by
  simp [fetch, handed]

theorem a_machine_that_reported_its_own_config_is_told_nothing_moved (url held revision : Nat)
    (sets : List Nat) :
    reportedChanges (fetch (some url) (some held) revision sets
      (some (planned url (some held) revision)) sets true) = [] := by
  simp [fetch, reportedChanges, diffOf, changesOf, planned]

theorem a_machine_that_reported_nothing_is_told_the_config_is_new (url held revision : Nat)
    (sets : List Nat) :
    reportedChanges (fetch (some url) (some held) revision sets none [] true) = [Verdict.create] := by
  simp [fetch, reportedChanges, diffOf]


theorem a_caller_cannot_name_the_door (held revision : Nat) (sets : List Nat)
    (reported : Option Plan) (reportedSets : List Nat) :
    handed (fetch (some 1) (some held) revision sets reported reportedSets true) =
      some (planned 1 (some held) revision) := by
  simp [fetch, handed]


theorem nobody_fetches_a_config_without_the_node_credential (url held : Option Nat)
    (revision : Nat) (sets : List Nat) (reported : Option Plan) (reportedSets : List Nat) :
    fetch url held revision sets reported reportedSets false =
      Answer.refused Refusal.noNodeCredential := by
  simp [fetch]

theorem a_center_that_declared_no_door_serves_nothing (held revision : Nat) (sets : List Nat)
    (reported : Option Plan) (reportedSets : List Nat) :
    handed (fetch none (some held) revision sets reported reportedSets true) = none := by
  simp [fetch, handed]

theorem an_agent_that_holds_nothing_is_refused_not_handed_an_empty_header (url revision : Nat)
    (sets : List Nat) (reported : Option Plan) (reportedSets : List Nat) :
    fetch (some url) none revision sets reported reportedSets true =
      Answer.refused Refusal.noCredentialHeld := by
  simp [fetch]

end ConfigFetch
