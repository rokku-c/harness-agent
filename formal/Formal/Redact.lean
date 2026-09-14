namespace McpGateway

inductive Value where
  | atom : Value
  | str : String → Value
  | obj : List (String × Value) → Value
  | arr : List Value → Value
  | passthrough : Value

def REDACTED : Value := Value.str "[REDACTED]"

mutual

def scrub (sensitive : String → Bool) : Value → Value
  | Value.atom => Value.atom
  | Value.str s => Value.str s
  | Value.obj fields => Value.obj (scrubFields sensitive fields)
  | Value.arr items => Value.arr (scrubList sensitive items)
  | Value.passthrough => Value.passthrough

def scrubFields (sensitive : String → Bool) : List (String × Value) → List (String × Value)
  | [] => []
  | kv :: rest =>
    (if sensitive kv.1 = true then (kv.1, REDACTED) else (kv.1, scrub sensitive kv.2))
      :: scrubFields sensitive rest

def scrubList (sensitive : String → Bool) : List Value → List Value
  | [] => []
  | item :: rest => scrub sensitive item :: scrubList sensitive rest

def scrubbed (sensitive : String → Bool) : Value → Prop
  | Value.obj fields => scrubbedFields sensitive fields
  | Value.arr items => scrubbedList sensitive items
  | _ => True

def scrubbedFields (sensitive : String → Bool) : List (String × Value) → Prop
  | [] => True
  | kv :: rest =>
    (sensitive kv.1 = true → kv.2 = REDACTED) ∧ scrubbed sensitive kv.2
      ∧ scrubbedFields sensitive rest

def scrubbedList (sensitive : String → Bool) : List Value → Prop
  | [] => True
  | item :: rest => scrubbed sensitive item ∧ scrubbedList sensitive rest

end


theorem scrubFields_cons (sensitive : String → Bool) (kv : String × Value)
    (rest : List (String × Value)) :
    scrubFields sensitive (kv :: rest) =
      (if sensitive kv.1 = true then (kv.1, REDACTED) else (kv.1, scrub sensitive kv.2))
        :: scrubFields sensitive rest := rfl

theorem scrubList_cons (sensitive : String → Bool) (item : Value) (rest : List Value) :
    scrubList sensitive (item :: rest) = scrub sensitive item :: scrubList sensitive rest := rfl


theorem mem_scrubbedFields {sensitive : String → Bool} :
    ∀ {fields : List (String × Value)} {kv : String × Value}, kv ∈ fields →
      scrubbedFields sensitive fields →
      (sensitive kv.1 = true → kv.2 = REDACTED) ∧ scrubbed sensitive kv.2
  | _, _, List.Mem.head _, h => ⟨h.1, h.2.1⟩
  | _, _, List.Mem.tail _ hmem, h => mem_scrubbedFields hmem h.2.2

theorem mem_scrubbedList {sensitive : String → Bool} :
    ∀ {items : List Value} {item : Value}, item ∈ items →
      scrubbedList sensitive items → scrubbed sensitive item
  | _, _, List.Mem.head _, h => h.1
  | _, _, List.Mem.tail _ hmem, h => mem_scrubbedList hmem h.2


mutual

theorem scrub_is_scrubbed (sensitive : String → Bool) (v : Value) :
    scrubbed sensitive (scrub sensitive v) := by
  cases v with
  | atom => trivial
  | str _ => trivial
  | passthrough => trivial
  | obj fields => exact scrubFields_scrubbed sensitive fields
  | arr items => exact scrubList_scrubbed sensitive items

theorem scrubFields_scrubbed (sensitive : String → Bool) (fields : List (String × Value)) :
    scrubbedFields sensitive (scrubFields sensitive fields) := by
  cases fields with
  | nil => trivial
  | cons kv rest =>
    rw [scrubFields_cons]
    by_cases hs : sensitive kv.1 = true
    · rw [if_pos hs]
      exact ⟨fun _ => rfl, trivial, scrubFields_scrubbed sensitive rest⟩
    · rw [if_neg hs]
      exact ⟨fun hc => absurd hc hs, scrub_is_scrubbed sensitive kv.2,
        scrubFields_scrubbed sensitive rest⟩

theorem scrubList_scrubbed (sensitive : String → Bool) (items : List Value) :
    scrubbedList sensitive (scrubList sensitive items) := by
  cases items with
  | nil => trivial
  | cons item rest =>
    rw [scrubList_cons]
    exact ⟨scrub_is_scrubbed sensitive item, scrubList_scrubbed sensitive rest⟩

end


theorem the_traversal_does_not_look_inside_a_non_plain_object (sensitive : String → Bool) :
    scrub sensitive Value.passthrough = Value.passthrough := rfl

theorem a_secret_is_redacted_only_where_the_scrub_can_look (sensitive : String → Bool)
    (ht : sensitive "token" = true) (hp : sensitive "payload" = false) :
    scrub sensitive (Value.obj [("token", Value.str "s3cret")])
        = Value.obj [("token", REDACTED)] ∧
    scrub sensitive (Value.obj [("payload", Value.passthrough)])
        = Value.obj [("payload", Value.passthrough)] := by
  constructor
  · show Value.obj (scrubFields sensitive [("token", Value.str "s3cret")])
      = Value.obj [("token", REDACTED)]
    rw [scrubFields_cons, if_pos ht]
    rfl
  · show Value.obj (scrubFields sensitive [("payload", Value.passthrough)])
      = Value.obj [("payload", Value.passthrough)]
    rw [scrubFields_cons, if_neg (by simp [hp])]
    rfl


def safeHeaders (sensitive : String → Bool)
    (headers : List (String × String)) : List (String × String) :=
  headers.filter (fun kv => !sensitive kv.1)

theorem a_credential_header_is_not_carried (sensitive : String → Bool)
    (headers : List (String × String)) (kv : String × String)
    (h : kv ∈ safeHeaders sensitive headers) : sensitive kv.1 = false := by
  simp only [safeHeaders, List.mem_filter] at h
  simpa using h.2

end McpGateway
