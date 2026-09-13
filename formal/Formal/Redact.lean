/-
  The scrub — `packages/mcp-gateway/src/redaction.ts`, and the header rule
  beside it in `packages/ai-gateway/src/redaction.ts`.

  Both answer the same question with two mechanisms. Args are *copied, with the
  secrets replaced*; headers are *dropped when their name is a credential*.
  What the two share, and what this models, is the traversal: which places a
  scrub looks in, and therefore which places it can miss.

  The miss is the failure with no symptom. A scrub that walks objects but not
  arrays, or stops at the first level, writes a log that looks scrubbed and
  holds a live credential — and nothing downstream can tell, because the
  redaction marker is exactly what a correct run would have written there.

  So what is proved is the traversal, with the vocabulary as a *parameter*:
  `scrub_is_scrubbed` holds for any predicate, which is the precise sense in
  which the two call sites differ in vocabulary and not in coverage. The
  guarantee stops at a value the traversal will not open: a class instance goes
  to the log whole, and `the_traversal_does_not_look_inside_a_non_plain_object`
  and `a_secret_is_redacted_only_where_the_scrub_can_look` state that limit
  rather than leave it to be discovered.
-/

namespace McpGateway

/-- What an args payload is made of. `atom` is every scalar a JSON payload
carries — a number, a boolean, null — none of which has a key and so none of
which can hide one. `passthrough` is the class instance and the function: a case
of its own precisely because the traversal does not open it. -/
inductive Value where
  | atom : Value
  | str : String → Value
  | obj : List (String × Value) → Value
  | arr : List Value → Value
  | passthrough : Value

/-- What a redacted leaf is written as — the string the implementation uses. -/
def REDACTED : Value := Value.str "[REDACTED]"

mutual

/-- The deep copy, with the vocabulary as a parameter, so that "the traversal
is exhaustive" and "the vocabulary is right" are two separate claims. -/
def scrub (sensitive : String → Bool) : Value → Value
  | Value.atom => Value.atom
  | Value.str s => Value.str s
  | Value.obj fields => Value.obj (scrubFields sensitive fields)
  | Value.arr items => Value.arr (scrubList sensitive items)
  | Value.passthrough => Value.passthrough

/-- The object walk, as a list so that the recursion is structural on one. A
scrub that forgets either of these two walks is the failure this file is about. -/
def scrubFields (sensitive : String → Bool) : List (String × Value) → List (String × Value)
  | [] => []
  | kv :: rest =>
    (if sensitive kv.1 = true then (kv.1, REDACTED) else (kv.1, scrub sensitive kv.2))
      :: scrubFields sensitive rest

/-- The array walk, likewise. -/
def scrubList (sensitive : String → Bool) : List Value → List Value
  | [] => []
  | item :: rest => scrub sensitive item :: scrubList sensitive rest

/-- The property the output owes, one field at a time: a key the vocabulary
calls sensitive carries the redaction and nothing else, and everything after it
does too. -/
def scrubbed (sensitive : String → Bool) : Value → Prop
  | Value.obj fields => scrubbedFields sensitive fields
  | Value.arr items => scrubbedList sensitive items
  | _ => True

/-- The object walk's half of it. -/
def scrubbedFields (sensitive : String → Bool) : List (String × Value) → Prop
  | [] => True
  | kv :: rest =>
    (sensitive kv.1 = true → kv.2 = REDACTED) ∧ scrubbed sensitive kv.2
      ∧ scrubbedFields sensitive rest

/-- The array walk's half of it. -/
def scrubbedList (sensitive : String → Bool) : List Value → Prop
  | [] => True
  | item :: rest => scrubbed sensitive item ∧ scrubbedList sensitive rest

end

/-! ### The two walks, one step at a time -/

/-- The object walk's step: a field keeps its key, and a sensitive one gets the
redaction. A proof can name this shape instead of re-deriving it. -/
theorem scrubFields_cons (sensitive : String → Bool) (kv : String × Value)
    (rest : List (String × Value)) :
    scrubFields sensitive (kv :: rest) =
      (if sensitive kv.1 = true then (kv.1, REDACTED) else (kv.1, scrub sensitive kv.2))
        :: scrubFields sensitive rest := rfl

/-- The array walk's step. -/
theorem scrubList_cons (sensitive : String → Bool) (item : Value) (rest : List Value) :
    scrubList sensitive (item :: rest) = scrub sensitive item :: scrubList sensitive rest := rfl

/-! ### The walks, read as membership rather than as a conjunction -/

/-- A field of a scrubbed list: the property holds of it, and of everything
after it. This is what turns the list walk back into the statement a reader
wants — every field of the output, at any index. -/
theorem mem_scrubbedFields {sensitive : String → Bool} :
    ∀ {fields : List (String × Value)} {kv : String × Value}, kv ∈ fields →
      scrubbedFields sensitive fields →
      (sensitive kv.1 = true → kv.2 = REDACTED) ∧ scrubbed sensitive kv.2
  | _, _, List.Mem.head _, h => ⟨h.1, h.2.1⟩
  | _, _, List.Mem.tail _ hmem, h => mem_scrubbedFields hmem h.2.2

/-- And the same for an element of a scrubbed array. -/
theorem mem_scrubbedList {sensitive : String → Bool} :
    ∀ {items : List Value} {item : Value}, item ∈ items →
      scrubbedList sensitive items → scrubbed sensitive item
  | _, _, List.Mem.head _, h => h.1
  | _, _, List.Mem.tail _ hmem, h => mem_scrubbedList hmem h.2

/-! ### The scrub leaves nothing behind

The three statements are one induction: the value walk hands each walk the
property one level down, and each walk hands it back at the next field or
element. Nothing is assumed about the vocabulary, so the coverage is a property
of the traversal alone. -/

mutual

/-- The scrub leaves nothing behind at any depth: the objects, the objects
inside arrays, and the objects inside those, to the bottom of the payload. -/
theorem scrub_is_scrubbed (sensitive : String → Bool) (v : Value) :
    scrubbed sensitive (scrub sensitive v) := by
  cases v with
  | atom => trivial
  | str _ => trivial
  | passthrough => trivial
  | obj fields => exact scrubFields_scrubbed sensitive fields
  | arr items => exact scrubList_scrubbed sensitive items

/-- Every field the object walk wrote keeps its key, and a sensitive one carries
the redaction — not the value it was given. -/
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

/-- And the same for the array walk. -/
theorem scrubList_scrubbed (sensitive : String → Bool) (items : List Value) :
    scrubbedList sensitive (scrubList sensitive items) := by
  cases items with
  | nil => trivial
  | cons item rest =>
    rw [scrubList_cons]
    exact ⟨scrub_is_scrubbed sensitive item, scrubList_scrubbed sensitive rest⟩

end

/-! ### What the traversal does not open -/

/-- The limit, said out loud: a value that is not a plain object is passed
through whole, so `scrubbed` is vacuously true of it and a secret inside one
reaches the log verbatim. This theorem is why that is a stated boundary and not
an unnoticed one. -/
theorem the_traversal_does_not_look_inside_a_non_plain_object (sensitive : String → Bool) :
    scrub sensitive Value.passthrough = Value.passthrough := rfl

/-- The same payload twice: as a plain field the scrub redacts it, and behind a
value the traversal will not open it survives unchanged. -/
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

/-! ### The other mechanism: omit rather than replace -/

/-- The header rule. A credential-named header is not rewritten but left out —
the right shape for a header, where the *name* is the meaning and a marker
value would be a new header claiming to be one. -/
def safeHeaders (sensitive : String → Bool)
    (headers : List (String × String)) : List (String × String) :=
  headers.filter (fun kv => !sensitive kv.1)

/-- Every header that survives is one the vocabulary does not call a credential.
Stated on the output, like the scrub's: what reaches the log is the whole of
what this rule promises. -/
theorem a_credential_header_is_not_carried (sensitive : String → Bool)
    (headers : List (String × String)) (kv : String × String)
    (h : kv ∈ safeHeaders sensitive headers) : sensitive kv.1 = false := by
  simp only [safeHeaders, List.mem_filter] at h
  simpa using h.2

end McpGateway
