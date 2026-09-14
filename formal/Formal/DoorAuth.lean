import Formal.Resolve

namespace McpGateway

abbrev HeaderBag := String → Option String

abbrev Credential := HeaderBag → Option String

structure DoorInfo where
  token : String
  clientId : String
  claims : Principal
deriving DecidableEq, Repr

def doorKey (p : Principal) : String := p.kind ++ ":" ++ p.id

def admittedBy (registry : Registry) (p : Principal) : Option Principal :=
  if registry p then some p else none

def fromCredential (store : TokenStore) (parse : Parse) (registry : Registry)
    (token : String) : Option Principal :=
  match store token with
  | none => none
  | some key =>
    match parse key with
    | none => none
    | some p => admittedBy registry p

def doorNames (store : TokenStore) (parse : Parse) (registry : Registry)
    (credential : Credential) (headers : HeaderBag) : Option Principal :=
  match credential headers with
  | none => none
  | some token => fromCredential store parse registry token

def infoFor (hash : String → String) (token : String) (p : Principal) : DoorInfo :=
  { token := hash token, clientId := doorKey p, claims := p }

theorem a_request_with_no_credential_names_nobody (store : TokenStore) (parse : Parse)
    (registry : Registry) (credential : Credential) (headers : HeaderBag)
    (absent : credential headers = none) :
    doorNames store parse registry credential headers = none := by
  simp [doorNames, absent]

theorem the_headers_are_read_only_as_a_credential (store : TokenStore) (parse : Parse)
    (registry : Registry) (credential : Credential) (headers other : HeaderBag)
    (same : credential headers = credential other) :
    doorNames store parse registry credential headers =
      doorNames store parse registry credential other := by
  simp [doorNames, same]

theorem a_credential_the_store_never_saw_names_nobody (store : TokenStore) (parse : Parse)
    (registry : Registry) (token : String) (unknown : store token = none) :
    fromCredential store parse registry token = none := by
  simp [fromCredential, unknown]

theorem an_unreadable_key_names_nobody (store : TokenStore) (parse : Parse)
    (registry : Registry) (token key : String) (known : store token = some key)
    (unreadable : parse key = none) :
    fromCredential store parse registry token = none := by
  simp [fromCredential, known, unreadable]

theorem a_disabled_principal_is_named_by_no_credential (store : TokenStore) (parse : Parse)
    (registry : Registry) (token key : String) (p : Principal) (known : store token = some key)
    (parsed : parse key = some p) (off : registry p = false) :
    fromCredential store parse registry token = none := by
  simp [fromCredential, known, parsed, admittedBy, off]

theorem a_principal_the_door_named_was_verified (store : TokenStore) (parse : Parse)
    (registry : Registry) (credential : Credential) (headers : HeaderBag) (p : Principal)
    (named : doorNames store parse registry credential headers = some p) :
    ∃ token key, credential headers = some token ∧ store token = some key ∧
      parse key = some p ∧ registry p = true := by
  have someOf {α : Type} {o : Option α} (nope : o ≠ none) : ∃ a, o = some a := by
    cases o with
    | none => exact absurd rfl nope
    | some a => exact ⟨a, rfl⟩
  by_cases blank : credential headers = none
  · simp [doorNames, blank] at named
  · obtain ⟨token, presented⟩ := someOf blank
    have known : ∃ key, store token = some key ∧ parse key = some p ∧ registry p = true := by
      have step := named
      unfold doorNames fromCredential at step
      simp only [presented] at step
      by_cases absent : store token = none
      · simp [absent] at step
      · obtain ⟨key, holds⟩ := someOf absent
        simp only [holds] at step
        by_cases unreadable : parse key = none
        · simp [unreadable] at step
        · obtain ⟨q, reads⟩ := someOf unreadable
          simp only [reads] at step
          unfold admittedBy at step
          by_cases on : registry q = true
          · simp [on] at step
            have same : q = p := by simpa using step
            subst same
            exact ⟨key, holds, reads, on⟩
          · simp [on] at step
    obtain ⟨key, holds, reads, on⟩ := known
    exact ⟨token, key, presented, holds, reads, on⟩

def doorReadingClaims (store : TokenStore) (parse : Parse) (registry : Registry)
    (credential : Credential) (claimed : HeaderBag → Option Principal) (headers : HeaderBag) :
    Option Principal :=
  match credential headers with
  | none => (claimed headers).bind fun p => admittedBy registry p
  | some token => fromCredential store parse registry token

theorem a_door_that_reads_the_claim_headers_lets_a_header_be_the_caller :
    let operator : Principal := { kind := "operator", id := "root" }
    let headers : HeaderBag := fun name =>
      if name = "x-principal-kind" then some "operator"
      else if name = "x-principal-id" then some "root" else none
    let claimed : HeaderBag → Option Principal := fun bag =>
      match bag "x-principal-kind", bag "x-principal-id" with
      | some kind, some id => some { kind := kind, id := id }
      | _, _ => none
    let present : Credential := fun _ => none
    doorReadingClaims (fun _ => none) (fun _ => none) (fun _ => true) present claimed headers =
        some operator ∧
      doorNames (fun _ => none) (fun _ => none) (fun _ => true) present headers = none := by
  decide

theorem the_handed_information_carries_the_hash_and_the_principal (hash : String → String)
    (token : String) (p : Principal) :
    (infoFor hash token p).clientId = doorKey p ∧ (infoFor hash token p).claims = p ∧
      (infoFor hash token p).token = hash token := ⟨rfl, rfl, rfl⟩

end McpGateway
