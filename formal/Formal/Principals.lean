namespace McpGateway

inductive PrincipalStatus where
  | active
  | disabled
deriving DecidableEq, Repr

structure PrincipalRecord where
  kind : String
  id : String
  displayName : Option String
  status : PrincipalStatus
  createdAt : Nat
deriving DecidableEq, Repr

abbrev Roster := String → Option PrincipalRecord

def principalKey (kind id : String) : String := kind ++ ":" ++ id

def atKey (key : String) (record : PrincipalRecord) (roster : Roster) : Roster :=
  fun k => if k = key then some record else roster k

def isActive (roster : Roster) (key : String) : Bool :=
  match roster key with
  | none => false
  | some record =>
    match record.status with
    | PrincipalStatus.active => true
    | PrincipalStatus.disabled => false

def registerPrincipal (now : Nat) (roster : Roster) (kind id : String) (name : Option String) :
    PrincipalRecord × Roster :=
  let record : PrincipalRecord :=
    { kind := kind, id := id, displayName := name, status := PrincipalStatus.active,
      createdAt := match roster (principalKey kind id) with
        | none => now
        | some existing => existing.createdAt }
  (record, atKey (principalKey kind id) record roster)

def setStatus (roster : Roster) (key : String) (status : PrincipalStatus) : Option Roster :=
  match roster key with
  | none => none
  | some record => some (atKey key { record with status := status } roster)

theorem a_key_reads_back_what_was_filed (key : String) (record : PrincipalRecord) (roster : Roster) :
    atKey key record roster key = some record := by
  simp [atKey]

theorem an_unknown_key_is_not_active (roster : Roster) (key : String) (unknown : roster key = none) :
    isActive roster key = false := by
  simp only [isActive, unknown]

theorem a_registered_key_is_active (now : Nat) (roster : Roster) (kind id : String)
    (name : Option String) :
    isActive (registerPrincipal now roster kind id name).2 (principalKey kind id) = true := by
  simp only [registerPrincipal, isActive, a_key_reads_back_what_was_filed]

theorem registering_a_disabled_key_turns_it_back_on (now : Nat) (roster : Roster) (kind id : String)
    (name : Option String) (record : PrincipalRecord)
    (filed : roster (principalKey kind id) = some record)
    (off : record.status = PrincipalStatus.disabled) :
    isActive roster (principalKey kind id) = false ∧
      (registerPrincipal now roster kind id name).1.status = PrincipalStatus.active ∧
      (registerPrincipal now roster kind id name).1.createdAt = record.createdAt ∧
      isActive (registerPrincipal now roster kind id name).2 (principalKey kind id) = true := by
  exact ⟨by simp only [isActive, filed, off],
    rfl,
    by simp only [registerPrincipal, filed],
    a_registered_key_is_active now roster kind id name⟩

theorem disabling_a_key_stops_it_being_active (roster : Roster) (key : String)
    (record : PrincipalRecord) :
    isActive (atKey key { record with status := PrincipalStatus.disabled } roster) key = false := by
  simp only [isActive, a_key_reads_back_what_was_filed]

theorem disabling_an_unknown_key_changes_nothing (roster : Roster) (key : String)
    (status : PrincipalStatus) (unknown : roster key = none) : setStatus roster key status = none := by
  simp only [setStatus, unknown]

def activeUnlessDisabled (roster : Roster) (key : String) : Bool :=
  match roster key with
  | none => true
  | some record =>
    match record.status with
    | PrincipalStatus.active => true
    | PrincipalStatus.disabled => false

def emptyRoster : Roster := fun _ => none

def directory : Roster :=
  fun key =>
    if key = principalKey "agent" "a1" then
      some { kind := "agent", id := "a1", displayName := some "Watcher",
             status := PrincipalStatus.active, createdAt := 7 }
    else none

def directoryWithA1Off : Roster :=
  atKey (principalKey "agent" "a1")
    { kind := "agent", id := "a1", displayName := some "Watcher",
      status := PrincipalStatus.disabled, createdAt := 7 } directory

theorem reading_the_flag_as_not_disabled_admits_any_key :
    isActive directory (principalKey "agent" "a1") = true ∧
      isActive directoryWithA1Off (principalKey "agent" "a1") = false ∧
      isActive directoryWithA1Off (principalKey "agent" "a2") = false ∧
      isActive emptyRoster (principalKey "agent" "a2") = false ∧
      activeUnlessDisabled emptyRoster (principalKey "agent" "a2") = true := by
  decide

theorem a_colon_in_a_name_gives_two_principals_one_key :
    principalKey "agent:board" "a1" = principalKey "agent" "board:a1" ∧
      principalKey "agent" "a1" ≠ principalKey "service" "a1" ∧
      principalKey "agent" "a1" ≠ principalKey "agent" "a2" := by
  decide

end McpGateway
