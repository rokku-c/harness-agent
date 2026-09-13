/-
  Who the directory says exists, and whether they are still on —
  `packages/mcp-gateway/src/principals.ts`.

  The header calls itself the answer to *does this identity exist and is it on*,
  and the file names the edge in a comment: *Unknown keys are not active; that is
  the point of asking.* That is the claim worth proving, because the reading that
  goes wrong is silent and permissive — a status check written as "not disabled"
  answers yes for every key the directory has never heard of, and nothing says so.

  **There is no key outside the directory** — `an_unknown_key_is_not_active`, from
  the lookup and not from the flag. Read the flag as `≠ disabled` instead and any
  name at all is admitted: `reading_the_flag_as_not_disabled_admits_any_key`.

  **A registration is an activation** — `a_registered_key_is_active`, and what it
  costs: `registering_a_disabled_key_turns_it_back_on`. The file keeps only
  `createdAt` off an existing record and writes `status: "active"` unconditionally,
  so a disable is not sticky across a re-registration. That is a real consequence
  of the file as written rather than a bug in it — but it is the opposite of what a
  reader who reaches for "cut someone off with one flag here" would predict.

  **A disable for a key that is not there does nothing** —
  `disabling_an_unknown_key_changes_nothing`: `setStatus` returns `false` and
  creates no record, so a typo'd key is refused rather than invented. The caller
  has to read the `false`; the file does not throw.

  Idealisation: the directory is the key-to-record lookup `records.get` performs,
  and a principal is its kind, its id, its display name, its status and when it was
  filed — the fields `register` writes. The register/setStatus pair is modelled as
  returning the record and the directory it left, in that order, which is what the
  file's `records.set` plus returned value amount to. `list()` is not modelled:
  nothing here reads the order back. The key's own shape is checked by
  `a_colon_in_a_name_gives_two_principals_one_key` — `:` is a separator like any
  other, and a kind or id that carries one folds two principals onto one key, which
  is the same class of widening `Formal/Authorize.lean` proves about `/`.
-/

namespace McpGateway

/-- The two states a principal can be in. -/
inductive PrincipalStatus where
  | active
  | disabled
deriving DecidableEq, Repr

/-- A principal as the directory files it. -/
structure PrincipalRecord where
  kind : String
  id : String
  displayName : Option String
  status : PrincipalStatus
  createdAt : Nat
deriving DecidableEq, Repr

/-- The directory, as `records.get` reads it: a key to the record filed under it. -/
abbrev Roster := String → Option PrincipalRecord

/-- The key a principal is filed under — `${kind}:${id}`. -/
def principalKey (kind id : String) : String := kind ++ ":" ++ id

/-- Filing a record under a key — what the directory does when it registers a
principal or changes one's status. -/
def atKey (key : String) (record : PrincipalRecord) (roster : Roster) : Roster :=
  fun k => if k = key then some record else roster k

/-- `active`: a record that is there, and says `active`. A key with nothing filed
under it is not active — which is the whole of the file's comment. -/
def isActive (roster : Roster) (key : String) : Bool :=
  match roster key with
  | none => false
  | some record =>
    match record.status with
    | PrincipalStatus.active => true
    | PrincipalStatus.disabled => false

/-- `register`: the record it filed and the directory it left. Only `createdAt` is
carried over from a record already under the key; the status is written fresh. -/
def registerPrincipal (now : Nat) (roster : Roster) (kind id : String) (name : Option String) :
    PrincipalRecord × Roster :=
  let record : PrincipalRecord :=
    { kind := kind, id := id, displayName := name, status := PrincipalStatus.active,
      createdAt := match roster (principalKey kind id) with
        | none => now
        | some existing => existing.createdAt }
  (record, atKey (principalKey kind id) record roster)

/-- `setStatus`: nothing at all when the key was never registered. -/
def setStatus (roster : Roster) (key : String) (status : PrincipalStatus) : Option Roster :=
  match roster key with
  | none => none
  | some record => some (atKey key { record with status := status } roster)

/-- Filing a record under a key is what makes that key answer with it. -/
theorem a_key_reads_back_what_was_filed (key : String) (record : PrincipalRecord) (roster : Roster) :
    atKey key record roster key = some record := by
  simp [atKey]

/-- A key the directory has never heard of is not active. -/
theorem an_unknown_key_is_not_active (roster : Roster) (key : String) (unknown : roster key = none) :
    isActive roster key = false := by
  simp only [isActive, unknown]

/-- And a registration answers yes, so the refusal above is not the whole of the
function. -/
theorem a_registered_key_is_active (now : Nat) (roster : Roster) (kind id : String)
    (name : Option String) :
    isActive (registerPrincipal now roster kind id name).2 (principalKey kind id) = true := by
  simp only [registerPrincipal, isActive, a_key_reads_back_what_was_filed]

/-- Registering under a key that already holds someone disabled: the record that
comes back is active, it keeps the original `createdAt`, and the directory now
answers yes for that key. A disable is not sticky across a re-registration. -/
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

/-- A disable lands on the key it names and on no other. -/
theorem disabling_a_key_stops_it_being_active (roster : Roster) (key : String)
    (record : PrincipalRecord) :
    isActive (atKey key { record with status := PrincipalStatus.disabled } roster) key = false := by
  simp only [isActive, a_key_reads_back_what_was_filed]

/-- A disable for a key that is not there changes nothing: no record is invented,
and the `false` the file returns is the only sign the caller gets. -/
theorem disabling_an_unknown_key_changes_nothing (roster : Roster) (key : String)
    (status : PrincipalStatus) (unknown : roster key = none) : setStatus roster key status = none := by
  simp only [setStatus, unknown]

/-- The reading that goes wrong: a status checked as "not disabled" rather than as
"active". Every key the directory has never heard of passes it. -/
def activeUnlessDisabled (roster : Roster) (key : String) : Bool :=
  match roster key with
  | none => true
  | some record =>
    match record.status with
    | PrincipalStatus.active => true
    | PrincipalStatus.disabled => false

def emptyRoster : Roster := fun _ => none

/-- One principal, and the same directory with that principal turned off. -/
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

/-- The control: the directory answers for the principal it holds and for nothing
else, turning one off turns exactly that one off — and read as "not disabled", the
principal that is not there at all reads as active. -/
theorem reading_the_flag_as_not_disabled_admits_any_key :
    isActive directory (principalKey "agent" "a1") = true ∧
      isActive directoryWithA1Off (principalKey "agent" "a1") = false ∧
      isActive directoryWithA1Off (principalKey "agent" "a2") = false ∧
      isActive emptyRoster (principalKey "agent" "a2") = false ∧
      activeUnlessDisabled emptyRoster (principalKey "agent" "a2") = true := by
  decide

/-- The control for the key: a `:` inside a kind or an id folds two principals
onto one key, so registering one registers the other. The last two conjuncts are
the key doing its job on names that carry no separator. -/
theorem a_colon_in_a_name_gives_two_principals_one_key :
    principalKey "agent:board" "a1" = principalKey "agent" "board:a1" ∧
      principalKey "agent" "a1" ≠ principalKey "service" "a1" ∧
      principalKey "agent" "a1" ≠ principalKey "agent" "a2" := by
  decide

end McpGateway
